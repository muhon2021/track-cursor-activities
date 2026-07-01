import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAutomationAnalytics } from "../hooks/useAutomationAnalytics";

export default function AnalyticsPage() {
  const { isLoading, metrics, dailyExecutions, topErrors } = useAutomationAnalytics();

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Automation Analytics</h1>
          <p className="text-muted-foreground">Execution metrics and trends</p>
        </div>
        <Button variant="outline" asChild><Link to="/automation/workflows">Workflows</Link></Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Executions</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{metrics.total}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Active</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{metrics.active}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Success Rate</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{metrics.successRate}%</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Avg Duration</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{Math.round(metrics.avgDurationMs / 1000)}s</div></CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Daily Executions (14 days)</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {dailyExecutions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet</p>
            ) : (
              dailyExecutions.map(({ date, count }) => (
                <div key={date} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-24">{date}</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${Math.min(100, count * 10)}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-8">{count}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Top Errors</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {topErrors.length === 0 ? (
              <p className="text-sm text-muted-foreground">No failures recorded</p>
            ) : (
              topErrors.map(({ error, count }) => (
                <div key={error} className="flex justify-between text-sm gap-4">
                  <span className="truncate text-muted-foreground">{error}</span>
                  <span className="font-medium shrink-0">{count}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
