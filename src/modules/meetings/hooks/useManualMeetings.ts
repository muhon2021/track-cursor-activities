/**
 * Manual Meetings Hook
 *
 * Fetches meetings that were manually created (not from external sync).
 * Filters for meetings with no external_id and no provider or provider = 'other'.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const MANUAL_MEETINGS_KEY = "manual-meetings";

interface ManualMeeting {
  id: string;
  title: string;
  description: string | null;
  scheduled_at: string | null;
  duration_minutes: number | null;
  status: string | null;
  slug: string | null;
  client_id: string | null;
  meeting_type: string | null;
  organizer_id: string;
  created_at: string;
  clients: { name: string } | null;
}

interface ManualMeetingsFilters {
  status?: string;
}

/**
 * Fetch manually created meetings (not synced from external providers).
 * These are identified by having no external_id.
 */
export function useManualMeetings(filters?: ManualMeetingsFilters) {
  return useQuery({
    queryKey: [MANUAL_MEETINGS_KEY, filters],
    queryFn: async (): Promise<ManualMeeting[]> => {
      let query = supabase
        .from("meetings")
        .select(
          "id, title, description, scheduled_at, duration_minutes, status, slug, client_id, meeting_type, organizer_id, created_at, clients(name)"
        )
        .is("external_id", null)
        .order("scheduled_at", { ascending: false });

      if (filters?.status) {
        query = query.eq("status", filters.status);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as unknown as ManualMeeting[];
    },
  });
}
