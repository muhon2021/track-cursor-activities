/**
 * Archived Issues Page
 *
 * Pre-filtered view showing only archived issues.
 * Route: /eos/issues/archived
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Plus } from "lucide-react";
import { useEOSIssues, useIssueStats, useUpdateIssue, useDeleteIssue } from "../hooks/useEOSIssues";
import { IssuesTable } from "../components/issues/IssuesTable";
import { IssueStatsCards } from "../components/issues/IssueStatsCards";
import { IssueFiltersBar } from "../components/issues/IssueFiltersBar";
import { IssuesNavTabs } from "../components/issues/IssuesNavTabs";
import { CreateIssueDialog } from "../components/issues/CreateIssueDialog";
import type { IssueFilters } from "../types";

export default function IssuesArchivedPage() {
  const [filters, setFilters] = useState<IssueFilters>({
    status: "archived" as const,
  });
  const [showCreate, setShowCreate] = useState(false);
  const { data: issues, isLoading } = useEOSIssues(filters);
  const { data: stats } = useIssueStats();
  const updateIssue = useUpdateIssue();
  const deleteIssue = useDeleteIssue();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Archived Issues</h1>
          <p className="text-muted-foreground">
            Issues that have been archived
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Report Issue
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
            issues={issues || []}
            onStatusChange={(id, status) => updateIssue.mutate({ id, data: { status } })}
            onDelete={(id) => deleteIssue.mutate(id)}
          />
        </div>
      )}

      <CreateIssueDialog open={showCreate} onOpenChange={setShowCreate} />
    </div>
  );
}
