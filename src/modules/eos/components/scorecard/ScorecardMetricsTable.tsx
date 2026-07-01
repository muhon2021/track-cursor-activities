/**
 * Scorecard Metrics Table
 *
 * Displays scorecard metrics in a table with status indicators.
 */

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, Target } from "lucide-react";
import type { EOSScorecardMetric } from "../../types";

const statusConfig: Record<string, { label: string; className: string }> = {
  on_track: { label: "On Track", className: "bg-green-100 text-green-800" },
  off_track: { label: "Off Track", className: "bg-red-100 text-red-800" },
  needs_attention: { label: "Needs Attention", className: "bg-yellow-100 text-yellow-800" },
};

const directionIcons: Record<string, React.ReactNode> = {
  higher_is_better: <TrendingUp className="h-3 w-3 text-green-500" />,
  lower_is_better: <TrendingDown className="h-3 w-3 text-blue-500" />,
  target: <Target className="h-3 w-3 text-purple-500" />,
};

interface ScorecardMetricsTableProps {
  metrics: EOSScorecardMetric[];
  onUpdateMetric?: (id: string, value: number) => void;
}

export function ScorecardMetricsTable({ metrics, onUpdateMetric }: ScorecardMetricsTableProps) {
  if (metrics.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <p>No metrics added yet.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Metric</TableHead>
          <TableHead className="w-[100px]">Current</TableHead>
          <TableHead className="w-[100px]">Target</TableHead>
          <TableHead className="w-[160px]">Progress</TableHead>
          <TableHead className="w-[80px]">Goal</TableHead>
          <TableHead className="w-[120px]">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {metrics.map((metric) => {
          const progress = metric.target_value
            ? Math.min(100, (metric.current_value / metric.target_value) * 100)
            : 0;

          return (
            <TableRow key={metric.id}>
              <TableCell>
                <div>
                  <p className="font-medium">{metric.name}</p>
                  {metric.description && (
                    <p className="text-xs text-muted-foreground">{metric.description}</p>
                  )}
                </div>
              </TableCell>
              <TableCell className="font-mono text-sm">
                {metric.current_value}
                {metric.unit}
              </TableCell>
              <TableCell className="font-mono text-sm text-muted-foreground">
                {metric.target_value}
                {metric.unit}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Progress value={Math.max(0, progress)} className="h-2 flex-1" />
                  <span className="text-xs text-muted-foreground w-8">
                    {Math.round(progress)}%
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  {directionIcons[metric.goal_direction]}
                </div>
              </TableCell>
              <TableCell>
                <Badge
                  variant="secondary"
                  className={statusConfig[metric.status]?.className || ""}
                >
                  {statusConfig[metric.status]?.label || metric.status}
                </Badge>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
