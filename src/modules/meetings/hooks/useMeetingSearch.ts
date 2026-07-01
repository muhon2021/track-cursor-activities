/**
 * Meeting Search Hook
 *
 * Full-text search across meetings by title and description.
 * Supports optional filters for status and client_id.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeSearchInput } from "@/lib/sanitize";

const MEETING_SEARCH_KEY = "meeting-search";

interface MeetingSearchResult {
  id: string;
  title: string;
  description: string | null;
  scheduled_at: string | null;
  status: string | null;
  duration_minutes: number | null;
  slug: string | null;
  client_id: string | null;
  clients: { name: string } | null;
}

interface MeetingSearchFilters {
  status?: string;
  client_id?: string;
}

/**
 * Search meetings by title or description with optional status/client filters.
 * Only executes when query is at least 2 characters.
 */
export function useMeetingSearch(query: string, filters?: MeetingSearchFilters) {
  return useQuery({
    queryKey: [MEETING_SEARCH_KEY, query, filters],
    queryFn: async (): Promise<MeetingSearchResult[]> => {
      let dbQuery = supabase
        .from("meetings")
        .select(
          "id, title, description, scheduled_at, status, duration_minutes, slug, client_id, clients(name)"
        )
        .or(`title.ilike.%${sanitizeSearchInput(query)}%,description.ilike.%${sanitizeSearchInput(query)}%`)
        .order("scheduled_at", { ascending: false })
        .limit(50);

      if (filters?.status) {
        dbQuery = dbQuery.eq("status", filters.status);
      }

      if (filters?.client_id) {
        dbQuery = dbQuery.eq("client_id", filters.client_id);
      }

      const { data, error } = await dbQuery;

      if (error) throw error;
      return (data || []) as unknown as MeetingSearchResult[];
    },
    enabled: query.length >= 2,
  });
}
