/**
 * Deal Meetings Hook
 *
 * Fetches meetings linked to a specific deal. Uses the meetings table
 * directly via the deal_id column, ordered by scheduled_at descending.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const DEAL_MEETINGS_KEY = "deal-meetings";

interface DealMeeting {
  id: string;
  title: string;
  scheduled_at: string | null;
  status: string | null;
  duration_minutes: number | null;
  slug: string | null;
}

/**
 * Fetch all meetings linked to a specific deal via meetings.deal_id.
 */
export function useDealMeetings(dealId: string) {
  return useQuery({
    queryKey: [DEAL_MEETINGS_KEY, dealId],
    queryFn: async (): Promise<DealMeeting[]> => {
      const { data, error } = await (supabase as any)
        .from("meetings")
        .select("id, title, scheduled_at, status, duration_minutes, slug")
        .eq("deal_id", dealId)
        .order("scheduled_at", { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as DealMeeting[];
    },
    enabled: !!dealId,
  });
}
