import { Link } from "react-router-dom";
import { Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useOKRs } from "@/modules/eos/hooks/useOKRs";

function currentQuarterLabel(): string {
  const now = new Date();
  const q = Math.ceil((now.getMonth() + 1) / 3);
  return `Q${q} ${now.getFullYear()}`;
}

function ProgressBar({ pct, status }: { pct: number; status: string }) {
  const color =
    status === "completed"
      ? "bg-green-500"
      : status === "at_risk"
      ? "bg-destructive"
      : status === "behind"
      ? "bg-yellow-500"
      : "bg-blue-500";

  return (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all", color)}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  not_started: "Not started",
  on_track: "On track",
  at_risk: "At risk",
  behind: "Behind",
  completed: "Completed",
};

const STATUS_DOT: Record<string, string> = {
  not_started: "bg-muted-foreground",
  on_track: "bg-blue-500",
  at_risk: "bg-destructive",
  behind: "bg-yellow-500",
  completed: "bg-green-500",
};

export function EOSRocksCard() {
  const quarter = currentQuarterLabel();
  const { data: okrs, isLoading } = useOKRs({ quarter });

  const avgProgress =
    okrs && okrs.length > 0
      ? Math.round(okrs.reduce((a, o) => a + o.progress, 0) / okrs.length)
      : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4 text-muted-foreground" />
            Rocks / OKRs
            <span className="text-xs font-normal text-muted-foreground">· {quarter}</span>
          </CardTitle>
          <Link
            to="/eos/okrs"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            View all
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        ) : !okrs || okrs.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            No OKRs set for {quarter}. Go to{" "}
            <Link to="/eos/okrs" className="underline">
              EOS → OKRs
            </Link>{" "}
            to create them.
          </p>
        ) : (
          <div className="space-y-3">
            {/* Summary */}
            {avgProgress !== null && (
              <div className="space-y-1 pb-2 border-b border-border/50">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{okrs.length} objectives</span>
                  <span
                    className={cn(
                      "font-medium",
                      avgProgress >= 80
                        ? "text-green-600"
                        : avgProgress >= 50
                        ? "text-blue-600"
                        : "text-yellow-600"
                    )}
                  >
                    {avgProgress}% avg
                  </span>
                </div>
                <ProgressBar pct={avgProgress} status={avgProgress >= 80 ? "completed" : avgProgress >= 50 ? "on_track" : "at_risk"} />
              </div>
            )}

            {/* Per-OKR list (max 5) */}
            {okrs.slice(0, 5).map((okr) => (
              <div key={okr.id} className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full shrink-0",
                        STATUS_DOT[okr.status] ?? "bg-muted-foreground"
                      )}
                    />
                    <Link
                      to={`/eos/okrs`}
                      className="text-xs truncate font-medium hover:underline"
                    >
                      {okr.title}
                    </Link>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                    {okr.progress}%
                  </span>
                </div>
                <ProgressBar pct={okr.progress} status={okr.status} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
