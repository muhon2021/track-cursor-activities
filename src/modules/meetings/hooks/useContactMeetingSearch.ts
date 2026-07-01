/**
 * Contact Meeting Search Hook
 *
 * Searches meetings linked to a specific contact via the contact_meeting_links
 * join table, filtered by title ilike match.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeSearchInput } from "@/lib/sanitize";

const CONTACT_MEETING_SEARCH_KEY = "contact-meeting-search";

interface ContactMeetingSearchResult {
  id: string;
  contact_id: string;
  meeting_id: string;
  created_at: string;
  meeting: {
    id: string;
    title: string;
    scheduled_at: string | null;
    status: string | null;
    duration_minutes: number | null;
    slug: string | null;
  } | null;
}

/**
 * Search meetings linked to a specific contact by title.
 * Only executes when contactId is provided and query is at least 2 characters.
 */
export function useContactMeetingSearch(contactId: string, query: string) {
  return useQuery({
    queryKey: [CONTACT_MEETING_SEARCH_KEY, contactId, query],
    queryFn: async (): Promise<ContactMeetingSearchResult[]> => {
      const { data, error } = await (supabase as any)
        .from("contact_meeting_links")
        .select(
          "id, contact_id, meeting_id, created_at, meeting:meetings!inner(id, title, scheduled_at, status, duration_minutes, slug)"
        )
        .eq("contact_id", contactId)
        .ilike("meetings.title" as any, `%${sanitizeSearchInput(query)}%`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as ContactMeetingSearchResult[];
    },
    enabled: !!contactId && query.length >= 2,
  });
}
