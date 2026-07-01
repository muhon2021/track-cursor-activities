/**
 * Consolidated data hooks for the Knowledge Base admin dashboard.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/cache";
import type { Database } from "@/integrations/supabase/types";

const REFETCH_MS = 60_000;
const CHART_DAYS = 30;

type KnowledgeFileRow = Pick<
  Database["public"]["Tables"]["knowledge_files"]["Row"],
  "id" | "title" | "file_name" | "processing_status" | "created_at" | "updated_at" | "file_size" | "source_id"
>;

type VectorSearchLogRow = Pick<
  Database["public"]["Tables"]["vector_search_logs"]["Row"],
  "id" | "query" | "result_count" | "duration_ms" | "created_at" | "search_type"
>;

type GeminiSyncLogRow = Pick<
  Database["public"]["Tables"]["gemini_sync_logs"]["Row"],
  | "id"
  | "corpus_id"
  | "sync_type"
  | "status"
  | "documents_added"
  | "documents_removed"
  | "error_message"
  | "started_at"
  | "completed_at"
>;

export interface KnowledgeSourceOverview {
  id: string;
  name: string;
  source_type: string;
  is_active: boolean | null;
  last_synced_at: string | null;
  sync_enabled?: boolean;
  sync_frequency?: string;
  sync_status?: string;
  file_count?: number;
}

export interface FileStats {
  total: number;
  active: number;
  synced: number;
  failed: number;
  pending: number;
}

export interface DayCount {
  date: string;
  count: number;
}

export interface SourceTypeCount {
  type: string;
  count: number;
}

export interface TopQuery {
  query: string;
  count: number;
  avgLatencyMs: number;
}

export interface SyncHealth {
  status: "healthy" | "warning" | "failed";
  label: string;
  successRate: number;
  lastSyncAt: string | null;
  pendingCount: number;
  failedCount: number;
}

function lastNDays(days: number): string[] {
  const result: string[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    result.push(d.toISOString().slice(0, 10));
  }
  return result;
}

function groupCreatedAtByDay(timestamps: (string | null)[], days = CHART_DAYS): DayCount[] {
  const buckets = Object.fromEntries(lastNDays(days).map((d) => [d, 0]));
  for (const ts of timestamps) {
    if (!ts) continue;
    const day = ts.slice(0, 10);
    if (day in buckets) buckets[day]++;
  }
  return lastNDays(days).map((date) => ({ date, count: buckets[date] }));
}

export function useKnowledgeFileStats() {
  return useQuery({
    queryKey: queryKeys.knowledge.dashboardFiles,
    queryFn: async (): Promise<{ files: KnowledgeFileRow[]; stats: FileStats }> => {
      const { data, error } = await supabase
        .from("knowledge_files")
        .select("id, title, file_name, processing_status, created_at, updated_at, file_size, source_id")
        .order("updated_at", { ascending: false });
      if (error) throw error;

      const files = (data ?? []) as KnowledgeFileRow[];
      const stats: FileStats = {
        total: files.length,
        active: files.filter((f) => f.processing_status === "completed").length,
        synced: files.filter((f) => f.processing_status === "completed" || f.processing_status === "synced").length,
        failed: files.filter((f) => f.processing_status === "failed" || f.processing_status === "error").length,
        pending: files.filter(
          (f) =>
            !f.processing_status ||
            f.processing_status === "pending" ||
            f.processing_status === "processing"
        ).length,
      };
      return { files, stats };
    },
    refetchInterval: REFETCH_MS,
  });
}

export function useKnowledgeSourcesOverview() {
  return useQuery({
    queryKey: queryKeys.knowledge.dashboardSources,
    queryFn: async (): Promise<{
      sources: KnowledgeSourceOverview[];
      distribution: SourceTypeCount[];
    }> => {
      const { data, error } = await supabase
        .from("knowledge_sources")
        .select("*")
        .order("last_synced_at", { ascending: false, nullsFirst: false });
      if (error) throw error;

      const sources = (data ?? []) as KnowledgeSourceOverview[];
      const typeMap = new Map<string, number>();
      for (const s of sources) {
        const t = s.source_type || "other";
        typeMap.set(t, (typeMap.get(t) ?? 0) + 1);
      }
      const distribution: SourceTypeCount[] = Array.from(typeMap.entries()).map(([type, count]) => ({
        type,
        count,
      }));
      return { sources, distribution };
    },
    refetchInterval: REFETCH_MS,
  });
}

export function useKnowledgeSyncLogs() {
  return useQuery({
    queryKey: queryKeys.knowledge.dashboardSyncLogs,
    queryFn: async (): Promise<{
      logs: GeminiSyncLogRow[];
      syncActivity: DayCount[];
      health: SyncHealth;
    }> => {
      const { data, error } = await supabase
        .from("gemini_sync_logs")
        .select(
          "id, corpus_id, sync_type, status, documents_added, documents_removed, error_message, started_at, completed_at"
        )
        .order("started_at", { ascending: false })
        .limit(50);
      if (error) throw error;

      const logs = (data ?? []) as GeminiSyncLogRow[];
      const syncActivity = groupCreatedAtByDay(logs.map((l) => l.started_at));

      const completed = logs.filter((l) => l.status === "completed").length;
      const failed = logs.filter((l) => l.status === "failed").length;
      const pending = logs.filter((l) => l.status === "pending" || l.status === "running").length;
      const successRate = logs.length > 0 ? Math.round((completed / logs.length) * 100) : 100;
      const lastSyncAt = logs[0]?.started_at ?? null;

      const recentFailed = logs.filter((l) => {
        if (l.status !== "failed" || !l.started_at) return false;
        return new Date(l.started_at) > new Date(Date.now() - 24 * 60 * 60 * 1000);
      }).length;

      let status: SyncHealth["status"] = "healthy";
      let label = "Healthy";
      if (recentFailed > 0 || (logs.length > 0 && successRate < 70)) {
        status = "failed";
        label = "Failed";
      } else if (failed > 0 || pending > 0 || successRate < 90) {
        status = "warning";
        label = "Warning";
      }

      return {
        logs,
        syncActivity,
        health: { status, label, successRate, lastSyncAt, pendingCount: pending, failedCount: failed },
      };
    },
    refetchInterval: REFETCH_MS,
  });
}

export function useKnowledgeSearchInsights() {
  return useQuery({
    queryKey: queryKeys.knowledge.dashboardSearchLogs,
    queryFn: async (): Promise<{
      logs: VectorSearchLogRow[];
      topQueries: TopQuery[];
      totalSearches: number;
      avgLatencyMs: number;
    }> => {
      const { data, error } = await supabase
        .from("vector_search_logs")
        .select("id, query, result_count, duration_ms, created_at, search_type")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;

      const logs = (data ?? []) as VectorSearchLogRow[];
      const queryMap = new Map<string, { count: number; totalLatency: number }>();

      for (const log of logs) {
        const q = log.query.trim().toLowerCase();
        if (!q) continue;
        const cur = queryMap.get(q) ?? { count: 0, totalLatency: 0 };
        cur.count++;
        cur.totalLatency += log.duration_ms ?? 0;
        queryMap.set(q, cur);
      }

      const topQueries: TopQuery[] = Array.from(queryMap.entries())
        .map(([query, { count, totalLatency }]) => ({
          query,
          count,
          avgLatencyMs: count > 0 ? Math.round(totalLatency / count) : 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const withLatency = logs.filter((l) => l.duration_ms != null);
      const avgLatencyMs =
        withLatency.length > 0
          ? Math.round(withLatency.reduce((s, l) => s + (l.duration_ms ?? 0), 0) / withLatency.length)
          : 0;

      return {
        logs,
        topQueries,
        totalSearches: logs.length,
        avgLatencyMs,
      };
    },
    refetchInterval: REFETCH_MS,
  });
}

export function useCommonKnowledgeCount() {
  return useQuery({
    queryKey: queryKeys.knowledge.dashboardCommonCount,
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from("common_knowledge")
        .select("id", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: REFETCH_MS,
  });
}

export function useKnowledgeDocumentsOverTime(
  entryDates: (string | null)[],
  fileDates: (string | null)[]
) {
  return {
    entries: groupCreatedAtByDay(entryDates),
    files: groupCreatedAtByDay(fileDates),
    combined: groupCreatedAtByDay([...entryDates, ...fileDates]),
  };
}
