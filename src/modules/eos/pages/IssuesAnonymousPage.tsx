/**
 * Anonymous Issues Page
 *
 * Filtered view showing only issues reported anonymously.
 * Client-side filters issues where is_anonymous=true since
 * useEOSIssues does not support is_anonymous filtering directly.
 * Route: /eos/issues/anonymous
 */

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Plus } from "lucide-react";
import { useEOSIssues, useIssueStats, useUpdateIssue, useDeleteIssue } from "../hooks/useEOSIssues";
import { IssuesTable } from "../components/issues/IssuesTable";
import { IssueStatsCards } from "../components/issues/IssueStatsCards";
import { IssueFiltersBar } from "../components/issues/IssueFiltersBar";
import { IssuesNavTabs } from "../components/issues/IssuesNavTabs";
import { CreateIssueDialog } from "../components/issues/CreateIssueDialog";
import type { IssueFilters } from "../types";

export default function IssuesAnonymousPage() {
  const [filters, setFilters] = useState<IssueFilters>({});
  const [showCreate, setShowCreate] = useState(false);
  const { data: issues, isLoading } = useEOSIssues(filters);
  const { data: stats } = useIssueStats();
  const updateIssue = useUpdateIssue();
  const deleteIssue = useDeleteIssue();

  const anonymousIssues = useMemo(
    () => issues?.filter((i) => i.is_anonymous) || [],
    [issues],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Anonymous Issues</h1>
          <p className="text-muted-foreground">
            Issues reported anonymously
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Report Anonymous Issue
        </Button>
      </div>

      <IssuesNavTabs />

      {stats && <IssueStatsCards stats={stats} />}

      <IssueFiltersBar filters={filters} onFiltersChange={setFilters} />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <IssuesTable
            issues={anonymousIssues}
            onStatusChange={(id, status) => updateIssue.mutate({ id, data: { status } })}
            onDelete={(id) => deleteIssue.mutate(id)}
          />
        </div>
      )}

      <CreateIssueDialog open={showCreate} onOpenChange={setShowCreate} />
    </div>
  );
}
