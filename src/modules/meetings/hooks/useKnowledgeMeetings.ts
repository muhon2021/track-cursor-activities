/**
 * Knowledge Meetings Hook
 *
 * Fetches meetings in the context of the knowledge base, filtering
 * by embedding status and search terms. Used for meetings that have
 * been embedded or have AI summaries available.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeSearchInput } from "@/lib/sanitize";

const KNOWLEDGE_MEETINGS_KEY = "knowledge-meetings";

interface KnowledgeMeeting {
  id: string;
  title: string;
  description: string | null;
  scheduled_at: string | null;
  status: string | null;
  slug: string | null;
  ai_summary: string | null;
  embedding_status: string | null;
  duration_minutes: number | null;
  client_id: string | null;
  clients: { name: string } | null;
}

interface KnowledgeMeetingsFilters {
  search?: string;
  hasEmbeddings?: boolean;
}

/**
 * Fetch meetings that have embeddings or summaries available
 * for knowledge base context. Supports search by title and
 * filtering by embedding status.
 */
export function useKnowledgeMeetings(filters?: KnowledgeMeetingsFilters) {
  return useQuery({
    queryKey: [KNOWLEDGE_MEETINGS_KEY, filters],
    queryFn: async (): Promise<KnowledgeMeeting[]> => {
      let query = (supabase as any)
        .from("meetings")
        .select(
          "id, title, description, scheduled_at, status, slug, ai_summary, embedding_status, duration_minutes, client_id, clients(name)"
        )
        .order("scheduled_at", { ascending: false });

      if (filters?.hasEmbeddings) {
        query = query.eq("embedding_status", "completed");
      }

      if (filters?.search && filters.search.length >= 2) {
        query = query.ilike("title", `%${sanitizeSearchInput(filters.search)}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as unknown as KnowledgeMeeting[];
    },
  });
}
