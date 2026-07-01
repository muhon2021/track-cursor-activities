/**
 * Meetings with Categorizations Hook
 *
 * Fetches meetings joined with their categorization data from the
 * meeting_categorizations table. Supports filtering by category.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const MEETINGS_CATEGORIZED_KEY = "meetings-with-categorizations";

interface MeetingWithCategorization {
  id: string;
  title: string;
  scheduled_at: string | null;
  status: string | null;
  slug: string | null;
  meeting_categorizations: {
    category: string;
    confidence: number;
    meeting_type: string | null;
    tags: string[] | null;
  }[];
}

interface MeetingCategorizationFilters {
  category?: string;
}

/**
 * Fetch meetings with their categorization data.
 * Optionally filter to only show meetings of a specific category.
 */
export function useMeetingsWithCategorizations(filters?: MeetingCategorizationFilters) {
  return useQuery({
    queryKey: [MEETINGS_CATEGORIZED_KEY, filters],
    queryFn: async (): Promise<MeetingWithCategorization[]> => {
      let query = supabase
        .from("meetings")
        .select(
          "id, title, scheduled_at, status, slug, meeting_categorizations(category, confidence, meeting_type, tags)"
        )
        .order("scheduled_at", { ascending: false });

      const { data, error } = await query;

      if (error) throw error;

      let results = (data || []) as unknown as MeetingWithCategorization[];

      // Filter by category client-side since the join doesn't support direct filtering
      if (filters?.category) {
        results = results.filter((meeting) =>
          meeting.meeting_categorizations.some(
            (cat) => cat.category === filters.category
          )
        );
      }

      return results;
    },
  });
}
