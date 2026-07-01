/**
 * AI Analytics – unified analytics dashboard merging AI Usage and Agent Analytics.
 * Route: /admin/ai/analytics
 */
import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  DollarSign,
  TrendingUp,
  Brain,
  Loader2,
  Download,
  BarChart3,
  Zap,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfMonth } from "date-fns";
import {
  useAgentAnalytics,
  formatCostMicro,
  formatTokens,
  type DateRangeDays,
} from "@/hooks/useAgentAnalytics";

// ─── Usage Analytics Tab ───────────────────────────────────────────────────────

interface UsageLog {
  id: string;
  user_id: string;
  model_id: string;
  function_name: string;
  input_tokens: number;
  output_tokens: number;
  embedding_tokens: number;
  estimated_cost: number;
  created_at: string;
  user_email?: string;
  model_name?: string;
  provider_name?: string;
}

interface UsageSummary {
  totalTokens: number;
  totalCost: number;
  totalRequests: number;
  avgCostPerRequest: number;
}

interface ProviderUsage { provider: string; cost: number; requests: number; }
interface ModelUsage { model: string; requests: number; }

function UsageTab() {
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [summary, setSummary] = useState<UsageSummary>({ totalTokens: 0, totalCost: 0, totalRequests: 0, avgCostPerRequest: 0 });
  const [providerUsage, setProviderUsage] = useState<ProviderUsage[]>([]);
  const [modelUsage, setModelUsage] = useState<ModelUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "month">("30d");

  useEffect(() => { loadUsageData(); }, [dateRange]);

  const getDateRangeFilter = () => {
    const now = new Date();
    switch (dateRange) {
      case "7d": return subDays(now, 7).toISOString();
      case "30d": return subDays(now, 30).toISOString();
      case "month": return startOfMonth(now).toISOString();
      default: return subDays(now, 30).toISOString();
    }
  };

  const loadUsageData = async () => {
    setLoading(true);
    try {
      const startDate = getDateRangeFilter();
      const { data: logsData, error: logsError } = await supabase
        .from("ai_usage_logs")
        .select(`*, ai_models (name, ai_providers (name))`)
        .gte("created_at", startDate)
        .order("created_at", { ascending: false })
        .limit(100);
      if (logsError) throw logsError;

      const userIds = [...new Set((logsData || []).map((log: any) => log.user_id).filter(Boolean))];
      const { data: profilesData } = await supabase.from("profiles").select("id, email").in("id", userIds);
      const userEmailMap = new Map<string, string>();
      (profilesData || []).forEach((p: any) => userEmailMap.set(p.id, p.email || "Unknown"));

      const transformed: UsageLog[] = (logsData || []).map((log: any) => ({
        id: log.id,
        user_id: log.user_id,
        model_id: log.model_id,
        function_name: log.function_name,
        input_tokens: log.input_tokens,
        output_tokens: log.output_tokens,
        embedding_tokens: log.embedding_tokens,
        estimated_cost: log.estimated_cost,
        created_at: log.created_at,
        user_email: userEmailMap.get(log.user_id) || "Unknown",
        model_name: log.ai_models?.name || "Unknown",
        provider_name: log.ai_models?.ai_providers?.name || "Unknown",
      }));
      setLogs(transformed);

      const totalTokens = transformed.reduce((s, l) => s + l.input_tokens + l.output_tokens + l.embedding_tokens, 0);
      const totalCost = transformed.reduce((s, l) => s + Number(l.estimated_cost), 0);
      setSummary({ totalTokens, totalCost, totalRequests: transformed.length, avgCostPerRequest: transformed.length > 0 ? totalCost / transformed.length : 0 });

      const provMap = new Map<string, { cost: number; requests: number }>();
      transformed.forEach((l) => {
        const p = l.provider_name || "Unknown";
        const ex = provMap.get(p) || { cost: 0, requests: 0 };
        provMap.set(p, { cost: ex.cost + Number(l.estimated_cost), requests: ex.requests + 1 });
      });
      setProviderUsage(Array.from(provMap.entries()).map(([provider, d]) => ({ provider, ...d })));

      const modelMap = new Map<string, number>();
      transformed.forEach((l) => modelMap.set(l.model_name || "Unknown", (modelMap.get(l.model_name || "Unknown") || 0) + 1));
      setModelUsage(Array.from(modelMap.entries()).map(([model, requests]) => ({ model, requests })).sort((a, b) => b.requests - a.requests));
    } catch (error: any) {
      toast.error("Failed to load usage analytics");
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = ["Date", "User", "Provider", "Model", "Function", "Input Tokens", "Output Tokens", "Embedding Tokens", "Cost"];
    const rows = logs.map((l) => [format(new Date(l.created_at), "yyyy-MM-dd HH:mm:ss"), l.user_email, l.provider_name, l.model_name, l.function_name || "N/A", l.input_tokens, l.output_tokens, l.embedding_tokens, l.estimated_cost.toFixed(6)]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai-usage-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Usage data exported to CSV");
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Select value={dateRange} onValueChange={(v: any) => setDateRange(v)}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="month">This month</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={exportToCSV}><Download className="mr-2 h-4 w-4" />Export CSV</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Cost</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">${summary.totalCost.toFixed(4)}</div><p className="text-xs text-muted-foreground">{dateRange === "7d" ? "Last 7 days" : dateRange === "30d" ? "Last 30 days" : "This month"}</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Tokens</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{summary.totalTokens.toLocaleString()}</div><p className="text-xs text-muted-foreground">Across all models</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Requests</CardTitle><Brain className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{summary.totalRequests.toLocaleString()}</div><p className="text-xs text-muted-foreground">API calls made</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Avg Cost/Request</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">${summary.avgCostPerRequest.toFixed(6)}</div><p className="text-xs text-muted-foreground">Per API call</p></CardContent></Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Cost by Provider</CardTitle><CardDescription>Breakdown of costs across AI providers</CardDescription></CardHeader>
          <CardContent><div className="space-y-4">{providerUsage.map((p) => { const pct = summary.totalCost > 0 ? (p.cost / summary.totalCost) * 100 : 0; return (<div key={p.provider} className="space-y-2"><div className="flex items-center justify-between text-sm"><span className="font-medium">{p.provider}</span><span className="text-muted-foreground">${p.cost.toFixed(4)} ({pct.toFixed(1)}%)</span></div><div className="h-2 w-full overflow-hidden rounded-full bg-secondary"><div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} /></div></div>); })}</div></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Model Popularity</CardTitle><CardDescription>Most frequently used models</CardDescription></CardHeader>
          <CardContent><div className="space-y-4">{modelUsage.slice(0, 5).map((m) => { const pct = summary.totalRequests > 0 ? (m.requests / summary.totalRequests) * 100 : 0; return (<div key={m.model} className="space-y-2"><div className="flex items-center justify-between text-sm"><span className="font-medium">{m.model}</span><span className="text-muted-foreground">{m.requests} calls ({pct.toFixed(1)}%)</span></div><div className="h-2 w-full overflow-hidden rounded-full bg-secondary"><div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} /></div></div>); })}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Detailed Usage Log</CardTitle><CardDescription>Recent AI usage across your platform</CardDescription></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>User</TableHead><TableHead>Provider</TableHead><TableHead>Model</TableHead><TableHead>Tokens</TableHead><TableHead>Cost</TableHead></TableRow></TableHeader>
            <TableBody>{logs.map((l) => (<TableRow key={l.id}><TableCell className="text-sm">{format(new Date(l.created_at), "MMM d, HH:mm")}</TableCell><TableCell className="text-sm">{l.user_email}</TableCell><TableCell><Badge variant="outline">{l.provider_name}</Badge></TableCell><TableCell className="text-sm font-medium">{l.model_name}</TableCell><TableCell className="text-sm">{(l.input_tokens + l.output_tokens + l.embedding_tokens).toLocaleString()}</TableCell><TableCell className="text-sm font-medium">${Number(l.estimated_cost).toFixed(6)}</TableCell></TableRow>))}</TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Agent Analytics Tab ──────────────────────────────────────────────────────

const DATE_RANGE_OPTIONS: { value: DateRangeDays; label: string }[] = [
  { value: 7, label: "Last 7 days" },
  { value: 30, label: "Last 30 days" },
  { value: 90, label: "Last 90 days" },
];

const COST_OPTIMIZATION_TIPS = [
  "Use Gemini 2.5 Flash for simple queries (99.9% cheaper than GPT-4)",
  "Use O3-mini for reasoning tasks instead of O1 (90% cheaper)",
  "Configure fallback chains to use cheaper models first",
  "Monitor token usage to identify optimization opportunities",
];

function AgentsTab() {
  const [dateRange, setDateRange] = useState<DateRangeDays>(30);
  const { data: analytics, isLoading } = useAgentAnalytics(dateRange);
  const dateLabel = DATE_RANGE_OPTIONS.find((o) => o.value === dateRange)?.label ?? "Last 30 days";

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Select value={String(dateRange)} onValueChange={(v) => setDateRange(Number(v) as DateRangeDays)}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Date range" /></SelectTrigger>
          <SelectContent>{DATE_RANGE_OPTIONS.map((opt) => (<SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>))}</SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {isLoading ? Array.from({ length: 5 }).map((_, i) => (<Card key={i}><CardHeader className="pb-2"><Skeleton className="h-4 w-20" /></CardHeader><CardContent><Skeleton className="h-8 w-16" /></CardContent></Card>)) : (
          <>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardDescription>{dateLabel}</CardDescription><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatCostMicro(analytics?.summary.totalCostMicro ?? 0)}</div><p className="text-xs text-muted-foreground">Total Cost</p></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardDescription>Agent executions</CardDescription><BarChart3 className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{analytics?.summary.totalRuns ?? 0}</div><p className="text-xs text-muted-foreground">Total Runs</p></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardDescription>Across all agents</CardDescription><Zap className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatTokens(analytics?.summary.totalTokens ?? 0)}</div><p className="text-xs text-muted-foreground">Total Tokens</p></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardDescription>Response time</CardDescription><Clock className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{analytics?.summary.avgLatencyMs != null ? `${analytics.summary.avgLatencyMs}ms` : "—"}</div><p className="text-xs text-muted-foreground">Avg Latency</p></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardDescription>Completion rate</CardDescription><CheckCircle2 className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold text-success dark:text-green-400">{(analytics?.summary.completionRatePct ?? 0).toFixed(1)}%</div><p className="text-xs text-muted-foreground">Completion rate</p></CardContent></Card>
          </>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Cost by Agent</h2>
        <p className="text-sm text-muted-foreground">Total cost and execution count for each agent</p>
        {isLoading ? <div className="space-y-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}</div> : (
          <div className="max-h-[500px] space-y-2 overflow-y-auto">
            {(analytics?.costByAgent ?? []).map((row) => (
              <Card key={row.agentId} className="transition-colors">
                <CardContent className="flex flex-row items-center justify-between p-4">
                  <div className="flex items-center gap-3"><div className="rounded-lg bg-primary/10 p-2"><BarChart3 className="h-4 w-4 text-primary" /></div><div><p className="font-medium">{row.agentName}</p><p className="text-sm text-muted-foreground">{row.runs} runs • {row.successRatePct.toFixed(1)}% success</p></div></div>
                  <div className="text-right"><p className="font-medium">{formatCostMicro(row.totalCostMicro)}</p><p className="text-sm text-muted-foreground">{formatCostMicro(row.costPerRunMicro)} / run</p></div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-xl font-bold tracking-tight">Cost by Provider & Model</h2>
        <p className="text-sm text-muted-foreground">Performance and cost comparison across AI providers</p>
        {isLoading ? <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-[72px] w-full rounded-lg" />)}</div> : (
          <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
            {(analytics?.costByProviderModel ?? []).map((row) => (
              <div key={`${row.provider}-${row.model}`} className="flex flex-row items-center justify-between rounded-lg border border-border bg-card px-4 py-3 shadow-sm">
                <div className="flex items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400"><Zap className="h-5 w-5" /></div><div className="min-w-0"><p className="font-medium text-foreground">{row.provider} - {row.model}</p><p className="text-sm text-muted-foreground">{row.runs} runs • {formatTokens(row.tokens)} tokens</p></div></div>
                <div className="shrink-0 text-right"><p className="font-semibold text-foreground">{formatCostMicro(row.totalCostMicro)}</p><p className="text-sm text-muted-foreground">{formatCostMicro(row.costPerRunMicro)} / run</p></div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Card className="border-success/30 bg-success/10 dark:border-green-900/50 dark:bg-green-950/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 font-medium text-success dark:text-green-200"><TrendingUp className="h-4 w-4" />Cost Optimization Tips:</div>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-success/90 dark:text-green-200/90">{COST_OPTIMIZATION_TIPS.map((tip, i) => <li key={i}>{tip}</li>)}</ul>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function AIAnalytics() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Analytics</h1>
        <p className="text-muted-foreground">
          Unified view of AI usage costs, token consumption, and agent performance
        </p>
      </div>

      <Tabs defaultValue="usage">
        <TabsList>
          <TabsTrigger value="usage">Usage Analytics</TabsTrigger>
          <TabsTrigger value="agents">Agent Analytics</TabsTrigger>
        </TabsList>
        <TabsContent value="usage" className="mt-6">
          <UsageTab />
        </TabsContent>
        <TabsContent value="agents" className="mt-6">
          <AgentsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
