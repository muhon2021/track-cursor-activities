/**
 * Admin semantic search: calls semantic-search Edge Function with
 * query, limit, similarity_threshold, entity_types, and optional
 * project_name, project_manager, client_name filters.
 */
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
export interface AdminSemanticSearchParams {
  query: string;
  limit?: number;
  similarity_threshold?: number;
  entity_types?: string[];
  project_name?: string;
  project_manager?: string;
  client_name?: string;
}

export interface AdminSemanticSearchResult {
  id: string;
  entity_type: string;
  entity_id: string;
  content: string;
  metadata?: Record<string, unknown>;
  similarity: number;
  project_name?: string | null;
  project_manager?: string | null;
  client_name?: string | null;
}

export interface AdminSemanticSearchResponse {
  success: boolean;
  results: AdminSemanticSearchResult[];
  count: number;
}

export function useAdminSemanticSearch() {
  const { user } = useAuth();

  const mutation = useMutation({
    mutationFn: async (
      params: AdminSemanticSearchParams
    ): Promise<AdminSemanticSearchResult[]> => {
      const {
        query,
        limit = 10,
        similarity_threshold = 0.7,
        entity_types,
        project_name,
        project_manager,
        client_name,
      } = params;

      const { data, error } = await supabase.functions.invoke(
        "semantic-search",
        {
          body: {
            query: query.trim(),
            limit,
            similarity_threshold,
            entity_types: entity_types?.length ? entity_types : undefined,
            user_id: user?.id ?? undefined,
            project_name: project_name?.trim() || undefined,
            project_manager: project_manager?.trim() || undefined,
            client_name: client_name?.trim() || undefined,
          },
        }
      );

      if (error) throw error;

      const payload = data as AdminSemanticSearchResponse | undefined;
      if (!payload?.success) {
        throw new Error(
          (payload as { error?: string })?.error ?? "Search failed"
        );
      }

      return payload.results ?? [];
    },
    onError: (err: unknown) => {
      console.error("Admin semantic search error:", err);
      toast.error(
        err instanceof Error ? err.message : "Search failed. Ensure semantic-search is deployed."
      );
    },
    onSuccess: (results) => {
      if (results.length === 0) {
        toast.info("No results found");
      }
    },
  });

  return {
    search: mutation.mutateAsync,
    mutate: mutation.mutate,
    results: mutation.data ?? [],
    isSearching: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
  };
}
