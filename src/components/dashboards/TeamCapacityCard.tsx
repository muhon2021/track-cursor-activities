import { Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { usePMTeamCapacity } from "@/hooks/usePMDashboard";

function UtilizationBar({ pct }: { pct: number }) {
  const clamped = Math.min(100, Math.max(0, pct));
  const color =
    clamped >= 90
      ? "bg-destructive"
      : clamped >= 75
      ? "bg-yellow-500"
      : "bg-green-500";
  return (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${clamped}%` }} />
    </div>
  );
}

export function TeamCapacityCard() {
  const { data: pods, isLoading } = usePMTeamCapacity();

  const totals = pods
    ? pods.reduce(
        (acc, p) => ({
          members: acc.members + p.total_team_members,
          atCapacity: acc.atCapacity + p.at_capacity,
          available: acc.available + p.available,
        }),
        { members: 0, atCapacity: 0, available: 0 }
      )
    : null;

  const avgUtil =
    pods && pods.length > 0
      ? Math.round(pods.reduce((a, p) => a + p.avg_utilization, 0) / pods.length)
      : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4 text-muted-foreground" />
          Team Capacity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-1">
                  <Skeleton className="h-6 w-10" />
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </div>
          </div>
        ) : !pods || pods.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            No capacity data for this week. Import productivity records to see team utilization.
          </p>
        ) : (
          <div className="space-y-4">
            {/* Summary row */}
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{totals?.members ?? 0}</p>
                <p className="text-xs text-muted-foreground">Team members</p>
              </div>
              <div>
                <p
                  className={cn(
                    "text-2xl font-bold",
                    (totals?.atCapacity ?? 0) > 0 ? "text-destructive" : "text-green-600"
                  )}
                >
                  {totals?.atCapacity ?? 0}
                </p>
                <p className="text-xs text-muted-foreground">At capacity</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{totals?.available ?? 0}</p>
                <p className="text-xs text-muted-foreground">Available</p>
              </div>
            </div>

            {/* Avg utilization bar */}
            {avgUtil !== null && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Avg utilization</span>
                  <span
                    className={cn(
                      "font-medium",
                      avgUtil >= 90
                        ? "text-destructive"
                        : avgUtil >= 75
                        ? "text-yellow-600"
                        : "text-green-600"
                    )}
                  >
                    {avgUtil}%
                  </span>
                </div>
                <UtilizationBar pct={avgUtil} />
              </div>
            )}

            {/* Per-pod breakdown */}
            {pods.length > 1 && (
              <div className="space-y-2 pt-1 border-t border-border/50">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">By pod</p>
                {pods.map((pod) => (
                  <div key={pod.pod_id} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground truncate">Pod {pod.pod_id.slice(0, 8)}…</span>
                      <span
                        className={cn(
                          "font-medium tabular-nums",
                          pod.avg_utilization >= 90
                            ? "text-destructive"
                            : pod.avg_utilization >= 75
                            ? "text-yellow-600"
                            : "text-foreground"
                        )}
                      >
                        {pod.avg_utilization}%
                      </span>
                    </div>
                    <UtilizationBar pct={pod.avg_utilization} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
