/**
 * EOS Analytics — rock completion, issue resolution, KPI trends, team health.
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";
import { Loader2, BarChart3 } from "lucide-react";
import { useEOSIssueInsights } from "../hooks/useEOSIssueInsights";
import { useEOSDashboard } from "../hooks/useEOSDashboard";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ISSUE_STATUS_LABELS } from "../types";

export default function EOSAnalyticsPage() {
  const [period, setPeriod] = useState<"weekly" | "monthly" | "quarterly">("weekly");
  const days = period === "weekly" ? 7 : period === "monthly" ? 30 : 90;

  const { data: insights, isLoading: insightsLoading } = useEOSIssueInsights(days);
  const { data: dashboard, isLoading: dashLoading } = useEOSDashboard();

  const { data: rockStats, isLoading: rocksLoading } = useQuery({
    queryKey: ["eos-analytics-rocks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("okrs").select("rock_status, status");
      if (error) throw error;
      const total = data?.length || 0;
      const completed =
        data?.filter((o) => o.rock_status === "completed" || o.status === "completed").length || 0;
      return { total, completed, rate: total > 0 ? Math.round((completed / total) * 100) : 0 };
    },
  });

  const isLoading = insightsLoading || dashLoading || rocksLoading;

  const statusChartData = insights
    ? Object.entries(insights.byStatus).map(([status, count]) => ({
        name: ISSUE_STATUS_LABELS[status] || status,
        count,
      }))
    : [];

  const priorityChartData = insights
    ? Object.entries(insights.byPriority).map(([priority, count]) => ({
        name: priority,
        count,
      }))
    : [];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6" />
          EOS Analytics
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Rock completion, issue resolution, KPI trends, and team health
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard title="Rock Completion Rate" value={`${rockStats?.rate ?? 0}%`} />
            <MetricCard
              title="Issue Resolution Time"
              value={`${insights?.avgResolutionDays?.toFixed(1) ?? 0} days`}
            />
            <MetricCard title="Team Health Score" value={`${dashboard?.teamHealthScore ?? 0}`} />
            <MetricCard
              title="Meeting Effectiveness"
              value={`${dashboard?.meetings.upcoming ?? 0} upcoming`}
            />
          </div>

          <Tabs value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
            <TabsList>
              <TabsTrigger value="weekly">Weekly</TabsTrigger>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger value="quarterly">Quarterly</TabsTrigger>
            </TabsList>
            <TabsContent value={period} className="mt-4">
              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Issue Status Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={statusChartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="count" fill="hsl(var(--primary))" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Issue Trend</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={insights?.recentTrend ?? []}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="opened" stroke="hsl(var(--destructive))" name="Opened" />
                        <Line type="monotone" dataKey="solved" stroke="hsl(var(--primary))" name="Solved" />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-base">Issues by Priority</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={priorityChartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="count" fill="hsl(var(--chart-2))" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
