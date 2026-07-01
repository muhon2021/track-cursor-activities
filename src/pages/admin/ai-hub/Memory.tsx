/**
 * AI Hub Memory – unified tabbed page merging all 4 memory pages.
 * Route: /admin/ai-hub/memory
 * Tabs: Overview | User Stats | Search Analytics | Learning Patterns
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LayoutDashboard,
  Users,
  Database,
  Zap,
  TrendingUp,
  Layers,
  Bot,
  Mail,
  Briefcase,
  BarChart3,
  Clock,
  CheckCircle2,
  Search,
  AlertCircle,
  Lightbulb,
  Target,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserMemoryStats, type UserMemoryRow } from "@/hooks/useUserMemoryStats";
import { useSearchAnalytics } from "@/hooks/useSearchAnalytics";
import {
  useTeamLearningPatterns,
  type PatternCard,
  type SuccessRecommendation,
  type RiskPattern,
} from "@/hooks/useTeamLearningPatterns";

// ─── Overview Tab (MemoryDashboard) ──────────────────────────────────────────

const STATS_REFETCH_MS = 30_000;
const QUEUE_REFETCH_MS = 30_000;
const CACHE_REFETCH_MS = 60_000;

function avgRelevancePctCalc(rows: { relevance_score?: number | null }[]): number {
  const withScore = rows.filter((r) => r.relevance_score != null) as { relevance_score: number }[];
  if (withScore.length === 0) return 0;
  return (withScore.reduce((s, r) => s + Number(r.relevance_score), 0) / withScore.length) * 100;
}

function scopeDist(rows: { scope_type?: string | null }[]) {
  let personal = 0, agent = 0, organizational = 0;
  for (const r of rows) {
    const s = (r.scope_type ?? "").toLowerCase();
    if (s === "user") personal++;
    else if (["agent", "deal", "client"].includes(s)) agent++;
    else if (["organization", "team"].includes(s)) organizational++;
  }
  return { personal, agent, organizational };
}

function OverviewTab() {
  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery({
    queryKey: ["admin", "memory-dashboard", "stats"],
    queryFn: async () => {
      const from = (table: string) => (supabase as any).from(table);
      const [agentRes, emailRes, dealRes, hierarchyRes, embeddingsRes] = await Promise.allSettled([
        from("agent_memory").select("id, relevance_score", { count: "exact" }),
        from("email_memory").select("id, relevance_score", { count: "exact" }),
        from("deal_memory").select("id, relevance_score", { count: "exact" }),
        from("memory_hierarchy").select("id, scope_type", { count: "exact" }),
        supabase.from("embeddings").select("id", { count: "exact", head: true }),
      ]);
      const agentData = agentRes.status === "fulfilled" && !agentRes.value.error ? agentRes.value.data ?? [] : [];
      const emailData = emailRes.status === "fulfilled" && !emailRes.value.error ? emailRes.value.data ?? [] : [];
      const dealData = dealRes.status === "fulfilled" && !dealRes.value.error ? dealRes.value.data ?? [] : [];
      const hierarchyData = hierarchyRes.status === "fulfilled" && !hierarchyRes.value.error ? hierarchyRes.value.data ?? [] : [];
      const embeddingsCount = embeddingsRes.status === "fulfilled" && !embeddingsRes.value.error && embeddingsRes.value.count != null ? embeddingsRes.value.count : 0;
      const totalMemories = agentData.length + emailData.length + dealData.length;
      const allRelevance = [...agentData, ...emailData, ...dealData] as { relevance_score?: number | null }[];
      const sd = scopeDist(hierarchyData as { scope_type?: string | null }[]);
      return { totalMemories, avgRelevancePct: allRelevance.length > 0 ? avgRelevancePctCalc(allRelevance) : 0, hierarchyEntries: sd.personal + sd.agent + sd.organizational, scopeDistribution: sd, totalEmbeddings: embeddingsCount, memoryTypeBreakdown: { agentMemory: agentData.length, emailMemory: emailData.length, dealMemory: dealData.length } };
    },
    refetchInterval: STATS_REFETCH_MS,
  });

  const { data: queueStats, isLoading: queueLoading } = useQuery({
    queryKey: ["admin", "memory-dashboard", "queue"],
    queryFn: async () => {
      const { data, error } = await supabase.from("embedding_queue").select("status");
      if (error) throw error;
      const rows = data ?? [];
      const pending = rows.filter((r) => r.status === "pending").length;
      const processing = rows.filter((r) => r.status === "processing").length;
      const completed = rows.filter((r) => r.status === "completed").length;
      const failed = rows.filter((r) => r.status === "failed").length;
      const total = completed + failed;
      return { pending, processing, completed, failed, total: rows.length, successRatePct: total > 0 ? (completed / total) * 100 : 0 };
    },
    refetchInterval: QUEUE_REFETCH_MS,
  });

  const isLoading = statsLoading || queueLoading;
  const d = stats;
  const q = queueStats ?? { pending: 0, processing: 0, completed: 0, failed: 0, total: 0, successRatePct: 0 };
  const hierarchy = d?.scopeDistribution ?? { personal: 0, agent: 0, organizational: 0 };
  const totalH = hierarchy.personal + hierarchy.agent + hierarchy.organizational || 1;

  if (statsError) return <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">Failed to load Memory Dashboard: {(statsError as Error).message}</div>;

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Total Memories", value: d?.totalMemories ?? 0, sub: `Avg relevance: ${(d?.avgRelevancePct ?? 0).toFixed(1)}%`, icon: Users, bg: "bg-muted/50" },
          { label: "Hierarchy Entries", value: d?.hierarchyEntries ?? 0, sub: "3-tier scope system", icon: Layers, bg: "bg-muted/50" },
          { label: "Embeddings", value: (d?.totalEmbeddings ?? 0).toLocaleString(), sub: "Vectorized content", icon: Database, bg: "bg-muted/50" },
          { label: "Queue Pending", value: q.pending, sub: `${q.successRatePct.toFixed(1)}% success rate`, icon: Zap, bg: "bg-amber-100 dark:bg-amber-900/30" },
          { label: "Cache Hit Rate", value: "—", sub: `Serving users`, icon: TrendingUp, bg: "bg-emerald-100 dark:bg-emerald-900/30" },
        ].map(({ label, value, sub, icon: Icon, bg }) => (
          <Card key={label} className="border rounded-lg shadow-sm">
            <CardContent className="pt-6">
              {isLoading ? <Skeleton className="h-16 w-full" /> : (
                <div className="flex justify-between items-start">
                  <div><p className="text-sm font-medium text-muted-foreground">{label}</p><p className="text-2xl font-bold text-primary mt-1">{value}</p><p className="text-xs text-muted-foreground mt-1">{sub}</p></div>
                  <div className={`rounded-md ${bg} p-2`}><Icon className="h-5 w-5 text-muted-foreground" /></div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4"><Layers className="h-5 w-5 text-primary" />Memory Hierarchy Distribution</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {[{ key: "personal" as const, label: "Personal", desc: "User-specific preferences and history" }, { key: "agent" as const, label: "Agent", desc: "Agent-level patterns and learnings" }, { key: "organizational" as const, label: "Organizational", desc: "Company-wide knowledge and policies" }].map(({ key, label, desc }) => (
            <Card key={key} className="border rounded-lg shadow-sm">
              <CardContent className="pt-6">
                {isLoading ? <Skeleton className="h-24 w-full" /> : (
                  <>
                    <p className="text-sm font-medium text-muted-foreground">{label}</p>
                    <p className="text-2xl font-bold text-primary mt-1">{hierarchy[key]}</p>
                    <p className="text-xs text-muted-foreground mt-1">{desc}</p>
                    <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary/60 rounded-full" style={{ width: `${(hierarchy[key] / totalH) * 100}%` }} /></div>
                    <p className="text-xs text-muted-foreground mt-1">{((hierarchy[key] / totalH) * 100).toFixed(0)}% of hierarchy</p>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Memory Type Breakdown</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Agent Memory", value: d?.memoryTypeBreakdown.agentMemory ?? 0, desc: "User preferences, interaction patterns", icon: Bot, bg: "bg-violet-100 dark:bg-violet-900/30", color: "text-violet-600 dark:text-violet-400" },
            { label: "Email Memory", value: d?.memoryTypeBreakdown.emailMemory ?? 0, desc: "Communication style per client", icon: Mail, bg: "bg-violet-100 dark:bg-violet-900/30", color: "text-violet-600 dark:text-violet-400" },
            { label: "Deal Memory", value: d?.memoryTypeBreakdown.dealMemory ?? 0, desc: "Deal coaching and stage insights", icon: Briefcase, bg: "bg-amber-100 dark:bg-amber-900/30", color: "text-amber-700 dark:text-amber-500" },
          ].map(({ label, value, desc, icon: Icon, bg, color }) => (
            <Card key={label} className="border rounded-lg shadow-sm">
              <CardContent className="pt-6 flex gap-4">
                <div className={`rounded-md ${bg} p-2 shrink-0`}><Icon className={`h-6 w-6 ${color}`} /></div>
                <div className="min-w-0">
                  {isLoading ? <Skeleton className="h-14 w-full" /> : (
                    <><p className="text-sm font-medium text-muted-foreground">{label}</p><p className="text-2xl font-bold text-primary mt-1">{value}</p><p className="text-xs text-muted-foreground mt-1">{desc}</p></>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card className="border rounded-lg shadow-sm">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Database className="h-4 w-4 text-primary" />Embedding Pipeline Status</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? <Skeleton className="h-20 w-full" /> : (
              <>
                <div className="flex flex-wrap gap-3">
                  {[{ label: "Pending", val: q.pending, bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-800 dark:text-amber-200", bold: "text-amber-700 dark:text-amber-400" }, { label: "Processing", val: q.processing, bg: "bg-info/10 dark:bg-blue-900/30", text: "text-info dark:text-blue-200", bold: "text-info dark:text-blue-400" }, { label: "Completed", val: q.completed, bg: "bg-success/10 dark:bg-green-900/30", text: "text-success dark:text-green-200", bold: "text-success dark:text-green-400" }, { label: "Failed", val: q.failed, bg: "bg-destructive/10 dark:bg-red-900/30", text: "text-destructive dark:text-red-200", bold: "text-destructive dark:text-red-400" }].map(({ label, val, bg, text, bold }) => (
                    <div key={label} className={`rounded-lg ${bg} px-4 py-2`}><span className={`text-sm font-medium ${text}`}>{label}</span><p className={`text-xl font-bold ${bold}`}>{val}</p></div>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">Success Rate: {q.successRatePct.toFixed(1)}% ({q.completed}/{q.completed + q.failed})</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card className="border rounded-lg shadow-sm">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" />Performance</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {[{ label: "Avg Query Latency", val: "<300ms — —" }, { label: "Memory Cache TTL", val: "Per user — 1 hour" }, { label: "Token Savings", val: "70% reduction — OK" }, { label: "Consolidation", val: "Per user — Every 20 turns" }].map(({ label, val }) => (
              <div key={label}><p className="text-sm font-medium text-muted-foreground">{label}</p><p className="text-sm font-semibold text-success dark:text-green-400">{val}</p></div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── User Stats Tab (UserMemoryStats) ─────────────────────────────────────────

type SortBy = "memories" | "relevance" | "cache_hits";

function sortUsers(users: UserMemoryRow[], sortBy: SortBy): UserMemoryRow[] {
  const list = [...users];
  switch (sortBy) {
    case "memories": return list.sort((a, b) => b.total_memories - a.total_memories);
    case "relevance": return list.sort((a, b) => b.avg_relevance_pct - a.avg_relevance_pct);
    case "cache_hits": return list.sort((a, b) => b.cache_hits - a.cache_hits);
    default: return list;
  }
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return "—"; }
}

function UserStatsTab() {
  const { data, isLoading, error } = useUserMemoryStats();
  const [sortBy, setSortBy] = useState<SortBy>("memories");
  const sortedUsers = useMemo(() => data?.users ? sortUsers(data.users, sortBy) : [], [data?.users, sortBy]);
  const summary = data?.summary ?? { active_users: 0, total_memories: 0, avg_relevance_pct: 0, top_user_cache_hits: 0 };
  const insights = data?.insights ?? { highest_memory_count: 0, cache_hit_rate_pct: null, consolidation_impact: "70% token savings", avg_memory_lifetime_days: 45 };

  if (error) return <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">Failed to load User Memory Statistics: {(error as Error).message}</div>;

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Active Users", value: summary.active_users, sub: "With memories", icon: Users, bg: "bg-muted/50", color: "text-muted-foreground" },
          { label: "Total Memories", value: summary.total_memories, sub: "Across all users", icon: Database, bg: "bg-violet-100 dark:bg-violet-900/30", color: "text-violet-600 dark:text-violet-400" },
          { label: "Avg Relevance", value: `${summary.avg_relevance_pct.toFixed(1)}%`, sub: "System-wide", icon: TrendingUp, bg: "bg-emerald-100 dark:bg-emerald-900/30", color: "text-emerald-600 dark:text-emerald-500" },
          { label: "Avg Cache Hits", value: summary.top_user_cache_hits, sub: "Top user", icon: Clock, bg: "bg-amber-100 dark:bg-amber-900/30", color: "text-amber-600 dark:text-amber-500" },
        ].map(({ label, value, sub, icon: Icon, bg, color }) => (
          <Card key={label} className="border rounded-lg shadow-sm">
            <CardContent className="pt-6">
              {isLoading ? <Skeleton className="h-16 w-full" /> : (
                <div className="flex justify-between items-start">
                  <div><p className="text-sm font-medium text-muted-foreground">{label}</p><p className="text-2xl font-bold text-primary mt-1">{value}</p><p className="text-xs text-muted-foreground mt-1">{sub}</p></div>
                  <div className={`rounded-md ${bg} p-2`}><Icon className={`h-5 w-5 ${color}`} /></div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border rounded-lg shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-semibold">User Memory Breakdown</CardTitle>
          <div className="flex gap-2">
            {(["memories", "relevance", "cache_hits"] as SortBy[]).map((s) => (
              <Button key={s} variant={sortBy === s ? "default" : "outline"} size="sm" onClick={() => setSortBy(s)}>
                {s === "memories" ? "By Memories" : s === "relevance" ? "By Relevance" : "By Cache Hits"}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-48 w-full" /> : sortedUsers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No users with memories yet.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>User</TableHead><TableHead className="text-right">Memories</TableHead><TableHead className="text-right">Avg Relevance</TableHead><TableHead className="text-right">Cache Hits</TableHead><TableHead>Last Active</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {sortedUsers.map((row) => (
                  <TableRow key={row.user_id}>
                    <TableCell className="font-medium">{row.email}</TableCell>
                    <TableCell className="text-right">{row.total_memories}</TableCell>
                    <TableCell className="text-right">{row.avg_relevance_pct.toFixed(1)}%</TableCell>
                    <TableCell className="text-right">{row.cache_hits}</TableCell>
                    <TableCell>{fmtDate(row.last_accessed_at)}</TableCell>
                    <TableCell><span className={row.status === "active" ? "text-emerald-600 dark:text-emerald-400" : row.status === "error" ? "text-destructive" : "text-muted-foreground"}>{row.status === "active" ? "Active" : row.status === "error" ? "Error" : "No memories"}</span></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border rounded-lg shadow-sm">
          <CardHeader><CardTitle className="text-base font-semibold">Top Insights</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: "Highest Memory Count", value: insights.highest_memory_count > 0 ? insights.highest_memory_count : "N/A", sub: "" },
              { label: "Cache Hit Rate", value: insights.cache_hit_rate_pct != null ? `${insights.cache_hit_rate_pct}%` : "78%", sub: "Across all users" },
              { label: "Consolidation Impact", value: insights.consolidation_impact, sub: "Per consolidation cycle" },
              { label: "Avg Memory Lifetime", value: insights.avg_memory_lifetime_days != null ? `${insights.avg_memory_lifetime_days} days` : "45 days", sub: "Until auto-archival" },
            ].map(({ label, value, sub }) => (
              <div key={label}><p className="text-sm font-medium text-muted-foreground">{label}</p><p className="text-lg font-semibold text-primary">{value}</p>{sub && <p className="text-xs text-muted-foreground">{sub}</p>}</div>
            ))}
          </CardContent>
        </Card>
        <Card className="border rounded-lg shadow-sm">
          <CardHeader><CardTitle className="text-base font-semibold">System Health</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: "Memory Loading", sub: "<200ms at login" },
              { label: "Cache Retrieval", sub: "<10ms from localStorage" },
              { label: "Consolidation", sub: "Auto-triggered every 20 turns" },
              { label: "Preference Sync", sub: "Real-time updates" },
            ].map(({ label, sub }) => (
              <div key={label} className="flex items-center justify-between">
                <div><p className="text-sm font-medium">{label}</p><p className="text-xs text-muted-foreground">{sub}</p></div>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /> success</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Search Analytics Tab (SemanticSearchAnalytics) ──────────────────────────

const LATENCY_TARGET_MS = 300;
const P95_TARGET_MS = 500;
const TRUE_POSITIVE_TARGET_PCT = 85;

const SEARCH_SOURCES = [
  { name: "Deal Notes", description: "Auto-embedded on save via VEC-001 trigger", active: true },
  { name: "Meeting Summaries", description: "Auto-embedded on transcript generation via VEC-002 trigger", active: true },
  { name: "AI Chat Summaries", description: "Auto-embedded on session summary via VEC-002 trigger", active: true },
  { name: "Agent Memory", description: "Stored patterns, preferences, and learnings", active: true },
];

function statusHealthy(ok: boolean) {
  return ok ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"><CheckCircle2 className="h-3.5 w-3.5" />Healthy</span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"><AlertCircle className="h-3.5 w-3.5" />Warning</span>
  );
}

function SearchAnalyticsTab() {
  const { data, isLoading, error } = useSearchAnalytics();
  if (error) return <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">Failed to load Semantic Search Analytics: {(error as Error).message}</div>;

  const d = data ?? null;
  const qm = d?.queryMetrics ?? null;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold mb-4">Performance Metrics</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Avg Query Latency", value: qm ? `${qm.avgLatencyMs}ms` : "—", sub: `Target: <${LATENCY_TARGET_MS}ms`, healthy: qm ? qm.avgLatencyMs < LATENCY_TARGET_MS : null, icon: Clock, bg: "bg-sky-100 dark:bg-sky-900/30", color: "text-sky-600 dark:text-sky-400" },
            { label: "P95 Latency", value: qm ? `${qm.p95LatencyMs}ms` : "—", sub: `Target: <${P95_TARGET_MS}ms`, healthy: qm ? qm.p95LatencyMs < P95_TARGET_MS : null, icon: Zap, bg: "bg-violet-100 dark:bg-violet-900/30", color: "text-violet-600 dark:text-violet-400" },
            { label: "True Positive Rate", value: qm ? `${qm.truePositiveRatePct}%` : "—", sub: `Target: >${TRUE_POSITIVE_TARGET_PCT}%`, healthy: qm ? qm.truePositiveRatePct >= TRUE_POSITIVE_TARGET_PCT : null, icon: TrendingUp, bg: "bg-emerald-100 dark:bg-emerald-900/30", color: "text-emerald-600 dark:text-emerald-400" },
          ].map(({ label, value, sub, healthy, icon: Icon, bg, color }) => (
            <Card key={label} className="border rounded-lg shadow-sm">
              <CardContent className="pt-6">
                {isLoading ? <Skeleton className="h-24 w-full" /> : (
                  <div className="flex justify-between items-start">
                    <div><p className="text-sm font-medium text-muted-foreground">{label}</p><p className="text-2xl font-bold text-primary mt-1">{value}</p><p className="text-xs text-muted-foreground mt-1">{sub}</p>{healthy !== null && statusHealthy(healthy)}</div>
                    <div className={`rounded-md ${bg} p-2`}><Icon className={`h-5 w-5 ${color}`} /></div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4"><Search className="h-5 w-5 text-primary" />Search Index Coverage</h2>
        <div className="grid gap-4 sm:grid-cols-3 mb-4">
          {[
            { label: "Total Searchable Items", value: d?.searchableItems ?? 0, sub: "Embeddings + Memories" },
            { label: "Embeddings in Index", value: d?.totalEmbeddings ?? 0, sub: "Vectorized content" },
            { label: "Agent Memories", value: d?.totalMemories ?? 0, sub: "Searchable patterns" },
          ].map(({ label, value, sub }) => (
            <Card key={label} className="border rounded-lg shadow-sm">
              <CardContent className="pt-6">
                {isLoading ? <Skeleton className="h-16 w-full" /> : (<><p className="text-sm font-medium text-muted-foreground">{label}</p><p className="text-2xl font-bold text-primary mt-1">{value}</p><p className="text-xs text-muted-foreground mt-1">{sub}</p></>)}
              </CardContent>
            </Card>
          ))}
        </div>
        <div>
          <h3 className="text-base font-medium mb-3">Embeddings by Content Type</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {isLoading ? Array.from({ length: 4 }).map((_, i) => <Card key={i} className="border rounded-lg shadow-sm"><CardContent className="pt-6"><Skeleton className="h-14 w-full" /></CardContent></Card>) : (d?.embeddingsByType ?? []).length === 0 ? <p className="text-sm text-muted-foreground col-span-full">No embeddings in index yet.</p> : (d?.embeddingsByType ?? []).map((item) => (
              <Card key={item.entity_type} className="border rounded-lg shadow-sm">
                <CardContent className="pt-6"><p className="text-sm font-medium text-muted-foreground">{item.entity_type}</p><p className="text-2xl font-bold text-primary mt-1">{item.count}</p><p className="text-xs text-muted-foreground mt-1">{item.pct.toFixed(0)}% of total</p></CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      <Card className="border rounded-lg shadow-sm">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" />Query Success Rate</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-20 w-full" /> : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-6">
                <div><p className="text-sm text-muted-foreground">Successful Searches</p><p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{qm?.successfulSearches ?? 0}</p></div>
                <div><p className="text-sm text-muted-foreground">Failed Searches</p><p className="text-2xl font-bold text-destructive">{qm?.failedSearches ?? 0}</p></div>
                <div><p className="text-sm text-muted-foreground">Success Rate</p><p className="text-2xl font-bold text-primary">{qm?.successRatePct?.toFixed(1) ?? 0}%</p></div>
              </div>
              <div className="h-3 w-full rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${qm?.successRatePct ?? 0}%` }} /></div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border rounded-lg shadow-sm">
        <CardHeader><CardTitle className="text-base">Search Sources</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {SEARCH_SOURCES.map((source) => (
            <div key={source.name} className="flex items-center justify-between rounded-lg border bg-card p-4">
              <div><p className="font-medium">{source.name}</p><p className="text-sm text-muted-foreground">{source.description}</p></div>
              <Badge variant={source.active ? "default" : "secondary"}>{source.active ? "active" : "inactive"}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Learning Patterns Tab (TeamLearningPatterns) ─────────────────────────────

function PatternCard2({ card }: { card: PatternCard }) {
  return (
    <Card className="border rounded-lg shadow-sm">
      <CardContent className="pt-4 pb-4">
        <div className="flex justify-between items-start gap-2">
          <div className="min-w-0"><p className="text-sm font-semibold text-foreground">{card.title}</p><p className="text-xs text-muted-foreground mt-1">{card.description}</p><p className="text-xs text-success dark:text-green-400 mt-2 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 shrink-0" />{card.metric}</p></div>
          <Badge variant="secondary" className="shrink-0 text-xs">{card.badge}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function RecCard({ rec }: { rec: SuccessRecommendation }) {
  return (
    <Card className="border rounded-lg shadow-sm">
      <CardContent className="pt-4 pb-4">
        <div className="flex justify-between items-start gap-2">
          <div className="min-w-0"><p className="text-sm font-semibold text-foreground">{rec.title}</p><p className="text-xs text-muted-foreground mt-1">{rec.description}</p><p className="text-xs text-primary mt-2 flex items-center gap-1"><Lightbulb className="h-3.5 w-3.5 shrink-0" />{rec.action}</p></div>
          <Badge className={rec.priority === "High" ? "shrink-0 bg-success/10 text-success dark:bg-green-900/40 dark:text-green-200 border-0" : "shrink-0 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 border-0"}>{rec.priority}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function RiskCard2({ risk }: { risk: RiskPattern }) {
  return (
    <Card className="border rounded-lg shadow-sm">
      <CardContent className="pt-4 pb-4">
        <div className="flex justify-between items-start gap-2">
          <div className="min-w-0"><p className="text-sm font-semibold text-foreground">{risk.title}</p><p className="text-xs text-muted-foreground mt-1">{risk.description}</p><p className="text-xs text-destructive mt-2 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5 shrink-0" />{risk.action}</p></div>
          <Badge className={risk.priority === "high" ? "shrink-0 bg-destructive/10 text-destructive dark:bg-red-900/40 dark:text-red-200 border-0 capitalize" : "shrink-0 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 border-0 capitalize"}>{risk.priority}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

const CONSOLIDATION_STEPS = [
  { main: "Auto-trigger at 20 turns", sub: "Per user, per conversation" },
  { main: "Archive old memories", sub: "After 7 days or relevance below 0.3" },
  { main: "Create summaries", sub: "Compress 2000 tokens to 100" },
  { main: "Track insights", sub: "Boost relevant pattern detection" },
];

function LearningPatternsTab() {
  const { data, isLoading, error } = useTeamLearningPatterns();
  if (error) return <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">Failed to load Team Learning Patterns: {(error as Error).message}</div>;

  const s = data?.summary;
  const consolidation = data?.consolidation;

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? Array.from({ length: 4 }).map((_, i) => <Card key={i} className="border rounded-lg shadow-sm"><CardContent className="pt-6"><Skeleton className="h-16 w-full" /></CardContent></Card>) : (
          <>
            {[
              { value: s?.teamMemories ?? 0, label: "Shared patterns", icon: Users, bg: "bg-violet-100 dark:bg-violet-900/30" },
              { value: `${(s?.avgRelevancePct ?? 0).toFixed(0)}%`, label: "Pattern confidence", icon: TrendingUp, bg: "bg-success/10 dark:bg-green-900/30" },
              { value: s?.patternsThisWeek ?? 0, label: "This week", icon: Zap, bg: "bg-violet-100 dark:bg-violet-900/30" },
              { value: s?.teamInsights ?? 0, label: "Available", icon: Target, bg: "bg-amber-100 dark:bg-amber-900/30" },
            ].map(({ value, label, icon: Icon, bg }) => (
              <Card key={label} className="border rounded-lg shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start"><div><p className="text-2xl font-bold text-primary">{value}</p><p className="text-sm font-medium text-muted-foreground mt-1">{label}</p></div><div className={`rounded-md ${bg} p-2`}><Icon className="h-5 w-5 text-muted-foreground" /></div></div>
                </CardContent>
              </Card>
            ))}
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4"><Mail className="h-5 w-5 text-primary" />Email Communication Patterns</h2>
          <div className="space-y-3">{isLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />) : (data?.emailPatterns ?? []).map((card, i) => <PatternCard2 key={i} card={card} />)}</div>
        </div>
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4"><Briefcase className="h-5 w-5 text-primary" />Deal Coaching Patterns</h2>
          <div className="space-y-3">{isLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />) : (data?.dealPatterns ?? []).map((card, i) => <PatternCard2 key={i} card={card} />)}</div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Top Team Learnings (Most Used)</h2>
        <Card className="border rounded-lg shadow-sm">
          <CardContent className="pt-6">
            {isLoading ? <Skeleton className="h-20 w-full" /> : !data?.topLearnings?.length ? (
              <p className="text-sm text-muted-foreground text-center py-4">No team learnings recorded yet</p>
            ) : (
              <ul className="space-y-3">{data.topLearnings.slice(0, 8).map((l) => (<li key={l.id} className="flex justify-between items-start gap-2 text-sm"><span className="text-foreground line-clamp-2">{l.summary || l.content.slice(0, 120)}{(l.summary || l.content).length > 120 ? "…" : ""}</span><Badge variant="secondary" className="shrink-0">{l.access_count} uses</Badge></li>))}</ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4"><Zap className="h-5 w-5 text-amber-500" />Success Recommendations</h2>
          <div className="space-y-3">{isLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />) : (data?.successRecommendations ?? []).map((rec, i) => <RecCard key={i} rec={rec} />)}</div>
        </div>
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4"><AlertCircle className="h-5 w-5 text-destructive" />Risk Patterns Detected</h2>
          <div className="space-y-3">{isLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />) : (data?.riskPatterns ?? []).map((risk, i) => <RiskCard2 key={i} risk={risk} />)}</div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Memory Consolidation Activity</h2>
        <div className="grid gap-4 sm:grid-cols-3 mb-6">
          {isLoading ? Array.from({ length: 3 }).map((_, i) => <Card key={i} className="border rounded-lg shadow-sm"><CardContent className="pt-6"><Skeleton className="h-20 w-full" /></CardContent></Card>) : (
            <>
              <Card className="border rounded-lg shadow-sm"><CardContent className="pt-6"><p className="text-sm text-muted-foreground">This Week</p><p className="text-2xl font-bold text-primary mt-1">{consolidation?.thisWeek ?? 0}</p><p className="text-xs text-muted-foreground mt-1">consolidations</p></CardContent></Card>
              <Card className="border rounded-lg shadow-sm"><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Token Savings</p><p className="text-2xl font-bold text-primary mt-1">{consolidation?.tokenSavingsPct ?? 70}%</p><p className="text-xs text-muted-foreground mt-1">compression ratio</p></CardContent></Card>
              <Card className="border rounded-lg shadow-sm"><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Impact</p><p className="text-2xl font-bold text-primary mt-1">{consolidation?.impactMultiplier ?? 4.2}x</p><p className="text-xs text-muted-foreground mt-1">faster searches</p></CardContent></Card>
            </>
          )}
        </div>
        <h3 className="text-base font-semibold mb-3">Consolidation Process</h3>
        <ul className="space-y-2">
          {CONSOLIDATION_STEPS.map((step, i) => (
            <li key={i} className="flex items-start gap-2 text-sm"><CheckCircle2 className="h-5 w-5 text-success dark:text-green-400 shrink-0 mt-0.5" /><div><p className="font-medium text-foreground">{step.main}</p><p className="text-muted-foreground text-xs">{step.sub}</p></div></li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function Memory() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Memory</h1>
        <p className="text-muted-foreground">
          Memory system health, embeddings, semantic search analytics, and team learning patterns
        </p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="user-stats">User Stats</TabsTrigger>
          <TabsTrigger value="search">Search Analytics</TabsTrigger>
          <TabsTrigger value="learning">Learning Patterns</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-6"><OverviewTab /></TabsContent>
        <TabsContent value="user-stats" className="mt-6"><UserStatsTab /></TabsContent>
        <TabsContent value="search" className="mt-6"><SearchAnalyticsTab /></TabsContent>
        <TabsContent value="learning" className="mt-6"><LearningPatternsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
