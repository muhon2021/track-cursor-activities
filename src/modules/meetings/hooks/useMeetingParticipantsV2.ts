/**
 * Meeting Participants V2 - meeting_participants table
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MeetingParticipantV2Row {
  id: string;
  meeting_id: string;
  user_id: string | null;
  external_email: string | null;
  external_name: string | null;
  role: string;
  status: string;
  attended: boolean | null;
  notes: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
}

const db = supabase as any;

export function useMeetingParticipantsV2(meetingId: string | undefined) {
  return useQuery({
    queryKey: ["meetings-v2", "participants", meetingId],
    queryFn: async (): Promise<MeetingParticipantV2Row[]> => {
      if (!meetingId) return [];
      const { data, error } = await db
        .from("meeting_participants")
        .select("*")
        .eq("meeting_id", meetingId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as MeetingParticipantV2Row[];
    },
    enabled: !!meetingId,
  });
}
