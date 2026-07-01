/**
 * Meeting Participants Hook - CRUD operations for meeting_participants
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { MeetingParticipant, ParticipantRole, RSVPStatus } from "../types/index";

const PARTICIPANTS_KEY = "meeting-participants";

/**
 * Fetch participants for a meeting
 */
export function useMeetingParticipants(meetingId: string | undefined) {
  return useQuery({
    queryKey: [PARTICIPANTS_KEY, meetingId],
    queryFn: async (): Promise<MeetingParticipant[]> => {
      if (!meetingId) return [];

      const { data, error } = await (supabase as any)
        .from("meeting_participants")
        .select(`
          *,
          user:profiles!meeting_participants_user_id_fkey(id, full_name, email, avatar_url)
        `)
        .eq("meeting_id", meetingId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []).map((p: any) => ({
        ...p,
        user: p.user || null,
      })) as MeetingParticipant[];
    },
    enabled: !!meetingId,
  });
}

/**
 * Add a participant
 */
export function useAddParticipant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      meetingId,
      userId,
      email,
      name,
      externalEmail,
      externalName,
      role,
      rsvpStatus,
    }: {
      meetingId: string;
      userId?: string;
      email?: string;
      name?: string;
      externalEmail?: string;
      externalName?: string;
      role?: ParticipantRole;
      rsvpStatus?: RSVPStatus;
    }): Promise<MeetingParticipant> => {
      const finalEmail = email || externalEmail;
      const finalName = name || externalName;

      const { data, error } = await (supabase as any)
        .from("meeting_participants")
        .insert({
          meeting_id: meetingId,
          user_id: userId || null,
          email: finalEmail || null,
          name: finalName || null,
          role: role || "attendee",
          rsvp_status: rsvpStatus || "pending",
          attended: false,
        })
        .select()
        .single();

      if (error) throw error;
      return data as MeetingParticipant;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [PARTICIPANTS_KEY, variables.meetingId] });
      queryClient.invalidateQueries({ queryKey: ["meetings-v2", "participants", variables.meetingId] });
      toast.success("Participant added");
    },
    onError: (error: Error) => {
      toast.error(`Failed to add participant: ${error.message}`);
    },
  });
}

/**
 * Update a participant
 */
export function useUpdateParticipant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Pick<MeetingParticipant, "role" | "rsvp_status">>;
    }): Promise<MeetingParticipant> => {
      const { data, error } = await (supabase as any)
        .from("meeting_participants")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as MeetingParticipant;
    },
    onSuccess: (participant) => {
      queryClient.invalidateQueries({ queryKey: [PARTICIPANTS_KEY, participant.meeting_id] });
      toast.success("Participant updated");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update participant: ${error.message}`);
    },
  });
}

/**
 * Update participant attendance
 */
export function useUpdateParticipantAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      meetingId,
      attended,
    }: {
      id: string;
      meetingId: string;
      attended: boolean;
    }): Promise<MeetingParticipant> => {
      const { data, error } = await (supabase as any)
        .from("meeting_participants")
        .update({
          attended,
          ...(attended ? { rsvp_status: "accepted" } : {}),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as MeetingParticipant;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [PARTICIPANTS_KEY, variables.meetingId] });
      toast.success("Attendance updated");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update attendance: ${error.message}`);
    },
  });
}

/**
 * Remove a participant
 */
export function useRemoveParticipant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      meetingId,
    }: {
      id: string;
      meetingId?: string;
    }): Promise<{ meeting_id: string }> => {
      const { data: participant } = await (supabase as any)
        .from("meeting_participants")
        .select("meeting_id")
        .eq("id", id)
        .single();

      const { error } = await (supabase as any).from("meeting_participants").delete().eq("id", id);

      if (error) throw error;
      const finalMeetingId = meetingId || participant?.meeting_id || "";
      return { meeting_id: finalMeetingId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [PARTICIPANTS_KEY] });
      if (result.meeting_id) {
        queryClient.invalidateQueries({ queryKey: [PARTICIPANTS_KEY, result.meeting_id] });
      }
      toast.success("Participant removed");
    },
    onError: (error: Error) => {
      toast.error(`Failed to remove participant: ${error.message}`);
    },
  });
}
