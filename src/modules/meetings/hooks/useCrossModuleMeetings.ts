/**
 * Cross-Module Meeting Hooks
 *
 * Query meetings linked to clients, deals, or projects via the
 * meeting_assignments table. Each hook joins through the assignment
 * to return meeting details for a specific entity.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const CROSS_MEETINGS_KEY = "cross-meetings";

interface LinkedMeeting {
  id: string;
  title: string;
  scheduled_at: string | null;
  status: string | null;
  duration_minutes: number | null;
}

interface MeetingAssignmentWithMeeting {
  id: string;
  meeting_id: string;
  entity_type: string;
  entity_id: string;
  assigned_by: string | null;
  created_at: string;
  meeting: LinkedMeeting | null;
}

/**
 * Fetch all meetings linked to a specific client.
 */
export function useClientMeetings(clientId: string | undefined) {
  return useQuery({
    queryKey: [CROSS_MEETINGS_KEY, "client", clientId],
    queryFn: async (): Promise<MeetingAssignmentWithMeeting[]> => {
      const { data, error } = await supabase
        .from("meeting_assignments")
        .select(
          "*, meeting:meeting_id(id, title, scheduled_at, status, duration_minutes)"
        )
        .eq("entity_type", "client")
        .eq("entity_id", clientId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as MeetingAssignmentWithMeeting[];
    },
    enabled: !!clientId,
  });
}

/**
 * Fetch all meetings linked to a specific deal.
 */
export function useDealMeetings(dealId: string | undefined) {
  return useQuery({
    queryKey: [CROSS_MEETINGS_KEY, "deal", dealId],
    queryFn: async (): Promise<MeetingAssignmentWithMeeting[]> => {
      const { data, error } = await supabase
        .from("meeting_assignments")
        .select(
          "*, meeting:meeting_id(id, title, scheduled_at, status, duration_minutes)"
        )
        .eq("entity_type", "deal")
        .eq("entity_id", dealId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as MeetingAssignmentWithMeeting[];
    },
    enabled: !!dealId,
  });
}

/**
 * Fetch all meetings linked to a specific project.
 */
export function useProjectMeetings(projectId: string | undefined) {
  return useQuery({
    queryKey: [CROSS_MEETINGS_KEY, "project", projectId],
    queryFn: async (): Promise<MeetingAssignmentWithMeeting[]> => {
      const { data, error } = await supabase
        .from("meeting_assignments")
        .select(
          "*, meeting:meeting_id(id, title, scheduled_at, status, duration_minutes)"
        )
        .eq("entity_type", "project")
        .eq("entity_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as MeetingAssignmentWithMeeting[];
    },
    enabled: !!projectId,
  });
}
