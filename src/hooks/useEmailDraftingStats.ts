/**
 * Email drafting performance stats for Admin AI Hub (/admin/ai/email-drafting).
 * Fetches real data from ai_agent_runs for email-draft related agents.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/cache";
import { cacheConfig } from "@/lib/cache";

/** Slugs that identify email-drafting agents (follow-up, draft generator, etc.) */
const EMAIL_DRAFT_AGENT_SLUGS = [
  "email-draft-assistant",
  "email-draft-generator",
  "meeting-followup-generator",
];

export type EmailDraftingStatsDateRange = 7 | 30 | 90;

export interface EmailDraftingStats {
  /** Total runs (drafts) from email-draft agents in the period */
  emailDraftsCount: number;
  /** Completed runs (successful drafts) */
  positiveOutcomes: number;
  /** completed / total * 100, or 0 if no runs */
  successRatePct: number;
  /** Response boost vs non-personalized — not in DB, null or from config later */
  responseBoostPct: number | null;
  /** Avg open rate — not in DB, null or from config later */
  avgOpenRatePct: number | null;
  /** Runs with memory-enabled agents (agent.memory_enabled) — proxy for "using memory" */
  draftsWithMemoryEnabledAgent: number;
}

function dateRange(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  return { from: from.toISOString(), to: to.toISOString() };
}

async function fetchEmailDraftingStats(
  days: number
): Promise<EmailDraftingStats> {
  const { from, to } = dateRange(days);

  const { data: agents, error: agentsError } = await supabase
    .from("ai_agents")
    .select("id, memory_enabled")
    .in("slug", EMAIL_DRAFT_AGENT_SLUGS)
    .eq("is_enabled", true);

  if (agentsError) throw agentsError;
  const agentIds = (agents ?? []).map((a) => a.id);
  const memoryEnabledIds = new Set(
    (agents ?? []).filter((a) => a.memory_enabled === true).map((a) => a.id)
  );

  if (agentIds.length === 0) {
    return {
      emailDraftsCount: 0,
      positiveOutcomes: 0,
      successRatePct: 0,
      responseBoostPct: null,
      avgOpenRatePct: null,
      draftsWithMemoryEnabledAgent: 0,
    };
  }

  const { data: runs, error: runsError } = await supabase
    .from("ai_agent_runs")
    .select("id, agent_id, status")
    .in("agent_id", agentIds)
    .gte("created_at", from)
    .lt("created_at", to);

  if (runsError) throw runsError;
  const rows = runs ?? [];
  const total = rows.length;
  const completed = rows.filter(
    (r) => r.status === "completed" || r.status === "success"
  ).length;
  const withMemory = rows.filter((r) => memoryEnabledIds.has(r.agent_id)).length;

  return {
    emailDraftsCount: total,
    positiveOutcomes: completed,
    successRatePct: total > 0 ? Math.round((completed / total) * 100) : 0,
    responseBoostPct: null,
    avgOpenRatePct: null,
    draftsWithMemoryEnabledAgent: withMemory,
  };
}

export function useEmailDraftingStats(
  days: EmailDraftingStatsDateRange = 30
): ReturnType<typeof useQuery<EmailDraftingStats>> {
  return useQuery({
    queryKey: queryKeys.ai.emailDraftingStats(days),
    queryFn: () => fetchEmailDraftingStats(days),
    staleTime: cacheConfig.staleTime.medium,
  });
}
