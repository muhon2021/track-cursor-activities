/**
 * Agent Analytics: cost and performance metrics for AI agents.
 * Used by /admin/ai/agent-analytics (overview and detail).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/cache";
import { cacheConfig } from "@/lib/cache";

export type DateRangeDays = 7 | 30 | 90;

export interface AgentAnalyticsSummary {
  totalCostMicro: number;
  totalRuns: number;
  totalTokens: number;
  avgLatencyMs: number | null;
  completionRatePct: number;
}

export interface AgentCostRow {
  agentId: string;
  agentName: string;
  runs: number;
  successRatePct: number;
  totalCostMicro: number;
  costPerRunMicro: number;
}

export interface ProviderModelRow {
  provider: string;
  model: string;
  runs: number;
  tokens: number;
  totalCostMicro: number;
  costPerRunMicro: number;
}

export interface AgentAnalyticsData {
  summary: AgentAnalyticsSummary;
  costByAgent: AgentCostRow[];
  costByProviderModel: ProviderModelRow[];
}

export interface AgentAnalyticsDetailData {
  agentId: string;
  agentName: string;
  runs: number;
  successRatePct: number;
  totalCostMicro: number;
  costPerRunMicro: number;
  costByProviderModel: ProviderModelRow[];
}

function dateRange(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  return { from: from.toISOString(), to: to.toISOString() };
}

async function fetchAgentAnalytics(days: number): Promise<AgentAnalyticsData> {
  const { from, to } = dateRange(days);

  const { data: runs, error } = await supabase
    .from("ai_agent_runs")
    .select(
      `
      id,
      agent_id,
      status,
      latency_ms,
      provider_used,
      model_used,
      token_metrics,
      ai_agents!inner(name)
    `
    )
    .gte("created_at", from)
    .lt("created_at", to);

  if (error) throw error;

  const rows = runs ?? [];
  const totalRuns = rows.length;
  let totalTokens = 0;
  let completedCount = 0;
  let latencySum = 0;
  let latencyCount = 0;
  const agentMap = new Map<
    string,
    { name: string; runs: number; completed: number; tokens: number }
  >();

  for (const r of rows) {
    const agent = r.ai_agents as { name?: string } | null;
    const name = agent?.name ?? "Unknown";
    if (!agentMap.has(r.agent_id)) {
      agentMap.set(r.agent_id, { name, runs: 0, completed: 0, tokens: 0 });
    }
    const rec = agentMap.get(r.agent_id)!;
    rec.runs += 1;
    if (r.status === "completed" || r.status === "success") {
      completedCount += 1;
      rec.completed += 1;
    }
    const metrics = r.token_metrics as { total_tokens?: number } | null;
    if (metrics?.total_tokens != null) {
      const t = Number(metrics.total_tokens);
      totalTokens += t;
      rec.tokens += t;
    }
    if (r.latency_ms != null) {
      latencySum += Number(r.latency_ms);
      latencyCount += 1;
    }
  }

  const costByAgent: AgentCostRow[] = Array.from(agentMap.entries()).map(
    ([agentId, { name, runs: agentRuns, completed, tokens }]) => {
      const totalCostMicro = 0; // No cost in DB yet
      return {
        agentId,
        agentName: name,
        runs: agentRuns,
        successRatePct: agentRuns ? (100 * completed) / agentRuns : 0,
        totalCostMicro,
        costPerRunMicro: agentRuns ? totalCostMicro / agentRuns : 0,
      };
    }
  );

  // Sort by runs descending
  costByAgent.sort((a, b) => b.runs - a.runs);

  const providerModelMap = new Map<
    string,
    { runs: number; tokens: number }
  >();
  for (const r of rows) {
    const provider = r.provider_used ?? "unknown";
    const model = r.model_used ?? "unknown";
    const key = `${provider} - ${model}`;
    if (!providerModelMap.has(key)) {
      providerModelMap.set(key, { runs: 0, tokens: 0 });
    }
    const rec = providerModelMap.get(key)!;
    rec.runs += 1;
    const metrics = r.token_metrics as { total_tokens?: number } | null;
    if (metrics?.total_tokens != null) rec.tokens += Number(metrics.total_tokens);
  }

  const costByProviderModel: ProviderModelRow[] = Array.from(
    providerModelMap.entries()
  ).map(([key, { runs: runCount, tokens }]) => {
    const [provider, model] = key.split(" - ");
    const totalCostMicro = 0;
    return {
      provider: provider ?? "unknown",
      model: model ?? "unknown",
      runs: runCount,
      tokens,
      totalCostMicro,
      costPerRunMicro: runCount ? totalCostMicro / runCount : 0,
    };
  });
  costByProviderModel.sort((a, b) => b.runs - a.runs);

  const summary: AgentAnalyticsSummary = {
    totalCostMicro: 0,
    totalRuns,
    totalTokens,
    avgLatencyMs: latencyCount ? Math.round(latencySum / latencyCount) : null,
    completionRatePct: totalRuns ? (100 * completedCount) / totalRuns : 0,
  };

  return { summary, costByAgent, costByProviderModel };
}

async function fetchAgentAnalyticsDetail(
  agentId: string,
  days: number
): Promise<AgentAnalyticsDetailData | null> {
  const { from, to } = dateRange(days);

  const { data: agent } = await supabase
    .from("ai_agents")
    .select("id, name")
    .eq("id", agentId)
    .single();

  if (!agent) return null;

  const { data: runs, error } = await supabase
    .from("ai_agent_runs")
    .select("id, status, latency_ms, provider_used, model_used, token_metrics")
    .eq("agent_id", agentId)
    .gte("created_at", from)
    .lt("created_at", to);

  if (error) throw error;

  const rows = runs ?? [];
  const totalRuns = rows.length;
  let completedCount = 0;
  const providerModelMap = new Map<
    string,
    { runs: number; completed: number; tokens: number }
  >();

  for (const r of rows) {
    if (r.status === "completed" || r.status === "success") completedCount += 1;
    const provider = r.provider_used ?? "unknown";
    const model = r.model_used ?? "unknown";
    const key = `${provider} - ${model}`;
    if (!providerModelMap.has(key)) {
      providerModelMap.set(key, { runs: 0, completed: 0, tokens: 0 });
    }
    const rec = providerModelMap.get(key)!;
    rec.runs += 1;
    if (r.status === "completed" || r.status === "success") rec.completed += 1;
    const metrics = r.token_metrics as { total_tokens?: number } | null;
    if (metrics?.total_tokens != null) rec.tokens += Number(metrics.total_tokens);
  }

  const costByProviderModel: ProviderModelRow[] = Array.from(
    providerModelMap.entries()
  ).map(([key, { runs: runCount, tokens }]) => {
    const [provider, model] = key.split(" - ");
    const totalCostMicro = 0;
    return {
      provider: provider ?? "unknown",
      model: model ?? "unknown",
      runs: runCount,
      tokens,
      totalCostMicro,
      costPerRunMicro: runCount ? totalCostMicro / runCount : 0,
    };
  });

  costByProviderModel.sort((a, b) => b.runs - a.runs);

  const totalCostMicro = 0;
  return {
    agentId: agent.id,
    agentName: agent.name,
    runs: totalRuns,
    successRatePct: totalRuns ? (100 * completedCount) / totalRuns : 0,
    totalCostMicro,
    costPerRunMicro: totalRuns ? totalCostMicro / totalRuns : 0,
    costByProviderModel,
  };
}

export function useAgentAnalytics(days: DateRangeDays) {
  return useQuery({
    queryKey: queryKeys.ai.agentAnalytics(days),
    queryFn: () => fetchAgentAnalytics(days),
    staleTime: cacheConfig.staleTime.medium,
  });
}

export function useAgentAnalyticsDetail(agentId: string | undefined, days: DateRangeDays) {
  return useQuery({
    queryKey: queryKeys.ai.agentAnalyticsDetail(agentId ?? "", days),
    queryFn: () => fetchAgentAnalyticsDetail(agentId!, days),
    enabled: !!agentId,
    staleTime: cacheConfig.staleTime.medium,
  });
}

/** Format cost as $X.XXμ (micro-dollars) */
export function formatCostMicro(micro: number): string {
  if (micro === 0) return "$0.00μ";
  const val = micro / 1_000_000;
  return `$${val.toFixed(2)}μ`;
}

/** Format tokens with M suffix when >= 1e6 */
export function formatTokens(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}
