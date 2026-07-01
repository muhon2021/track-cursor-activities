/**
 * Admin: User Memory Statistics
 * Fetches per-user memory stats from Edge Function (service role: listUsers + agent_memories).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/cache";

export interface UserMemoryRow {
  user_id: string;
  email: string;
  total_memories: number;
  avg_relevance_pct: number;
  cache_hits: number;
  last_accessed_at: string | null;
  status: string;
}

export interface UserMemoryStatsPayload {
  users: UserMemoryRow[];
  summary: {
    active_users: number;
    total_memories: number;
    avg_relevance_pct: number;
    top_user_cache_hits: number;
  };
  insights: {
    highest_memory_count: number;
    cache_hit_rate_pct: number | null;
    consolidation_impact: string;
    avg_memory_lifetime_days: number | null;
  };
}

const REFETCH_MS = 60_000;

async function fetchUserMemoryStats(): Promise<UserMemoryStatsPayload> {
  const { data, error } = await supabase.functions.invoke("user-memory-stats", {
    method: "POST",
    body: {},
  });

  if (error) throw error;

  const payload = data as UserMemoryStatsPayload | undefined;
  if (!payload?.users || !payload?.summary) {
    throw new Error("Invalid response from user-memory-stats");
  }

  return payload;
}

export function useUserMemoryStats() {
  return useQuery({
    queryKey: queryKeys.admin.userMemoryStats,
    queryFn: fetchUserMemoryStats,
    refetchInterval: REFETCH_MS,
    staleTime: REFETCH_MS,
  });
}
