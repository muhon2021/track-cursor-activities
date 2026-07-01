/**
 * AI Cost Dashboard — Phase C
 * Route: /admin/ai/cost-dashboard
 */
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowLeft,
  DollarSign,
  Download,
  RefreshCw,
  TrendingUp,
  Zap,
  AlertTriangle,
} from "lucide-react";
import { useCostDashboard } from "@/hooks/useAgentAdmin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function AICostDashboard() {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const { data, isLoading, isError, error, refetch, isFetching } = useCostDashboard(days);

  const chartDaily = useMemo(
    () =>
      (data?.dailySpend ?? []).map((d) => ({
        ...d,
        label: format(new Date(d.date), "MMM d"),
        spend: Number(d.spend.toFixed(4)),
      })),
    [data?.dailySpend]
  );

  const chartModels = useMemo(
    () =>
      (data?.modelBreakdown ?? []).slice(0, 8).map((m) => ({
        name: m.model.length > 18 ? `${m.model.slice(0, 16)}…` : m.model,
        fullName: m.model,
        spend: Number(m.spend.toFixed(4)),
        requests: m.requests,
      })),
    [data?.modelBreakdown]
  );

  const exportCsv = () => {
    if (!data?.logs.length) {
      toast.error("No logs to export");
      return;
    }
    const headers = [
      "Date",
      "User",
      "Provider",
      "Model",
      "Function",
      "Input Tokens",
      "Output Tokens",
      "Cost",
    ];
    const rows = data.logs.map((l) => [
      l.created_at,
      l.user_email,
      l.provider_name,
      l.model_name,
      l.function_name ?? "",
      l.input_tokens,
      l.output_tokens,
      l.estimated_cost,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai-usage-${days}d-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <p className="text-sm text-muted-foreground max-w-md text-center">
          {(error as Error)?.message ?? "Failed to load cost data"}
        </p>
        <Button onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn("h-4 w-4 mr-2", isFetching && "animate-spin")} />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Button variant="ghost" size="sm" className="-ml-2 mb-2" asChild>
            <Link to="/admin/ai/agents">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Agent catalog
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">AI Cost Dashboard</h1>
          <p className="text-muted-foreground">
            Spend, token usage, and model breakdown from usage logs
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select
            value={String(days)}
            onValueChange={(v) => setDays(Number(v) as 7 | 30 | 90)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportCsv} disabled={isLoading}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
          <Skeleton className="h-72 md:col-span-2" />
          <Skeleton className="h-72" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <DollarSign className="h-4 w-4" />
                  Total spend
                </CardDescription>
                <CardTitle className="text-3xl">
                  ${(data?.totalSpend ?? 0).toFixed(2)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <TrendingUp className="h-4 w-4" />
                  API requests
                </CardDescription>
                <CardTitle className="text-3xl">{data?.totalRequests ?? 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <Zap className="h-4 w-4" />
                  Total tokens
                </CardDescription>
                <CardTitle className="text-3xl">
                  {(data?.totalTokens ?? 0).toLocaleString()}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Daily spend</CardTitle>
                <CardDescription>Estimated cost over time</CardDescription>
              </CardHeader>
              <CardContent className="h-[280px]">
                {chartDaily.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                    No usage in this period
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartDaily}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                      <Tooltip
                        formatter={(value: number) => [`$${value.toFixed(4)}`, "Spend"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="spend"
                        stroke="hsl(var(--primary))"
                        fill="hsl(var(--primary))"
                        fillOpacity={0.15}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Spend by model</CardTitle>
                <CardDescription>Top models by estimated cost</CardDescription>
              </CardHeader>
              <CardContent className="h-[280px]">
                {chartModels.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                    No model data
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartModels} layout="vertical" margin={{ left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={100}
                        tick={{ fontSize: 10 }}
                      />
                      <Tooltip
                        formatter={(value: number, _n, props) => [
                          `$${value.toFixed(4)} (${(props.payload as { requests: number }).requests} req)`,
                          (props.payload as { fullName: string }).fullName,
                        ]}
                      />
                      <Bar dataKey="spend" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent usage log</CardTitle>
              <CardDescription>Last {data?.logs.length ?? 0} entries in range</CardDescription>
            </CardHeader>
            <CardContent>
              {!data?.logs.length ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No usage logs in this period
                </div>
              ) : (
                <div className="rounded-md border overflow-auto max-h-[360px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Model</TableHead>
                        <TableHead>Function</TableHead>
                        <TableHead className="text-right">Tokens</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-xs whitespace-nowrap">
                            {format(new Date(log.created_at), "MMM d, HH:mm")}
                          </TableCell>
                          <TableCell className="text-xs">{log.user_email}</TableCell>
                          <TableCell className="text-xs">
                            {log.provider_name} / {log.model_name}
                          </TableCell>
                          <TableCell className="text-xs font-mono">
                            {log.function_name ?? "—"}
                          </TableCell>
                          <TableCell className="text-xs text-right">
                            {log.input_tokens + log.output_tokens}
                          </TableCell>
                          <TableCell className="text-xs text-right font-medium">
                            ${log.estimated_cost.toFixed(4)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
