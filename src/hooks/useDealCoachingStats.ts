/**
 * Deal coaching performance stats for Admin AI Hub (/admin/ai/deal-coaching).
 * Uses deal-coach agent runs (when logged with metadata.deal_id) and deals table for real metrics.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/cache";
import { cacheConfig } from "@/lib/cache";

const DEAL_COACH_AGENT_SLUG = "deal-coach";

export type DealCoachingStatsDateRange = 7 | 30 | 90;

function dateRange(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  return { from: from.toISOString(), to: to.toISOString() };
}

export interface DealCoachingStats {
  /** Distinct deals that had at least one deal-coach run (when runs log deal_id) */
  dealsCoached: number;
  /** Close rate (won / (won+lost)) * 100 for closed deals in period */
  closeRatePct: number;
  /** Average days from created_at to closed_at for won deals */
  avgCycleDays: number;
  /** Average deal value (won + active) in period */
  avgDealSize: number;
  /** Total runs of deal-coach in period (any) */
  coachRunsCount: number;
  /** Won deals count in period */
  wonCount: number;
  /** Lost deals count in period */
  lostCount: number;
  /** Total closed (won+lost) in period */
  closedCount: number;
}

async function fetchDealCoachingStats(days: number): Promise<DealCoachingStats> {
  const { from, to } = dateRange(days);

  const { data: agents, error: agentsError } = await supabase
    .from("ai_agents")
    .select("id")
    .eq("slug", DEAL_COACH_AGENT_SLUG)
    .eq("is_enabled", true)
    .limit(1);

  if (agentsError) throw agentsError;
  const agentId = agents?.[0]?.id ?? null;

  let dealsCoached = 0;
  let coachRunsCount = 0;
  if (agentId) {
    const { data: runs, error: runsError } = await supabase
      .from("ai_agent_runs")
      .select("id, metadata, context")
      .eq("agent_id", agentId)
      .gte("created_at", from)
      .lt("created_at", to);

    if (!runsError && runs?.length) {
      coachRunsCount = runs.length;
      const dealIds = new Set<string>();
      runs.forEach((r) => {
        const meta = r.metadata as Record<string, unknown> | null;
        const ctx = r.context;
        const dealId =
          (meta?.deal_id as string) ??
          (typeof ctx === "object" && ctx && "deal_id" in ctx ? (ctx as { deal_id?: string }).deal_id : undefined);
        if (dealId) dealIds.add(dealId);
      });
      dealsCoached = dealIds.size;
    }
  }

  const { data: deals, error: dealsError } = await supabase
    .from("deals")
    .select("id, stage, value, created_at, closed_at")
    .or("stage.eq.won,stage.eq.lost")
    .not("closed_at", "is", null)
    .gte("closed_at", from)
    .lt("closed_at", to);

  if (dealsError) throw dealsError;
  const rows = deals ?? [];

  let wonCount = 0;
  let lostCount = 0;
  let cycleSum = 0;
  let cycleN = 0;
  let valueSum = 0;
  let valueN = 0;

  rows.forEach((d) => {
    if (d.stage === "won") wonCount++;
    if (d.stage === "lost") lostCount++;
    const created = d.created_at ? new Date(d.created_at).getTime() : NaN;
    const closed = d.closed_at ? new Date(d.closed_at).getTime() : NaN;
    if (!isNaN(created) && !isNaN(closed) && closed >= created) {
      cycleSum += Math.round((closed - created) / (24 * 60 * 60 * 1000));
      cycleN++;
    }
    const val = Number(d.value);
    if (!isNaN(val) && val > 0) {
      valueSum += val;
      valueN++;
    }
  });

  const closedCount = wonCount + lostCount;
  const closeRatePct = closedCount > 0 ? Math.round((wonCount / closedCount) * 100) : 0;
  const avgCycleDays = cycleN > 0 ? Math.round(cycleSum / cycleN) : 0;
  const avgDealSize = valueN > 0 ? Math.round(valueSum / valueN) : 0;

  return {
    dealsCoached,
    closeRatePct,
    avgCycleDays,
    avgDealSize,
    coachRunsCount,
    wonCount,
    lostCount,
    closedCount,
  };
}

export function useDealCoachingStats(
  days: DealCoachingStatsDateRange = 90
): ReturnType<typeof useQuery<DealCoachingStats>> {
  return useQuery({
    queryKey: queryKeys.ai.dealCoachingStats(days),
    queryFn: () => fetchDealCoachingStats(days),
    staleTime: cacheConfig.staleTime.medium,
  });
}
