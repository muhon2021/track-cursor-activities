/**
 * Pod Issue Summary
 *
 * Summary panel showing pod health overview with total/open/solved counts
 * and a health indicator based on open issue thresholds.
 */

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, AlertTriangle } from "lucide-react";
import type { EOSPod, EOSIssue } from "../../types";

function getHealthIndicator(openCount: number): {
  label: string;
  className: string;
  icon: React.ReactNode;
} {
  if (openCount > 5) {
    return {
      label: "Needs Attention",
      className: "bg-red-100 text-red-700",
      icon: <AlertCircle className="h-3 w-3" />,
    };
  }
  if (openCount >= 3) {
    return {
      label: "Moderate",
      className: "bg-amber-100 text-amber-700",
      icon: <AlertTriangle className="h-3 w-3" />,
    };
  }
  return {
    label: "Healthy",
    className: "bg-green-100 text-green-700",
    icon: <CheckCircle2 className="h-3 w-3" />,
  };
}

interface PodStats {
  pod: EOSPod;
  total: number;
  open: number;
  solved: number;
}

interface PodIssueSummaryProps {
  pods: EOSPod[];
  issuesByPod: Map<string, EOSIssue[]>;
}

export function PodIssueSummary({ pods, issuesByPod }: PodIssueSummaryProps) {
  const { podStats, overallStats } = useMemo(() => {
    const stats: PodStats[] = [];
    let totalIssues = 0;

    for (const pod of pods) {
      const issues = issuesByPod.get(pod.id) || [];
      const open = issues.filter((i) => i.status === "open" || i.status === "in_progress").length;
      const solved = issues.filter((i) => i.status === "solved").length;

      stats.push({
        pod,
        total: issues.length,
        open,
        solved,
      });

      totalIssues += issues.length;
    }

    return {
      podStats: stats,
      overallStats: {
        totalPods: pods.length,
        totalIssues,
        avgPerPod: pods.length > 0 ? Math.round(totalIssues / pods.length) : 0,
      },
    };
  }, [pods, issuesByPod]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Pod Issue Health</CardTitle>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>{overallStats.totalPods} pods</span>
          <span>{overallStats.totalIssues} total issues</span>
          <span>~{overallStats.avgPerPod} per pod</span>
        </div>
      </CardHeader>
      <CardContent>
        {podStats.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pods configured</p>
        ) : (
          <div className="space-y-2">
            {podStats.map(({ pod, total, open, solved }) => {
              const health = getHealthIndicator(open);

              return (
                <div
                  key={pod.id}
                  className="flex items-center gap-3 rounded-md border px-3 py-2"
                >
                  <span
                    className="inline-block h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: pod.color }}
                  />
                  <span className="text-sm font-medium min-w-0 truncate flex-1">
                    {pod.name}
                  </span>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                    <span>{total} total</span>
                    <span>{open} open</span>
                    <span>{solved} solved</span>
                  </div>
                  <Badge
                    variant="secondary"
                    className={`shrink-0 ${health.className}`}
                  >
                    {health.icon}
                    <span className="ml-1">{health.label}</span>
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
