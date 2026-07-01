/**
 * Pod Issue Card
 *
 * Displays a pod's issue summary with colored border, mini stats,
 * and a list of recent issues.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ArrowUp, ArrowRight, ArrowDown } from "lucide-react";
import type { EOSPod, EOSIssue } from "../../types";

const statusConfig: Record<string, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-blue-100 text-blue-800" },
  in_progress: { label: "In Progress", className: "bg-yellow-100 text-yellow-800" },
  solved: { label: "Solved", className: "bg-green-100 text-green-800" },
  archived: { label: "Archived", className: "bg-gray-100 text-gray-600" },
};

const priorityConfig: Record<
  string,
  { icon: React.ReactNode; label: string; className: string }
> = {
  low: {
    icon: <ArrowDown className="h-3 w-3" />,
    label: "Low",
    className: "bg-gray-100 text-gray-700",
  },
  medium: {
    icon: <ArrowRight className="h-3 w-3" />,
    label: "Medium",
    className: "bg-yellow-100 text-yellow-700",
  },
  high: {
    icon: <ArrowUp className="h-3 w-3" />,
    label: "High",
    className: "bg-orange-100 text-orange-700",
  },
  critical: {
    icon: <AlertTriangle className="h-3 w-3" />,
    label: "Critical",
    className: "bg-red-100 text-red-700",
  },
};

interface PodIssueCardProps {
  pod: EOSPod;
  issues: EOSIssue[];
  onClick?: () => void;
}

export function PodIssueCard({ pod, issues, onClick }: PodIssueCardProps) {
  const openCount = issues.filter((i) => i.status === "open").length;
  const criticalCount = issues.filter((i) => i.priority === "critical").length;
  const recentIssues = issues.slice(0, 3);

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow overflow-hidden"
      onClick={onClick}
      style={{ borderLeftWidth: "4px", borderLeftColor: pod.color }}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{pod.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">
              {issues.length} {issues.length === 1 ? "issue" : "issues"}
            </span>
            <span className="text-muted-foreground">
              {openCount} open
            </span>
            {criticalCount > 0 && (
              <Badge variant="secondary" className="bg-red-100 text-red-700">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {criticalCount} critical
              </Badge>
            )}
          </div>

          {recentIssues.length > 0 && (
            <div className="space-y-2 pt-1">
              {recentIssues.map((issue) => {
                const priority = priorityConfig[issue.priority];
                const status = statusConfig[issue.status];

                return (
                  <div
                    key={issue.id}
                    className="flex items-center justify-between gap-2"
                  >
                    <p className="text-sm truncate flex-1">{issue.title}</p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge
                        variant="secondary"
                        className={`text-xs ${priority?.className || ""}`}
                      >
                        {priority?.icon}
                        <span className="ml-0.5">{priority?.label}</span>
                      </Badge>
                      <Badge
                        variant="secondary"
                        className={`text-xs ${status?.className || ""}`}
                      >
                        {status?.label || issue.status}
                      </Badge>
                    </div>
                  </div>
                );
              })}
              {issues.length > 3 && (
                <p className="text-xs text-muted-foreground">
                  +{issues.length - 3} more
                </p>
              )}
            </div>
          )}

          {recentIssues.length === 0 && (
            <p className="text-sm text-muted-foreground">No issues</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
