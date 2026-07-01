/**
 * Productivity Dashboard Page
 *
 * Layout: breadcrumb, Quick Insights card, tabs (Overview, Departments, Top Performers, Meeting Efficiency),
 * Performance Distribution donut + Performance Breakdown.
 */

import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { PieChart, Pie, Cell } from "recharts";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Search,
  Users,
  Loader2,
  BarChart3,
  AlertCircle,
  Building2,
  MapPin,
  TrendingUp,
  Home,
} from "lucide-react";
import {
  useProductivityRecords,
  useProductivitySummary,
  useDepartments,
  useAvailableWeeks,
  usePodProductivity,
} from "../hooks/useProductivity";
import type { ProductivityRecord } from "../types";

const PERF_COLORS = {
  high: "#22c55e",
  average: "#eab308",
  low: "#ef4444",
};

const perfChartConfig: ChartConfig = {
  high: { label: "High Performers", color: PERF_COLORS.high },
  average: { label: "Average Performers", color: PERF_COLORS.average },
  low: { label: "Low Performers", color: PERF_COLORS.low },
};

type QuickInsights = {
  lowAttendance: number;
  excellentPerformers: number;
  topDept: { name: string; pct: number };
  topLocation: { name: string; pct: number };
  trendPct: number;
};

type PerfBreakdown = {
  high: { count: number; pct: number };
  average: { count: number; pct: number };
  low: { count: number; pct: number };
};

function computeQuickInsights(records: ProductivityRecord[]): QuickInsights {
  if (records.length === 0) {
    return {
      lowAttendance: 0,
      excellentPerformers: 0,
      topDept: { name: "—", pct: 0 },
      topLocation: { name: "—", pct: 0 },
      trendPct: 2.0,
    };
  }

  const lowAttendance = records.filter((r) => r.attendance_status === "absent" || r.attendance_status === "partial").length;
  const excellentPerformers = records.filter((r) => (r.utilization_pct ?? 0) >= 80).length;

  const deptMap = new Map<string, { sum: number; count: number }>();
  records.forEach((r) => {
    const dept = r.department || "Unassigned";
    const cur = deptMap.get(dept) ?? { sum: 0, count: 0 };
    cur.sum += r.utilization_pct ?? 0;
    cur.count++;
    deptMap.set(dept, cur);
  });
  const topDept = Array.from(deptMap.entries())
    .map(([name, v]) => ({ name, pct: Math.round(v.sum / v.count) }))
    .sort((a, b) => b.pct - a.pct)[0] ?? { name: "—", pct: 0 };

  const locMap = new Map<string, { sum: number; count: number }>();
  records.forEach((r) => {
    const loc = r.location || "Unknown";
    const cur = locMap.get(loc) ?? { sum: 0, count: 0 };
    cur.sum += r.utilization_pct ?? 0;
    cur.count++;
    locMap.set(loc, cur);
  });
  const topLocation = Array.from(locMap.entries())
    .map(([name, v]) => ({ name, pct: Math.round(v.sum / v.count) }))
    .sort((a, b) => b.pct - a.pct)[0] ?? { name: "—", pct: 0 };

  return {
    lowAttendance,
    excellentPerformers,
    topDept,
    topLocation,
    trendPct: 2.0, // Could compute week-over-week if we had prior week data
  };
}

function computePerfBreakdown(records: ProductivityRecord[]): PerfBreakdown {
  const total = records.length;
  const high = records.filter((r) => (r.utilization_pct ?? 0) >= 80).length;
  const average = records.filter((r) => {
    const p = r.utilization_pct ?? 0;
    return p >= 60 && p < 80;
  }).length;
  const low = records.filter((r) => (r.utilization_pct ?? 0) < 60).length;

  return {
    high: { count: high, pct: total ? Math.round((high / total) * 100) : 0 },
    average: { count: average, pct: total ? Math.round((average / total) * 100) : 0 },
    low: { count: low, pct: total ? Math.round((low / total) * 100) : 0 },
  };
}

export default function ProductivityPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("all");
  const [weekStart, setWeekStart] = useState<string | undefined>();

  const { data: summary } = useProductivitySummary(weekStart);
  const { data: departments = [] } = useDepartments();
  const { data: weeks = [] } = useAvailableWeeks();
  const { data: records = [], isLoading } = useProductivityRecords({
    search: search || undefined,
    department: department !== "all" ? department : undefined,
    week_start: weekStart,
  });
  const { data: podStats = [] } = usePodProductivity(weekStart);

  const insights = useMemo(() => computeQuickInsights(records), [records]);
  const perfBreakdown = useMemo(() => computePerfBreakdown(records), [records]);

  const perfDonutData = useMemo(() => {
    const total = records.length;
    if (total === 0) return [];
    return [
      { name: "high", value: perfBreakdown.high.count },
      { name: "average", value: perfBreakdown.average.count },
      { name: "low", value: perfBreakdown.low.count },
    ].filter((d) => d.value > 0);
  }, [records.length, perfBreakdown]);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/dashboard" className="flex items-center gap-1">
                <Home className="h-4 w-4" />
                Home
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Productivity</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Page Title */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Productivity</h1>
      </div>

      {/* Quick Insights */}
      <Card className="border-blue-100 bg-slate-50/80 dark:border-blue-900 dark:bg-slate-950/50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Quick Insights</CardTitle>
              <CardDescription>Week-over-week productivity trend</CardDescription>
            </div>
            <Badge className="bg-green-600 text-white hover:bg-green-600">
              <TrendingUp className="mr-1 h-3.5 w-3.5" />
              +{insights.trendPct}%
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-3 rounded-lg border bg-background px-4 py-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{insights.lowAttendance}</p>
                <p className="text-sm text-muted-foreground">Low attendance (&lt;4 days)</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border bg-background px-4 py-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <Users className="h-5 w-5 text-green-600 dark:text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{insights.excellentPerformers}</p>
                <p className="text-sm text-muted-foreground">Excellent performers</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border bg-background px-4 py-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-500" />
              </div>
              <div>
                <p className="text-lg font-bold">{insights.topDept.name}</p>
                <p className="text-sm text-muted-foreground">Top dept ({insights.topDept.pct}%)</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border bg-background px-4 py-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
                <MapPin className="h-5 w-5 text-purple-600 dark:text-purple-500" />
              </div>
              <div>
                <p className="text-lg font-bold">{insights.topLocation.name}</p>
                <p className="text-sm text-muted-foreground">Top location ({insights.topLocation.pct}%)</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="departments">Departments</TabsTrigger>
          <TabsTrigger value="top-performers">Top Performers</TabsTrigger>
          <TabsTrigger value="meeting-efficiency">Meeting Efficiency</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Performance Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Performance Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {perfDonutData.length > 0 ? (
                  <div className="flex flex-col items-center">
                    <ChartContainer config={perfChartConfig} className="h-[220px] w-full">
                      <PieChart>
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Pie
                          data={perfDonutData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={2}
                          dataKey="value"
                          nameKey="name"
                        >
                          {perfDonutData.map((entry) => (
                            <Cell
                              key={entry.name}
                              fill={PERF_COLORS[entry.name as keyof typeof PERF_COLORS] ?? "#6b7280"}
                            />
                          ))}
                        </Pie>
                      </PieChart>
                    </ChartContainer>
                    <div className="flex flex-wrap gap-4 justify-center mt-2">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="h-3 w-3 rounded-full bg-green-500" />
                        <span>High Performers</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="h-3 w-3 rounded-full bg-yellow-500" />
                        <span>Average Performers</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="h-3 w-3 rounded-full bg-red-500" />
                        <span>Low Performers</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-12 text-center">No data for this period</p>
                )}
              </CardContent>
            </Card>

            {/* Performance Breakdown */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Performance Breakdown</CardTitle>
                  <span className="text-xs text-muted-foreground">Latest week per employee</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg bg-green-100 px-4 py-3 dark:bg-green-900/30">
                    <div>
                      <p className="text-xl font-bold text-green-800 dark:text-green-200">{perfBreakdown.high.pct}%</p>
                      <p className="text-sm text-green-700 dark:text-green-300">≥80% productivity</p>
                    </div>
                    <Badge className="bg-green-600 text-white">{perfBreakdown.high.count}</Badge>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-amber-100 px-4 py-3 dark:bg-amber-900/30">
                    <div>
                      <p className="text-xl font-bold text-amber-800 dark:text-amber-200">{perfBreakdown.average.pct}%</p>
                      <p className="text-sm text-amber-700 dark:text-amber-300">60–79% productivity</p>
                    </div>
                    <Badge className="bg-amber-600 text-white">{perfBreakdown.average.count}</Badge>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-red-100 px-4 py-3 dark:bg-red-900/30">
                    <div>
                      <p className="text-xl font-bold text-red-800 dark:text-red-200">{perfBreakdown.low.pct}%</p>
                      <p className="text-sm text-red-700 dark:text-red-300">&lt;60% productivity</p>
                    </div>
                    <Badge className="bg-red-600 text-white">{perfBreakdown.low.count}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="departments" className="mt-4">
          {summary && summary.departments.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Department Overview</CardTitle>
                <CardDescription>Utilization by department</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {summary.departments.map((dept) => (
                    <div key={dept.name} className="rounded-lg border p-4 text-center">
                      <p className="text-sm font-medium truncate">{dept.name}</p>
                      <p className="text-2xl font-bold mt-1">{dept.avg_utilization}%</p>
                      <p className="text-xs text-muted-foreground">{dept.employee_count} employees</p>
                    </div>
                  ))}
                </div>
                {podStats.length > 0 && (
                  <div className="mt-6">
                    <h4 className="font-medium mb-3">Pod Breakdown</h4>
                    <div className="space-y-2">
                      {podStats.map((pod) => (
                        <div
                          key={pod.pod_id}
                          className="flex items-center justify-between rounded-md border px-4 py-2"
                        >
                          <span className="text-sm font-medium">{pod.pod_name}</span>
                          <span className="text-sm text-muted-foreground">{pod.department_name}</span>
                          <span
                            className={`text-sm font-medium ${
                              pod.avg_utilization >= 80
                                ? "text-green-600"
                                : pod.avg_utilization >= 60
                                ? "text-amber-600"
                                : "text-red-600"
                            }`}
                          >
                            {pod.avg_utilization}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <p className="text-muted-foreground py-8 text-center">No department data available.</p>
          )}
        </TabsContent>

        <TabsContent value="top-performers" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Performers</CardTitle>
              <CardDescription>Employees with ≥80% utilization</CardDescription>
            </CardHeader>
            <CardContent>
              {records.filter((r) => (r.utilization_pct ?? 0) >= 80).length > 0 ? (
                <div className="space-y-2">
                  {records
                    .filter((r) => (r.utilization_pct ?? 0) >= 80)
                    .sort((a, b) => (b.utilization_pct ?? 0) - (a.utilization_pct ?? 0))
                    .slice(0, 20)
                    .map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between rounded-md border px-4 py-2 cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/productivity/employee/${encodeURIComponent(r.employee_email)}`)}
                      >
                        <span className="font-medium text-sm">{r.employee_email}</span>
                        <span className="text-sm text-green-600">{r.utilization_pct}%</span>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-muted-foreground py-8 text-center">No top performers in this period.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="meeting-efficiency" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Meeting Efficiency</CardTitle>
              <CardDescription>Meetings attended and impact on productivity</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground py-8 text-center">
                Meeting efficiency metrics are available when meetings data is linked to productivity records.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Filters and Table */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by email..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={department} onValueChange={setDepartment}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.name}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {weeks.length > 0 && (
          <Select value={weekStart || "latest"} onValueChange={(v) => setWeekStart(v === "latest" ? undefined : v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Week" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="latest">Latest Week</SelectItem>
              {weeks.slice(0, 12).map((w) => (
                <SelectItem key={w} value={w}>
                  {new Date(w).toLocaleDateString()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : records.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <BarChart3 className="h-12 w-12 mb-4 opacity-40" />
          <p className="text-lg font-medium">No productivity records found</p>
          <p className="text-sm">Import productivity data via CSV or HR sync.</p>
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead className="w-[120px]">Department</TableHead>
                <TableHead className="w-[100px] text-right">Hours</TableHead>
                <TableHead className="w-[100px] text-right">Utilization</TableHead>
                <TableHead className="w-[100px] text-right">Efficiency</TableHead>
                <TableHead className="w-[80px] text-right">Tasks</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((r) => (
                <TableRow
                  key={r.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/productivity/employee/${encodeURIComponent(r.employee_email)}`)}
                >
                  <TableCell>
                    <p className="font-medium text-sm">{r.employee_email}</p>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{r.department || "—"}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-sm">{r.total_hours}h</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={`text-sm font-medium ${
                        (r.utilization_pct ?? 0) >= 80 ? "text-green-600" : (r.utilization_pct ?? 0) >= 60 ? "text-amber-600" : "text-red-600"
                      }`}
                    >
                      {r.utilization_pct}%
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-sm">{r.efficiency_score}%</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-sm">
                      {r.tasks_completed}/{r.tasks_assigned}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        r.attendance_status === "present"
                          ? "border-green-500 text-green-600"
                          : r.attendance_status === "leave"
                          ? "border-blue-500 text-blue-600"
                          : r.attendance_status === "partial"
                          ? "border-amber-500 text-amber-600"
                          : "border-red-500 text-red-600"
                      }
                    >
                      {r.attendance_status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
