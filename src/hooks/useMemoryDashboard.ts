/**
 * Admin Memory Dashboard – aggregates for Memory Dashboard page.
 * Data: agent_memories, embeddings, knowledge_embeddings, pipeline stats, vector_search_logs.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys, cacheConfig } from "@/lib/cache";
import {
  useEmbeddingPipelineStats,
  type PipelineStats,
} from "@/hooks/useEmbeddingPipeline";

export interface MemoryHierarchyDistribution {
  personal: number;
  agent: number;
  organizational: number;
  total: number;
}

export interface MemoryTypeBreakdown {
  agentMemory: number;
  emailMemory: number;
  dealMemory: number;
}

export interface MemoryDashboardData {
  totalMemories: number;
  avgRelevancePct: number;
  hierarchyEntries: number;
  hierarchyDistribution: MemoryHierarchyDistribution;
  embeddingsCount: number;
  queuePending: number;
  queueSuccessRatePct: number;
  cacheHitRatePct: number | null;
  servingUsers: number;
  pipeline: PipelineStats;
  avgQueryLatencyMs: number | null;
  searchLogsTotal: number;
  memoryTypeBreakdown: MemoryTypeBreakdown;
}

async function fetchMemoryDashboard(): Promise<MemoryDashboardData> {
  const [
    memoriesRes,
    embeddingsCountRes,
    knowledgeEmbeddingsCountRes,
    searchLogsRes,
  ] = await Promise.all([
    supabase
      .from("agent_memories")
      .select("id, memory_type, memory_category, source_type", { count: "exact", head: true })
      .eq("is_active", true),
    supabase.from("embeddings").select("id", { count: "exact", head: true }),
    supabase.from("knowledge_embeddings").select("id", { count: "exact", head: true }),
    supabase
      .from("vector_search_logs")
      .select("id, duration_ms, top_score, user_id")
      .limit(500),
  ]);

  const totalMemories = memoriesRes.count ?? 0;
  const embeddingsCount = (embeddingsCountRes.count ?? 0) + (knowledgeEmbeddingsCountRes.count ?? 0);
  const searchLogs = searchLogsRes.data ?? [];

  const withScores = searchLogs.filter(
    (r: { top_score?: number | null }) => r.top_score != null
  ) as { top_score: number }[];
  const avgRelevancePct =
    withScores.length > 0
      ? (withScores.reduce((s, r) => s + r.top_score, 0) / withScores.length) * 100
      : 0;

  const withLatency = searchLogs.filter(
    (r: { duration_ms?: number | null }) => r.duration_ms != null
  ) as { duration_ms: number }[];
  const avgQueryLatencyMs =
    withLatency.length > 0
      ? Math.round(
          withLatency.reduce((s, r) => s + r.duration_ms, 0) / withLatency.length
        )
      : null;

  const distinctUserIds = new Set(
    (searchLogs as { user_id?: string | null }[])
      .map((r) => r.user_id)
      .filter(Boolean)
  );
  const servingUsers = distinctUserIds.size;

  return {
    totalMemories,
    avgRelevancePct,
    hierarchyEntries: totalMemories,
    hierarchyDistribution: {
      personal: totalMemories,
      agent: 0,
      organizational: 0,
      total: totalMemories,
    },
    embeddingsCount,
    queuePending: 0,
    queueSuccessRatePct: 0,
    cacheHitRatePct: null,
    servingUsers,
    pipeline: {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      total: 0,
      totalChunks: 0,
    },
    avgQueryLatencyMs,
    searchLogsTotal: searchLogs.length,
    memoryTypeBreakdown: {
      agentMemory: totalMemories,
      emailMemory: 0,
      dealMemory: 0,
    },
  };
}

export function useMemoryDashboard() {
  const pipeline = useEmbeddingPipelineStats();
  const query = useQuery({
    queryKey: queryKeys.admin.memoryDashboard,
    queryFn: fetchMemoryDashboard,
    staleTime: cacheConfig.staleTime.short,
    enabled: true,
  });

  const data = query.data;
  const pipelineStats = pipeline.data;
  const completed = pipelineStats?.completed ?? 0;
  const failed = pipelineStats?.failed ?? 0;
  const totalProcessed = completed + failed;
  const successRatePct =
    totalProcessed > 0 ? (completed / totalProcessed) * 100 : 0;

  const mergedData: MemoryDashboardData | undefined = data
    ? {
        ...data,
        queuePending: pipelineStats?.pending ?? data.queuePending,
        queueSuccessRatePct: Number.isFinite(successRatePct) ? successRatePct : data.queueSuccessRatePct,
        pipeline: pipelineStats ?? data.pipeline,
      }
    : undefined;

  return {
    ...query,
    data: mergedData,
    isLoading: query.isLoading || pipeline.isLoading,
    error: query.error ?? pipeline.error,
  };
}
