/**
 * Admin hooks for AI Agents & Configuration (Phase C).
 * Queries agent_run_audit_log, agent_prompt_versions, and related tables.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys, cacheConfig } from "@/lib/cache";
import { subDays } from "date-fns";
import type { AIAgent } from "@/hooks/useAIAgents";

const db = supabase as any;

export type AgentHealthStatus = "active" | "degraded" | "inactive";

export interface AgentCatalogStats {
  agentId: string;
  totalRuns24h: number;
  failedRuns24h: number;
  avgLatencyMs: number | null;
  totalCostMicro: number;
  lastRunAt: string | null;
}

export interface AgentRunAuditLogEntry {
  id: string;
  agent_id: string;
  user_id: string | null;
  run_id: string | null;
  conversation_id: string | null;
  message_id: string | null;
  event_type: string;
  tool_name: string | null;
  tool_input: unknown;
  tool_output: unknown;
  status: string | null;
  latency_ms: number | null;
  tokens_input: number | null;
  tokens_output: number | null;
  cost_micro: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  profiles?: { email: string | null; full_name: string | null } | null;
  ai_agents?: { name: string; slug: string } | null;
}

export interface AgentPromptVersion {
  id: string;
  agent_id: string;
  version_number: number;
  system_prompt: string;
  change_summary: string | null;
  created_by: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  profiles?: { email: string | null; full_name: string | null } | null;
}

export interface AgentLearningEventRow {
  id: string;
  agent_id: string;
  user_id: string;
  event_type: string;
  event_description: string;
  feedback_type: string | null;
  feedback_text: string | null;
  related_message_id: string | null;
  related_conversation_id: string | null;
  related_memory_id: string | null;
  created_at: string | null;
  profiles?: { email: string | null; full_name: string | null } | null;
}

export interface AgentMemoryRow {
  id: string;
  agent_id: string;
  user_id: string;
  content: string;
  summary: string | null;
  memory_type: string;
  memory_category: string | null;
  importance_score: number | null;
  access_count: number | null;
  is_active: boolean | null;
  created_at: string | null;
  last_accessed_at: string | null;
  profiles?: { email: string | null; full_name: string | null } | null;
}

export interface CostDashboardData {
  totalSpend: number;
  totalRequests: number;
  totalTokens: number;
  dailySpend: { date: string; spend: number; requests: number }[];
  modelBreakdown: { model: string; provider: string; spend: number; requests: number }[];
  logs: {
    id: string;
    created_at: string;
    function_name: string | null;
    input_tokens: number;
    output_tokens: number;
    estimated_cost: number;
    model_name: string;
    provider_name: string;
    user_email: string;
  }[];
}

export type AuditLogFilters = {
  agentId?: string;
  status?: string;
  eventType?: string;
  search?: string;
  limit?: number;
};

function deriveHealth(
  agent: AIAgent,
  stats?: AgentCatalogStats
): AgentHealthStatus {
  if (!agent.is_enabled) return "inactive";
  if (!stats || stats.totalRuns24h === 0) return "active";
  const failureRate =
    stats.totalRuns24h > 0 ? stats.failedRuns24h / stats.totalRuns24h : 0;
  if (failureRate > 0.3) return "degraded";
  if (stats.avgLatencyMs != null && stats.avgLatencyMs > 10000) return "degraded";
  return "active";
}

function emptyCatalogStats(agentId: string): AgentCatalogStats {
  return {
    agentId,
    totalRuns24h: 0,
    failedRuns24h: 0,
    avgLatencyMs: null,
    totalCostMicro: 0,
    lastRunAt: null,
  };
}

function getOrCreateStats(
  map: Map<string, AgentCatalogStats>,
  agentId: string
): AgentCatalogStats {
  const existing = map.get(agentId);
  if (existing) return existing;
  const stats = emptyCatalogStats(agentId);
  map.set(agentId, stats);
  return stats;
}

function applyCatalogRun(
  stats: AgentCatalogStats,
  row: {
    status?: string | null;
    latency_ms?: number | null;
    cost_micro?: number;
    created_at: string;
  }
) {
  stats.totalRuns24h += 1;
  if (row.status === "failed" || row.status === "error") {
    stats.failedRuns24h += 1;
  }
  if (row.latency_ms != null && !Number.isNaN(Number(row.latency_ms))) {
    const n = stats.totalRuns24h;
    const prev = stats.avgLatencyMs ?? 0;
    stats.avgLatencyMs = Math.round(
      (prev * (n - 1) + Number(row.latency_ms)) / n
    );
  }
  if (row.cost_micro != null && row.cost_micro > 0) {
    stats.totalCostMicro += row.cost_micro;
  }
  if (!stats.lastRunAt || row.created_at > stats.lastRunAt) {
    stats.lastRunAt = row.created_at;
  }
}

/** Rough USD estimate when usage log cost is unavailable (gpt-4o-mini tier). */
function estimateCostDollars(
  inputTokens: number | null | undefined,
  outputTokens: number | null | undefined
): number {
  const input = inputTokens ?? 0;
  const output = outputTokens ?? 0;
  return (input / 1_000_000) * 0.15 + (output / 1_000_000) * 0.6;
}

async function fetchCatalogStats(): Promise<Map<string, AgentCatalogStats>> {
  const since = subDays(new Date(), 1).toISOString();
  const map = new Map<string, AgentCatalogStats>();

  // 1) Run dialog executions
  const { data: runs, error: runsError } = await supabase
    .from("ai_agent_runs")
    .select("agent_id, status, latency_ms, created_at, token_metrics")
    .gte("created_at", since);

  if (runsError) {
    console.warn("fetchCatalogStats ai_agent_runs:", runsError.message);
  } else {
    for (const row of runs ?? []) {
      const stats = getOrCreateStats(map, row.agent_id);
      const metrics = row.token_metrics as {
        input_tokens?: number;
        output_tokens?: number;
      } | null;
      applyCatalogRun(stats, {
        status: row.status,
        latency_ms: row.latency_ms,
        created_at: row.created_at,
        cost_micro: Math.round(
          estimateCostDollars(metrics?.input_tokens, metrics?.output_tokens) *
            1_000_000
        ),
      });
    }
  }

  // 2) Chat replies (agent-conversation-chat)
  const { data: chatMessages, error: chatError } = await db
    .from("agent_messages")
    .select(
      `
      latency_ms,
      created_at,
      tokens_input,
      tokens_output,
      agent_conversations!inner ( agent_id )
    `
    )
    .eq("role", "assistant")
    .gte("created_at", since);

  if (chatError) {
    console.warn("fetchCatalogStats agent_messages:", chatError.message);
  } else {
    for (const row of chatMessages ?? []) {
      const conv = row.agent_conversations as { agent_id?: string } | null;
      const agentId = conv?.agent_id;
      if (!agentId) continue;
      const stats = getOrCreateStats(map, agentId);
      applyCatalogRun(stats, {
        status: "completed",
        latency_ms: row.latency_ms,
        created_at: row.created_at,
        cost_micro: Math.round(
          estimateCostDollars(row.tokens_input, row.tokens_output) * 1_000_000
        ),
      });
    }
  }

  // 3) Phase A audit log (when populated)
  const { data: auditRows, error: auditError } = await db
    .from("agent_run_audit_log")
    .select("agent_id, status, latency_ms, cost_micro, created_at")
    .gte("created_at", since);

  if (!auditError && auditRows?.length) {
    for (const row of auditRows) {
      const id = row.agent_id as string;
      const stats = getOrCreateStats(map, id);
      applyCatalogRun(stats, {
        status: row.status as string,
        latency_ms: row.latency_ms as number | null,
        cost_micro: row.cost_micro != null ? Number(row.cost_micro) : undefined,
        created_at: row.created_at as string,
      });
    }
  }

  // 4) Authoritative cost from usage logs when agent_id is in metadata
  const { data: usageLogs, error: usageError } = await supabase
    .from("ai_usage_logs")
    .select("estimated_cost, metadata")
    .gte("created_at", since)
    .in("function_name", ["agent-conversation-chat", "run-ai-agent"]);

  if (!usageError && usageLogs?.length) {
    const loggedCostByAgent = new Map<string, number>();
    for (const log of usageLogs) {
      const meta = (log.metadata ?? {}) as { agent_id?: string };
      if (!meta.agent_id) continue;
      const micro = Math.round(Number(log.estimated_cost ?? 0) * 1_000_000);
      loggedCostByAgent.set(
        meta.agent_id,
        (loggedCostByAgent.get(meta.agent_id) ?? 0) + micro
      );
    }
    for (const [agentId, costMicro] of loggedCostByAgent) {
      const stats = getOrCreateStats(map, agentId);
      stats.totalCostMicro = costMicro;
    }
  }

  return map;
}

export function useAgentCatalog() {
  return useQuery({
    queryKey: queryKeys.ai.agentCatalog,
    queryFn: async () => {
      const { data: agents, error } = await supabase
        .from("ai_agents")
        .select("*")
        .order("name");

      if (error) throw error;

      const statsMap = await fetchCatalogStats();

      return ((agents ?? []) as unknown as AIAgent[]).map((agent) => {
        const stats = statsMap.get(agent.id);
        return {
          agent,
          stats,
          health: deriveHealth(agent, stats),
        };
      });
    },
    staleTime: cacheConfig.staleTime.short,
  });
}

export function useAgentRunAuditLog(filters: AuditLogFilters = {}) {
  const { agentId, status, eventType, search, limit = 100 } = filters;

  return useQuery({
    queryKey: queryKeys.ai.runAuditLog({ agentId, status, eventType, search, limit }),
    queryFn: async (): Promise<AgentRunAuditLogEntry[]> => {
      let query = db
        .from("agent_run_audit_log")
        .select(
          `
          *,
          profiles:user_id (email, full_name),
          ai_agents:agent_id (name, slug)
        `
        )
        .order("created_at", { ascending: false })
        .limit(limit);

      if (agentId) query = query.eq("agent_id", agentId);
      if (status && status !== "all") query = query.eq("status", status);
      if (eventType && eventType !== "all") query = query.eq("event_type", eventType);

      const { data, error } = await query;
      if (error) throw error;

      let rows = (data ?? []) as AgentRunAuditLogEntry[];

      if (search?.trim()) {
        const q = search.toLowerCase();
        rows = rows.filter(
          (r) =>
            r.tool_name?.toLowerCase().includes(q) ||
            r.event_type.toLowerCase().includes(q) ||
            r.ai_agents?.name?.toLowerCase().includes(q) ||
            JSON.stringify(r.tool_input ?? "").toLowerCase().includes(q) ||
            JSON.stringify(r.tool_output ?? "").toLowerCase().includes(q)
        );
      }

      return rows;
    },
    staleTime: cacheConfig.staleTime.short,
  });
}

export function useAgentPromptVersions(agentId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.ai.promptVersions(agentId ?? ""),
    queryFn: async (): Promise<AgentPromptVersion[]> => {
      if (!agentId) return [];
      const { data, error } = await db
        .from("agent_prompt_versions")
        .select(
          `
          *,
          profiles:created_by (email, full_name)
        `
        )
        .eq("agent_id", agentId)
        .order("version_number", { ascending: false });

      if (error) throw error;
      return (data ?? []) as AgentPromptVersion[];
    },
    enabled: !!agentId,
    staleTime: cacheConfig.staleTime.medium,
  });
}

export function useCreatePromptVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      agent_id: string;
      system_prompt: string;
      change_summary?: string;
      created_by: string;
    }) => {
      const { data: versions } = await db
        .from("agent_prompt_versions")
        .select("version_number")
        .eq("agent_id", params.agent_id)
        .order("version_number", { ascending: false })
        .limit(1);

      const nextVersion =
        versions && versions.length > 0 ? Number(versions[0].version_number) + 1 : 1;

      await db
        .from("agent_prompt_versions")
        .update({ is_active: false })
        .eq("agent_id", params.agent_id);

      const { data, error } = await db
        .from("agent_prompt_versions")
        .insert({
          agent_id: params.agent_id,
          version_number: nextVersion,
          system_prompt: params.system_prompt,
          change_summary: params.change_summary ?? null,
          created_by: params.created_by,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      await supabase
        .from("ai_agents")
        .update({
          system_prompt: params.system_prompt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.agent_id);

      return data as AgentPromptVersion;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.ai.promptVersions(vars.agent_id),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.ai.agent(vars.agent_id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.ai.agentCatalog });
    },
  });
}

export function useAgentLearningEvents(agentId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.ai.learningEvents(agentId ?? ""),
    queryFn: async (): Promise<AgentLearningEventRow[]> => {
      if (!agentId) return [];
      const { data, error } = await db
        .from("agent_learning_events")
        .select(
          `
          *,
          profiles:user_id (email, full_name)
        `
        )
        .eq("agent_id", agentId)
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;
      return (data ?? []) as AgentLearningEventRow[];
    },
    enabled: !!agentId,
    staleTime: cacheConfig.staleTime.short,
  });
}

export function useAgentMemoriesAdmin(
  agentId: string | undefined,
  userId?: string
) {
  return useQuery({
    queryKey: queryKeys.ai.agentMemoriesAdmin(agentId ?? "", userId),
    queryFn: async (): Promise<AgentMemoryRow[]> => {
      if (!agentId) return [];
      let query = db
        .from("agent_memories")
        .select(
          `
          id, agent_id, user_id, content, summary, memory_type, memory_category,
          importance_score, access_count, is_active, created_at, last_accessed_at,
          profiles:user_id (email, full_name)
        `
        )
        .eq("agent_id", agentId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(200);

      if (userId) query = query.eq("user_id", userId);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as AgentMemoryRow[];
    },
    enabled: !!agentId,
    staleTime: cacheConfig.staleTime.short,
  });
}

export function useCostDashboard(days: 7 | 30 | 90 = 30) {
  return useQuery({
    queryKey: queryKeys.ai.costDashboard(days),
    queryFn: async (): Promise<CostDashboardData> => {
      const since = subDays(new Date(), days).toISOString();

      const { data: logsData, error } = await supabase
        .from("ai_usage_logs")
        .select(`*, ai_models (name, ai_providers (name))`)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;

      const userIds = [
        ...new Set((logsData ?? []).map((l) => l.user_id).filter(Boolean)),
      ];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email")
        .in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);

      const emailMap = new Map(
        (profiles ?? []).map((p) => [p.id, p.email ?? "Unknown"])
      );

      const logs = (logsData ?? []).map((log) => {
        const model = log.ai_models as {
          name?: string;
          ai_providers?: { name?: string };
        } | null;
        return {
          id: log.id,
          created_at: log.created_at,
          function_name: log.function_name,
          input_tokens: log.input_tokens,
          output_tokens: log.output_tokens,
          estimated_cost: Number(log.estimated_cost),
          model_name: model?.name ?? "Unknown",
          provider_name: model?.ai_providers?.name ?? "Unknown",
          user_email: emailMap.get(log.user_id) ?? "Unknown",
        };
      });

      const totalSpend = logs.reduce((s, l) => s + l.estimated_cost, 0);
      const totalTokens = logs.reduce(
        (s, l) => s + l.input_tokens + l.output_tokens,
        0
      );

      const dailyMap = new Map<string, { spend: number; requests: number }>();
      for (const log of logs) {
        const day = log.created_at.slice(0, 10);
        const ex = dailyMap.get(day) ?? { spend: 0, requests: 0 };
        dailyMap.set(day, {
          spend: ex.spend + log.estimated_cost,
          requests: ex.requests + 1,
        });
      }

      const dailySpend = Array.from(dailyMap.entries())
        .map(([date, v]) => ({ date, ...v }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const modelMap = new Map<
        string,
        { provider: string; spend: number; requests: number }
      >();
      for (const log of logs) {
        const key = log.model_name;
        const ex = modelMap.get(key) ?? {
          provider: log.provider_name,
          spend: 0,
          requests: 0,
        };
        modelMap.set(key, {
          provider: log.provider_name,
          spend: ex.spend + log.estimated_cost,
          requests: ex.requests + 1,
        });
      }

      const modelBreakdown = Array.from(modelMap.entries())
        .map(([model, v]) => ({ model, ...v }))
        .sort((a, b) => b.spend - a.spend);

      return {
        totalSpend,
        totalRequests: logs.length,
        totalTokens,
        dailySpend,
        modelBreakdown,
        logs,
      };
    },
    staleTime: cacheConfig.staleTime.medium,
  });
}
