/**
 * Embedding Pipeline Dashboard – data from source tables only (meeting_files/zoom_files, knowledge_files).
 * No reads from embeddings table. Pipeline on/off in system_settings (ai.embedding_processing_enabled).
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const SETTING_CATEGORY = "ai";
const SETTING_KEY = "embedding_processing_enabled";
const PIPELINE_QUERY_KEY = ["admin-embedding-pipeline-setting"];
const STATS_QUERY_KEY = ["admin-embedding-pipeline-stats"];
const LIST_QUERY_KEY = ["admin-embedding-pipeline-list"];

export type PipelineStatus = "pending" | "processing" | "completed" | "failed";
export type SourceType = "meeting" | "knowledge";

export interface PipelineRow {
  id: string;
  sourceType: SourceType;
  /** Meeting: zoom_files.id or meeting_files.id; Knowledge: knowledge_files.id */
  sourceId: string;
  name: string;
  context: string;
  status: PipelineStatus;
  chunks: number;
  date: string | null;
  error: string | null;
  /** For View link: meeting_id or null for knowledge */
  meetingId: string | null;
}

export interface PipelineStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
  totalChunks: number;
}

function deriveMeetingStatus(
  hasEmbeddings: boolean | null,
  processingStatus: string | null
): PipelineStatus {
  if (hasEmbeddings === true) return "completed";
  if (processingStatus === "failed") return "failed";
  if (processingStatus === "processing") return "processing";
  return "pending";
}

function deriveKnowledgeStatus(processingStatus: string | null): PipelineStatus {
  if (processingStatus === "completed") return "completed";
  if (processingStatus === "failed") return "failed";
  if (processingStatus === "processing") return "processing";
  return "pending";
}

/** Read/write pipeline enabled from system_settings (category ai, key embedding_processing_enabled). */
export function useEmbeddingPipelineSetting() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: PIPELINE_QUERY_KEY,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("value")
        .eq("category", SETTING_CATEGORY)
        .eq("key", SETTING_KEY)
        .maybeSingle();
      if (error) throw error;
      if (!data?.value) return true;
      const v = data.value;
      if (typeof v === "boolean") return v;
      if (typeof v === "string") return v === "true" || v === '"true"';
      return true;
    },
  });

  const mutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase.from("system_settings").upsert(
        {
          category: SETTING_CATEGORY,
          key: SETTING_KEY,
          value: enabled,
          description: "Embedding pipeline enabled (Edge Functions process when true).",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "category,key" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PIPELINE_QUERY_KEY });
    },
  });

  return {
    enabled: query.data ?? true,
    isLoading: query.isLoading,
    error: query.error,
    setEnabled: mutation.mutateAsync,
    isUpdating: mutation.isPending,
  };
}

/** Counts from source tables only: zoom_files + knowledge_files by derived status. */
export function useEmbeddingPipelineStats() {
  return useQuery({
    queryKey: STATS_QUERY_KEY,
    queryFn: async (): Promise<PipelineStats> => {
      const [zfRes, kfRes] = await Promise.all([
        supabase.from("zoom_files").select("has_embeddings, processing_status"),
        supabase.from("knowledge_files").select("processing_status, chunk_count"),
      ]);
      const zf = zfRes.data ?? [];
      const kf = kfRes.data ?? [];

      let pending = 0,
        processing = 0,
        completed = 0,
        failed = 0,
        totalChunks = 0;

      zf.forEach((r: { has_embeddings: boolean | null; processing_status: string | null }) => {
        const s = deriveMeetingStatus(r.has_embeddings, r.processing_status);
        if (s === "pending") pending++;
        else if (s === "processing") processing++;
        else if (s === "completed") completed++;
        else failed++;
      });
      kf.forEach((r: { processing_status: string | null; chunk_count: number | null }) => {
        const s = deriveKnowledgeStatus(r.processing_status);
        if (s === "pending") pending++;
        else if (s === "processing") processing++;
        else if (s === "completed") {
          completed++;
          totalChunks += r.chunk_count ?? 0;
        } else failed++;
      });

      return {
        pending,
        processing,
        completed,
        failed,
        total: zf.length + kf.length,
        totalChunks,
      };
    },
  });
}

/** List from source tables only: zoom_files (join meetings) + knowledge_files (join categories). Paginated, filterable. */
export function useEmbeddingPipelineList(
  statusFilter: PipelineStatus | "all",
  sourceFilter: SourceType | "all",
  search: string,
  page: number,
  pageSize: number = 20
) {
  return useQuery({
    queryKey: [LIST_QUERY_KEY, statusFilter, sourceFilter, search, page, pageSize],
    queryFn: async (): Promise<{ rows: PipelineRow[]; total: number }> => {
      const includeMeetings = sourceFilter === "all" || sourceFilter === "meeting";
      const includeKnowledge = sourceFilter === "all" || sourceFilter === "knowledge";

      const rows: PipelineRow[] = [];

      if (includeMeetings) {
        const { data: zfData } = await supabase
          .from("zoom_files")
          .select("id, file_name, meeting_id, has_embeddings, processing_status, updated_at")
          .order("updated_at", { ascending: false });

        const zfList = zfData ?? [];
        const meetingIds = [...new Set(zfList.map((z: { meeting_id: string }) => z.meeting_id).filter(Boolean))];
        let meetingTitles: Record<string, string> = {};
        if (meetingIds.length > 0) {
          const { data: meetingsData } = await supabase
            .from("meetings")
            .select("id, title")
            .in("id", meetingIds);
          meetingTitles = (meetingsData ?? []).reduce(
            (acc: Record<string, string>, m: { id: string; title: string }) => {
              acc[m.id] = m.title ?? "";
              return acc;
            },
            {}
          );
        }

        zfList.forEach((z: {
          id: string;
          file_name: string;
          meeting_id: string;
          has_embeddings: boolean | null;
          processing_status: string | null;
          updated_at: string;
        }) => {
          const status = deriveMeetingStatus(z.has_embeddings, z.processing_status);
          const name = meetingTitles[z.meeting_id] || z.file_name || "Meeting";
          rows.push({
            id: `meeting-${z.id}`,
            sourceType: "meeting",
            sourceId: z.id,
            name,
            context: "—",
            status,
            chunks: 0,
            date: z.updated_at ?? null,
            error: null,
            meetingId: z.meeting_id ?? null,
          });
        });
      }

      if (includeKnowledge) {
        const { data: kfData } = await supabase
          .from("knowledge_files")
          .select("id, title, file_name, category_id, processing_status, processing_error, chunk_count, processed_at, updated_at")
          .order("updated_at", { ascending: false });

        const kfList = kfData ?? [];
        const catIds = [...new Set(kfList.map((k: { category_id: string | null }) => k.category_id).filter(Boolean))];
        let categoryNames: Record<string, string> = {};
        if (catIds.length > 0) {
          const { data: catData } = await supabase
            .from("knowledge_categories")
            .select("id, name")
            .in("id", catIds);
          categoryNames = (catData ?? []).reduce(
            (acc: Record<string, string>, c: { id: string; name: string }) => {
              acc[c.id] = c.name ?? "";
              return acc;
            },
            {}
          );
        }

        kfList.forEach((k: {
          id: string;
          title: string;
          file_name: string;
          category_id: string | null;
          processing_status: string | null;
          processing_error: string | null;
          chunk_count: number | null;
          processed_at: string | null;
          updated_at: string | null;
        }) => {
          const status = deriveKnowledgeStatus(k.processing_status);
          const name = k.title || k.file_name || "Document";
          const context = k.category_id ? categoryNames[k.category_id] ?? "—" : "—";
          rows.push({
            id: `knowledge-${k.id}`,
            sourceType: "knowledge",
            sourceId: k.id,
            name,
            context,
            status,
            chunks: k.chunk_count ?? 0,
            date: k.processed_at ?? k.updated_at ?? null,
            error: k.processing_error ?? null,
            meetingId: null,
          });
        });
      }

      rows.sort((a, b) => {
        const da = a.date ?? "";
        const db = b.date ?? "";
        return db.localeCompare(da);
      });

      let filtered = rows;
      if (statusFilter !== "all") {
        filtered = filtered.filter((r) => r.status === statusFilter);
      }
      if (search.trim()) {
        const lower = search.trim().toLowerCase();
        filtered = filtered.filter(
          (r) =>
            r.name.toLowerCase().includes(lower) ||
            r.context.toLowerCase().includes(lower)
        );
      }

      const total = filtered.length;
      const start = (page - 1) * pageSize;
      const paginated = filtered.slice(start, start + pageSize);

      return { rows: paginated, total };
    },
  });
}

/** Retry failed: set meeting/knowledge source back to pending and clear error, then optionally trigger process. */
export function useEmbeddingPipelineRetryFailed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (opts?: { meetingsOnly?: boolean }) => {
      if (opts?.meetingsOnly !== false) {
        await supabase
          .from("zoom_files")
          .update({ processing_status: "pending", has_embeddings: false })
          .eq("processing_status", "failed");
      }
      const { data: kf } = await supabase
        .from("knowledge_files")
        .select("id")
        .eq("processing_status", "failed");
      if (kf?.length) {
        await supabase
          .from("knowledge_files")
          .update({ processing_status: "pending", processing_error: null })
          .in("id", kf.map((r) => r.id));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STATS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: LIST_QUERY_KEY });
    },
  });
}

export function invalidateEmbeddingPipelineQueries(queryClient: { invalidateQueries: (opts: { queryKey: string[] }) => void }) {
  queryClient.invalidateQueries({ queryKey: STATS_QUERY_KEY });
  queryClient.invalidateQueries({ queryKey: LIST_QUERY_KEY });
}
