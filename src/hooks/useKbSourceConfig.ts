import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/cache";
import { toast } from "sonner";
import type {
  ChunkPreviewResult,
  ChunkStrategy,
  GlobalRerankerSettings,
  KbSourceConfigRow,
  RerankerProvider,
} from "@/types/knowledgeRag";

export function useKbSourceConfigs() {
  return useQuery({
    queryKey: queryKeys.knowledge.sourceConfig,
    queryFn: async () => {
      const { data: sources, error: sErr } = await supabase
        .from("knowledge_sources")
        .select("id, name, source_type, is_active")
        .order("name");
      if (sErr) throw sErr;

      const { data: configs, error: cErr } = await supabase
        .from("kb_source_config")
        .select("*");
      if (cErr) throw cErr;

      const configMap = new Map((configs ?? []).map((c) => [c.source_id, c as KbSourceConfigRow]));
      return (sources ?? []).map((s) => ({
        source: s,
        config: configMap.get(s.id) ?? null,
      }));
    },
  });
}

export function useGlobalRerankerSettings() {
  return useQuery({
    queryKey: queryKeys.knowledge.globalReranker,
    queryFn: async (): Promise<GlobalRerankerSettings> => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("key, value")
        .eq("category", "rag");
      if (error) throw error;
      const map: Record<string, unknown> = {};
      for (const row of data ?? []) {
        map[row.key] = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
      }
      return {
        reranker_provider: (map.reranker_provider as RerankerProvider) ?? "cohere",
        reranker_threshold: Number(map.reranker_threshold ?? 0.75),
        reranker_max_results: Number(map.reranker_max_results ?? 10),
        reranker_enabled: Boolean(map.reranker_enabled ?? false),
      };
    },
  });
}

export function useUpsertKbSourceConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      source_id: string;
      chunk_size: number;
      chunk_overlap: number;
      chunk_strategy: ChunkStrategy;
      strategy_config?: Record<string, unknown>;
      reranker_provider?: RerankerProvider | null;
      reranker_threshold?: number;
      reranker_max_results?: number;
      reranker_enabled?: boolean;
      reranker_override_global?: boolean;
    }) => {
      const { data, error } = await (supabase
        .from("kb_source_config") as any)
        .upsert(input, { onConflict: "source_id" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.sourceConfig });
      toast.success("Source configuration saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateGlobalReranker() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (settings: GlobalRerankerSettings) => {
      const rows = [
        { category: "rag", key: "reranker_provider", value: settings.reranker_provider },
        { category: "rag", key: "reranker_threshold", value: settings.reranker_threshold },
        { category: "rag", key: "reranker_max_results", value: settings.reranker_max_results },
        { category: "rag", key: "reranker_enabled", value: settings.reranker_enabled },
      ];
      for (const row of rows) {
        const { error } = await supabase.from("system_settings").upsert(
          { ...row, description: "RAG reranker global default", updated_at: new Date().toISOString() },
          { onConflict: "category,key" }
        );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.globalReranker });
      toast.success("Global reranker settings saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useChunkPreview() {
  return useMutation({
    mutationFn: async (input: {
      sample_text: string;
      chunk_size: number;
      chunk_overlap: number;
      chunk_strategy: ChunkStrategy;
      strategy_config?: Record<string, unknown>;
    }): Promise<ChunkPreviewResult> => {
      const { data, error } = await supabase.functions.invoke("kb-chunk-preview", { body: input });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as ChunkPreviewResult;
    },
  });
}
