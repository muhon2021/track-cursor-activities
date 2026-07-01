/**
 * Meeting Host Hook
 *
 * Simple check to determine if the current user is the host (organizer)
 * of a given meeting. Returns { isHost, isLoading }.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const MEETING_HOST_KEY = "meeting-host";

/**
 * Check if the current user is the meeting host/organizer.
 */
export function useMeetingHost(meetingId: string) {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: [MEETING_HOST_KEY, meetingId, user?.id],
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase
        .from("meetings")
        .select("organizer_id")
        .eq("id", meetingId)
        .single();

      if (error) throw error;

      return data?.organizer_id === user?.id;
    },
    enabled: !!meetingId && !!user?.id,
  });

  return {
    isHost: query.data ?? false,
    isLoading: query.isLoading,
  };
}
