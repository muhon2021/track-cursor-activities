/**
 * Admin: Semantic Search Analytics
 * Fetches embeddings (id, entity_type) and agent_memories (id, importance_score, access_count)
 * in a single load with Promise.all. Refetches every 60 seconds.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/cache";

const REFETCH_MS = 60_000;

export interface EmbeddingsByType {
  entity_type: string;
  count: number;
  pct: number;
}

export interface QueryMetrics {
  avgLatencyMs: number;
  p95LatencyMs: number;
  truePositiveRatePct: number;
  successfulSearches: number;
  failedSearches: number;
  successRatePct: number;
  avgResultsPerQuery: number;
}

export interface SearchAnalyticsData {
  totalEmbeddings: number;
  totalMemories: number;
  searchableItems: number;
  embeddingsByType: EmbeddingsByType[];
  avgRelevancePct: number;
  totalAccesses: number;
  queryMetrics: QueryMetrics;
}

async function fetchSearchAnalytics(): Promise<SearchAnalyticsData> {
  const [embeddingsRes, memoriesRes, searchLogsRes] = await Promise.all([
    supabase.from("embeddings").select("id, entity_type"),
    supabase.from("agent_memories").select("id, importance_score, access_count").eq("is_active", true),
    supabase.from("vector_search_logs").select("duration_ms, result_count").order("created_at", { ascending: false }).limit(500),
  ]);

  if (embeddingsRes.error) throw embeddingsRes.error;
  if (memoriesRes.error) throw memoriesRes.error;

  const embeddingRows = embeddingsRes.data ?? [];
  const memoryRows = memoriesRes.data ?? [];
  const searchLogs = searchLogsRes.data ?? [];

  const totalEmbeddings = embeddingRows.length;
  const totalMemories = memoryRows.length;
  const searchableItems = totalEmbeddings + totalMemories;

  const byType = new Map<string, number>();
  for (const r of embeddingRows) {
    const t = r.entity_type ?? "unknown";
    byType.set(t, (byType.get(t) ?? 0) + 1);
  }
  const totalForPct = totalEmbeddings || 1;
  const embeddingsByType: EmbeddingsByType[] = Array.from(byType.entries()).map(([entity_type, count]) => ({
    entity_type,
    count,
    pct: (count / totalForPct) * 100,
  }));

  const withScore = memoryRows.filter(
    (r) => r.importance_score != null
  ) as { importance_score: number }[];
  const avgRelevancePct =
    withScore.length > 0
      ? (withScore.reduce((s, r) => s + r.importance_score, 0) / withScore.length) * 100
      : 0;

  const totalAccesses = memoryRows.reduce(
    (s, r) => s + (typeof r.access_count === "number" ? r.access_count : 0),
    0
  );

  const latencies = searchLogs.map((l) => l.duration_ms ?? 0).filter((n) => n > 0).sort((a, b) => a - b);
  const successfulSearches = searchLogs.filter((l) => (l.result_count ?? 0) > 0).length;
  const failedSearches = searchLogs.length - successfulSearches;
  const queryMetrics: QueryMetrics = searchLogs.length > 0
    ? {
        avgLatencyMs: Math.round(latencies.reduce((s, n) => s + n, 0) / Math.max(latencies.length, 1)),
        p95LatencyMs: latencies[Math.floor(latencies.length * 0.95)] ?? 0,
        truePositiveRatePct: Math.round((successfulSearches / searchLogs.length) * 1000) / 10,
        successfulSearches,
        failedSearches,
        successRatePct: Math.round((successfulSearches / searchLogs.length) * 1000) / 10,
        avgResultsPerQuery:
          Math.round(
            (searchLogs.reduce((s, l) => s + (l.result_count ?? 0), 0) / searchLogs.length) * 10
          ) / 10,
      }
    : {
        avgLatencyMs: 0,
        p95LatencyMs: 0,
        truePositiveRatePct: 0,
        successfulSearches: 0,
        failedSearches: 0,
        successRatePct: 0,
        avgResultsPerQuery: 0,
      };

  return {
    totalEmbeddings,
    totalMemories,
    searchableItems,
    embeddingsByType,
    avgRelevancePct,
    totalAccesses,
    queryMetrics,
  };
}

export function useSearchAnalytics() {
  return useQuery({
    queryKey: queryKeys.admin.searchAnalytics,
    queryFn: fetchSearchAnalytics,
    refetchInterval: REFETCH_MS,
  });
}
