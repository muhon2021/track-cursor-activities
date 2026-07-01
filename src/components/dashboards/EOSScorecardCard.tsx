import { Link } from "react-router-dom";
import { BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useScorecards, useScorecardMetrics } from "@/modules/eos/hooks/useScorecard";
import type { EOSScorecardMetric } from "@/modules/eos/types";

const METRIC_STATUS_COLOR: Record<string, string> = {
  on_track: "text-green-600 dark:text-green-400",
  needs_attention: "text-yellow-600 dark:text-yellow-400",
  off_track: "text-destructive",
};

const METRIC_STATUS_DOT: Record<string, string> = {
  on_track: "bg-green-500",
  needs_attention: "bg-yellow-500",
  off_track: "bg-destructive",
};

/** Shows the most recent metric for a scorecard */
function ScorecardMetricRow({ metric }: { metric: EOSScorecardMetric }) {
  const pct =
    metric.metric_type === "percentage"
      ? metric.current_value
      : metric.target_value && metric.target_value > 0
      ? Math.round((metric.current_value / metric.target_value) * 100)
      : null;

  return (
    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-border/50 last:border-0 text-sm">
      <div className="flex items-center gap-2 min-w-0">
        <span
          className={cn(
            "h-2 w-2 rounded-full shrink-0",
            METRIC_STATUS_DOT[metric.status] ?? "bg-muted"
          )}
        />
        <span className="truncate text-sm">{metric.name}</span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <span
          className={cn(
            "tabular-nums text-xs font-medium",
            METRIC_STATUS_COLOR[metric.status] ?? "text-muted-foreground"
          )}
        >
          {metric.metric_type === "percentage"
            ? `${metric.current_value}%`
            : metric.metric_type === "currency"
            ? `$${metric.current_value.toLocaleString()}`
            : metric.current_value.toLocaleString()}
        </span>
        {metric.target_value != null && (
          <span className="text-xs text-muted-foreground">
            / {metric.metric_type === "percentage"
              ? `${metric.target_value}%`
              : metric.metric_type === "currency"
              ? `$${metric.target_value.toLocaleString()}`
              : metric.target_value.toLocaleString()}
          </span>
        )}
      </div>
    </div>
  );
}

function ScorecardSection({ scorecardId, name }: { scorecardId: string; name: string }) {
  const { data: metrics, isLoading } = useScorecardMetrics(scorecardId);

  if (isLoading) {
    return (
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-28" />
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
    );
  }

  if (!metrics || metrics.length === 0) return null;

  const onTrack = metrics.filter((m) => m.status === "on_track").length;
  const offTrack = metrics.filter((m) => m.status === "off_track").length;

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{name}</p>
        <span className="text-xs text-muted-foreground">
          {onTrack}/{metrics.length} on track
          {offTrack > 0 && (
            <span className="ml-1 text-destructive font-medium">· {offTrack} off track</span>
          )}
        </span>
      </div>
      {metrics.slice(0, 4).map((m) => (
        <ScorecardMetricRow key={m.id} metric={m} />
      ))}
    </div>
  );
}

export function EOSScorecardCard() {
  const { data: scorecards, isLoading } = useScorecards();

  const activeCards = scorecards?.filter((s) => s.is_active) ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            Scorecard
          </CardTitle>
          <Link
            to="/eos/scorecard"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            View all
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-24" />
                {Array.from({ length: 3 }).map((_, j) => (
                  <Skeleton key={j} className="h-6 w-full" />
                ))}
              </div>
            ))}
          </div>
        ) : activeCards.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            No active scorecards. Go to{" "}
            <Link to="/eos/scorecard" className="underline">
              EOS → Scorecard
            </Link>{" "}
            to set one up.
          </p>
        ) : (
          <div className="space-y-5">
            {activeCards.slice(0, 2).map((sc) => (
              <ScorecardSection key={sc.id} scorecardId={sc.id} name={sc.name} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
