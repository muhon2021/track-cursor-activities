/**
 * Chart History Timeline Component
 *
 * Displays a vertical timeline of accountability chart versions with
 * visual dots, connecting lines, and status indicators.
 */

import { Badge } from "@/components/ui/badge";
import { Calendar, FileText } from "lucide-react";
import type { AccountabilityChart } from "../../types";

interface ChartHistoryTimelineProps {
  charts: AccountabilityChart[];
}

export function ChartHistoryTimeline({ charts }: ChartHistoryTimelineProps) {
  if (charts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <FileText className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm">No chart versions available.</p>
      </div>
    );
  }

  const sorted = [...charts].sort((a, b) => b.version - a.version);

  return (
    <div className="relative">
      {sorted.map((chart, index) => {
        const isLast = index === sorted.length - 1;

        return (
          <div key={chart.id} className="relative flex gap-4 pb-6">
            {/* Timeline column: dot + connecting line */}
            <div className="flex flex-col items-center">
              <div
                className={`h-3.5 w-3.5 rounded-full border-2 z-10 ${
                  chart.is_current
                    ? "bg-green-500 border-green-600"
                    : chart.published_at
                      ? "bg-blue-400 border-blue-500"
                      : "bg-gray-300 border-gray-400"
                }`}
              />
              {!isLast && (
                <div className="w-0.5 flex-1 bg-border mt-1" />
              )}
            </div>

            {/* Content */}
            <div
              className={`flex-1 -mt-1 rounded-lg border p-3 ${
                chart.is_current ? "border-green-200 bg-green-50/50" : "border-border"
              }`}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="text-xs font-mono">
                  v{chart.version}
                </Badge>
                <span className="text-sm font-medium">{chart.name}</span>
                {chart.is_current && (
                  <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">
                    Current
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {chart.published_at ? (
                  <span>
                    Published {new Date(chart.published_at).toLocaleDateString()}
                  </span>
                ) : (
                  <span className="italic">Draft</span>
                )}
              </div>

              {chart.description && (
                <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                  {chart.description}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
