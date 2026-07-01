/**
 * Issues Pod Overview Page
 *
 * Dashboard showing all pods with their issue counts and stats.
 * Each pod card links to its dedicated issues view.
 * Also shows unassigned issues at the bottom.
 * Route: /eos/issues/pod-overview
 */

import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, AlertCircle, Users, AlertTriangle, Inbox } from "lucide-react";
import { useEOSIssuesByPod } from "../hooks/useEOSIssuesByPod";
import { useUpdateIssue, useDeleteIssue } from "../hooks/useEOSIssues";
import { IssuesTable } from "../components/issues/IssuesTable";
import { PodIssueCard } from "../components/issues/PodIssueCard";
import { PodIssueSummary } from "../components/issues/PodIssueSummary";
import { IssuesNavTabs } from "../components/issues/IssuesNavTabs";

export default function IssuesPodOverviewPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useEOSIssuesByPod();
  const updateIssue = useUpdateIssue();
  const deleteIssue = useDeleteIssue();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalIssues = data?.totalIssues || 0;
  const totalPods = data?.groups.length || 0;
  const unassignedCount = data?.unassigned.length || 0;
  const criticalCount =
    data?.groups.reduce((sum, g) => sum + g.stats.critical, 0) || 0;

  const pods = data?.groups.map((g) => g.pod) || [];
  const issuesByPod = new Map(
    data?.groups.map((g) => [g.pod.id, g.issues]) || []
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Issues by Pod</h1>
        <p className="text-muted-foreground">
          Overview of issues across all pods
        </p>
      </div>
      <IssuesNavTabs />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-muted-foreground">Total Issues</span>
            </div>
            <p className="text-2xl font-bold mt-1">{totalIssues}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-indigo-500" />
              <span className="text-sm text-muted-foreground">Total Pods</span>
            </div>
            <p className="text-2xl font-bold mt-1">{totalPods}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2">
              <Inbox className="h-4 w-4 text-yellow-500" />
              <span className="text-sm text-muted-foreground">Unassigned Issues</span>
            </div>
            <p className="text-2xl font-bold mt-1">{unassignedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-sm text-muted-foreground">Critical Issues</span>
            </div>
            <p className="text-2xl font-bold mt-1">{criticalCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Pod Health Summary */}
      {pods.length > 0 && (
        <PodIssueSummary pods={pods} issuesByPod={issuesByPod} />
      )}

      {/* Pod Cards Grid */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Pods</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data?.groups.map((group) => (
            <PodIssueCard
              key={group.pod.id}
              pod={group.pod}
              issues={group.issues}
              onClick={() => navigate(`/eos/issues/pod/${group.pod.id}`)}
            />
          ))}
        </div>
      </div>

      {/* Unassigned Issues */}
      {data?.unassigned && data.unassigned.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">
            Unassigned Issues ({data.unassigned.length})
          </h2>
          <div className="rounded-lg border bg-card">
            <IssuesTable
              issues={data.unassigned}
              onStatusChange={(id, status) => updateIssue.mutate({ id, data: { status } })}
              onDelete={(id) => deleteIssue.mutate(id)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
