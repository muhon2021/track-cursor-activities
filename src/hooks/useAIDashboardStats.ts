/**
 * AI Dashboard stats: agents count, runs this month, meeting summaries, tokens used.
 * Used by /admin/ai (AIDashboard).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/cache";
import { cacheConfig } from "@/lib/cache";

export interface AIDashboardStats {
  agentsCount: number;
  runsCount: number;
  summariesCount: number;
  totalTokens: number;
}

function startOfMonth(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01T00:00:00.000Z`;
}

function endOfMonth(date: Date): string {
  const next = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return next.toISOString();
}

async function fetchAIDashboardStats(): Promise<AIDashboardStats> {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const [agentsRes, runsRes, summariesRes] = await Promise.all([
    supabase
      .from("ai_agents")
      .select("id", { count: "exact", head: true })
      .eq("is_enabled", true),
    supabase
      .from("ai_agent_runs")
      .select("id, token_metrics")
      .gte("created_at", monthStart)
      .lt("created_at", monthEnd),
    supabase
      .from("meeting_files")
      .select("id", { count: "exact", head: true })
      .not("transcript_text", "is", null),
  ]);

  const agentsCount = agentsRes.count ?? 0;
  const runsCount = runsRes.data?.length ?? 0;
  const summariesCount = summariesRes.count ?? 0;

  let totalTokens = 0;
  if (runsRes.data) {
    for (const row of runsRes.data) {
      const metrics = row.token_metrics as { total_tokens?: number } | null;
      if (metrics?.total_tokens != null) {
        totalTokens += Number(metrics.total_tokens);
      }
    }
  }

  return {
    agentsCount,
    runsCount,
    summariesCount,
    totalTokens,
  };
}

export function useAIDashboardStats() {
  return useQuery({
    queryKey: queryKeys.ai.dashboardStats,
    queryFn: fetchAIDashboardStats,
    staleTime: cacheConfig.staleTime.medium,
  });
}
