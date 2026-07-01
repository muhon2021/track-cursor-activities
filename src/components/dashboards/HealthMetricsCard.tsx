import { TrendingUp, Users, FolderKanban, AlertTriangle, Building2, RefreshCw, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useOwnerMetrics } from "@/hooks/useOwnerMetrics";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/cache";
import { useState } from "react";

function MetricTile({
  label,
  value,
  icon: Icon,
  status,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  status?: "healthy" | "caution" | "risk";
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4 shrink-0" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <span
        className={cn(
          "text-2xl font-bold tabular-nums",
          status === "risk" && "text-destructive",
          status === "caution" && "text-yellow-600 dark:text-yellow-400",
          status === "healthy" && "text-green-600 dark:text-green-400",
          !status && "text-foreground"
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function HealthMetricsCard() {
  const { data: metrics, isLoading, isError } = useOwnerMetrics();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isAdmin = profile?.role === "admin" || profile?.role === "moderator";

  const allZero = metrics &&
    metrics.revenue_this_week === 0 &&
    metrics.team_utilization === 0 &&
    metrics.projects_in_progress === 0 &&
    metrics.projects_at_risk === 0;

  const handleRefreshDemoData = async () => {
    setIsRefreshing(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.rpc("refresh_demo_data" as any);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.ownerMetrics });
    } catch {
      // Silently fail — the button is a convenience feature
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Business Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError || !metrics) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Business Health</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Unable to load metrics. Try refreshing.</p>
        </CardContent>
      </Card>
    );
  }

  const utilizationStatus =
    metrics.team_utilization >= 90
      ? "risk"
      : metrics.team_utilization >= 75
      ? "caution"
      : "healthy";

  const riskStatus = metrics.projects_at_risk > 0 ? "risk" : "healthy";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
            <CardTitle className="text-base">Business Health</CardTitle>
            {isAdmin && allZero && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleRefreshDemoData}
                disabled={isRefreshing}
                className="h-7 text-xs"
              >
                {isRefreshing ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3 mr-1" />
                )}
                Refresh demo data
              </Button>
            )}
          </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
          <MetricTile
            label="Revenue This Week"
            value={`$${metrics.revenue_this_week.toLocaleString()}`}
            icon={TrendingUp}
          />
          <MetricTile
            label="Team Utilization"
            value={`${metrics.team_utilization}%`}
            icon={Users}
            status={utilizationStatus}
          />
          <MetricTile
            label="Projects In Progress"
            value={metrics.projects_in_progress}
            icon={FolderKanban}
          />
          <MetricTile
            label="At Risk"
            value={metrics.projects_at_risk}
            icon={AlertTriangle}
            status={riskStatus}
          />
          <MetricTile
            label="Active Clients"
            value={metrics.active_clients}
            icon={Building2}
          />
        </div>
      </CardContent>
    </Card>
  );
}
