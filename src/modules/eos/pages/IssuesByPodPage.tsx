/**
 * Issues By Pod Page
 *
 * Shows issues for a specific pod identified by the :podId route param.
 * Uses usePodIssues to fetch pod data and its issues together.
 * Route: /eos/issues/pod/:podId
 */

import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Plus } from "lucide-react";
import { useUpdateIssue, useDeleteIssue } from "../hooks/useEOSIssues";
import { usePodIssues } from "../hooks/useEOSIssuesByPod";
import { IssuesTable } from "../components/issues/IssuesTable";
import { IssueFiltersBar } from "../components/issues/IssueFiltersBar";
import { CreateIssueDialog } from "../components/issues/CreateIssueDialog";
import type { IssueFilters } from "../types";

export default function IssuesByPodPage() {
  const { podId } = useParams<{ podId: string }>();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<IssueFilters>({});
  const [showCreate, setShowCreate] = useState(false);
  const { data, isLoading } = usePodIssues(podId);
  const updateIssue = useUpdateIssue();
  const deleteIssue = useDeleteIssue();

  const filteredIssues = useMemo(() => {
    if (!data?.issues) return [];

    return data.issues.filter((issue) => {
      if (filters.status && filters.status !== "all" && issue.status !== filters.status) {
        return false;
      }
      if (filters.priority && filters.priority !== "all" && issue.priority !== filters.priority) {
        return false;
      }
      if (filters.category && filters.category !== "all" && issue.category !== filters.category) {
        return false;
      }
      if (filters.search) {
        const search = filters.search.toLowerCase();
        if (!issue.title.toLowerCase().includes(search)) {
          return false;
        }
      }
      return true;
    });
  }, [data?.issues, filters]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/eos/issues")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {data?.pod ? `${data.pod.name} Issues` : "Pod Issues"}
            </h1>
            <p className="text-muted-foreground">
              {data?.pod
                ? `Issues assigned to ${data.pod.name}`
                : "Loading pod information..."}
            </p>
          </div>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Report Issue
        </Button>
      </div>

      <IssueFiltersBar filters={filters} onFiltersChange={setFilters} />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <IssuesTable
            issues={filteredIssues}
            onStatusChange={(id, status) => updateIssue.mutate({ id, data: { status } })}
            onDelete={(id) => deleteIssue.mutate(id)}
          />
        </div>
      )}

      <CreateIssueDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        defaultPodId={podId}
      />
    </div>
  );
}
