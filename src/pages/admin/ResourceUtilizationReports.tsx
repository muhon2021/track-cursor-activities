import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Loader2, Users, TrendingUp, Clock, Percent } from "lucide-react";
import {
  useProductivityRecords,
  useProductivitySummary,
  useDepartments,
  useAvailableWeeks,
} from "@/modules/productivity/hooks/useProductivity";

const deptChartConfig: ChartConfig = {
  utilization: { label: "Avg Utilization %", color: "#6366f1" },
  headcount: { label: "Headcount", color: "#22c55e" },
};

function utilizationColor(pct: number): string {
  if (pct >= 80) return "text-success";
  if (pct >= 60) return "text-amber-600";
  return "text-destructive";
}

function utilizationBadge(pct: number) {
  if (pct >= 80) return <Badge variant="default">High</Badge>;
  if (pct >= 60) return <Badge variant="secondary">Medium</Badge>;
  return <Badge variant="destructive">Low</Badge>;
}

export default function ResourceUtilizationReports() {
  const [department, setDepartment] = useState("all");
  const [weekStart, setWeekStart] = useState<string | undefined>();

  const { data: summary, isLoading: summaryLoading } = useProductivitySummary(weekStart);
  const { data: departments = [] } = useDepartments();
  const { data: weeks = [] } = useAvailableWeeks();
  const { data: records = [], isLoading: recordsLoading } = useProductivityRecords({
    department: department !== "all" ? department : undefined,
    week_start: weekStart,
  });

  const isLoading = summaryLoading || recordsLoading;

  // Aggregate per-employee stats
  const employeeRows = useMemo(() => {
    const map = new Map<
      string,
      { email: string; dept: string; totalHours: number; billableHours: number; util: number; eff: number; count: number }
    >();
    records.forEach((r) => {
      const cur = map.get(r.employee_email) || {
        email: r.employee_email,
        dept: r.department || "Unassigned",
        totalHours: 0,
        billableHours: 0,
        util: 0,
        eff: 0,
        count: 0,
      };
      cur.totalHours += Number(r.total_hours) || 0;
      cur.billableHours += Number(r.billable_hours) || 0;
      cur.util += Number(r.utilization_pct) || 0;
      cur.eff += Number(r.efficiency_score) || 0;
      cur.count++;
      map.set(r.employee_email, cur);
    });
    return Array.from(map.values())
      .map((e) => ({
        ...e,
        avgUtil: e.count ? Math.round(e.util / e.count) : 0,
        avgEff: e.count ? Math.round(e.eff / e.count) : 0,
        billableRatio: e.totalHours > 0 ? Math.round((e.billableHours / e.totalHours) * 100) : 0,
      }))
      .sort((a, b) => b.avgUtil - a.avgUtil);
  }, [records]);

  // Overall billable/non-billable summary
  const billableSummary = useMemo(() => {
    const totHours = records.reduce((s, r) => s + (Number(r.total_hours) || 0), 0);
    const billHours = records.reduce((s, r) => s + (Number(r.billable_hours) || 0), 0);
    return {
      total: Math.round(totHours),
      billable: Math.round(billHours),
      nonBillable: Math.round(totHours - billHours),
      ratio: totHours > 0 ? Math.round((billHours / totHours) * 100) : 0,
    };
  }, [records]);

  // Department chart data
  const deptChartData = useMemo(() => {
    return (summary?.departments || []).map((d) => ({
      name: d.name,
      utilization: d.avg_utilization,
      headcount: d.employee_count,
    }));
  }, [summary]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Resource Utilization</h1>
        <p className="text-muted-foreground">
          Billable vs. non-billable time, capacity, and allocation trends
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Select value={department} onValueChange={setDepartment}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={weekStart || "latest"} onValueChange={(v) => setWeekStart(v === "latest" ? undefined : v)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Week" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="latest">Latest Week</SelectItem>
            {weeks.map((w) => (
              <SelectItem key={w} value={w}>{w}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Users className="h-4 w-4" />
                  Total Employees
                </div>
                <p className="text-2xl font-bold mt-1">{summary?.total_employees || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <TrendingUp className="h-4 w-4" />
                  Avg Utilization
                </div>
                <p className={`text-2xl font-bold mt-1 ${utilizationColor(summary?.avg_utilization || 0)}`}>
                  {summary?.avg_utilization || 0}%
                </p>
                <Progress value={summary?.avg_utilization || 0} className="mt-2 h-2" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Percent className="h-4 w-4" />
                  Billable Ratio
                </div>
                <p className={`text-2xl font-bold mt-1 ${utilizationColor(billableSummary.ratio)}`}>
                  {billableSummary.ratio}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {billableSummary.billable}h billable / {billableSummary.total}h total
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Clock className="h-4 w-4" />
                  Avg Efficiency
                </div>
                <p className="text-2xl font-bold mt-1">{summary?.avg_efficiency || 0}%</p>
                <Progress value={summary?.avg_efficiency || 0} className="mt-2 h-2" />
              </CardContent>
            </Card>
          </div>

          {/* Department Utilization Chart */}
          {deptChartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Utilization by Department</CardTitle>
                <CardDescription>Average utilization percentage per department</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={deptChartConfig} className="h-64">
                  <BarChart data={deptChartData} margin={{ left: 12, right: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis domain={[0, 100]} tickLine={false} axisLine={false} fontSize={12} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="utilization" fill="var(--color-utilization)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}

          {/* Employee Utilization Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Employee Utilization</CardTitle>
              <CardDescription>
                Individual utilization, billable ratio, and efficiency for the selected period
              </CardDescription>
            </CardHeader>
            <CardContent>
              {employeeRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mb-4" />
                  <p className="text-lg font-medium">No records found</p>
                  <p className="text-sm">
                    Try adjusting the department or week filter, or add productivity records.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead className="text-right">Total Hours</TableHead>
                      <TableHead className="text-right">Billable Hours</TableHead>
                      <TableHead className="text-right">Billable %</TableHead>
                      <TableHead>Utilization</TableHead>
                      <TableHead className="text-right">Efficiency</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employeeRows.map((emp) => (
                      <TableRow key={emp.email}>
                        <TableCell className="font-medium">{emp.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{emp.dept}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{Math.round(emp.totalHours)}h</TableCell>
                        <TableCell className="text-right">{Math.round(emp.billableHours)}h</TableCell>
                        <TableCell className="text-right">
                          <span className={utilizationColor(emp.billableRatio)}>{emp.billableRatio}%</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={emp.avgUtil} className="h-2 w-20" />
                            {utilizationBadge(emp.avgUtil)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{emp.avgEff}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
