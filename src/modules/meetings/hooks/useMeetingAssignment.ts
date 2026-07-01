/**
 * Meeting Assignment Hook
 *
 * Manages the meeting_assignments table for linking meetings to entities
 * (clients, projects, deals). Provides queries for per-meeting assignments,
 * per-entity meeting lookups, and mutations to assign/unassign meetings.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { MeetingAssignment, AssignmentEntityType } from "../types";

const ASSIGNMENTS_KEY = "meeting-assignments";

interface AssignmentWithMeeting extends MeetingAssignment {
  meeting?: { id: string; title: string; scheduled_at: string | null } | null;
}

/**
 * Fetch all assignments for a meeting.
 */
export function useMeetingAssignments(meetingId: string) {
  return useQuery({
    queryKey: [ASSIGNMENTS_KEY, meetingId],
    queryFn: async (): Promise<MeetingAssignment[]> => {
      const { data, error } = await supabase
        .from("meeting_assignments")
        .select("*")
        .eq("meeting_id", meetingId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as MeetingAssignment[];
    },
    enabled: !!meetingId,
  });
}

/**
 * Fetch all meetings linked to a specific entity (client, project, or deal).
 */
export function useEntityMeetings(entityType: AssignmentEntityType, entityId: string) {
  return useQuery({
    queryKey: [ASSIGNMENTS_KEY, "entity", entityType, entityId],
    queryFn: async (): Promise<AssignmentWithMeeting[]> => {
      const { data, error } = await supabase
        .from("meeting_assignments")
        .select("*, meeting:meetings(id, title, scheduled_at)")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as AssignmentWithMeeting[];
    },
    enabled: !!entityType && !!entityId,
  });
}

/**
 * Create a meeting assignment (link a meeting to an entity).
 */
export function useAssignMeeting() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      meetingId,
      entityType,
      entityId,
    }: {
      meetingId: string;
      entityType: AssignmentEntityType;
      entityId: string;
    }) => {
      const { data: assignment, error } = await supabase
        .from("meeting_assignments")
        .insert({
          meeting_id: meetingId,
          entity_type: entityType,
          entity_id: entityId,
          assigned_by: user?.id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return assignment;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: [ASSIGNMENTS_KEY, vars.meetingId] });
      queryClient.invalidateQueries({
        queryKey: [ASSIGNMENTS_KEY, "entity", vars.entityType, vars.entityId],
      });
      toast.success("Meeting assigned");
    },
    onError: (error: Error) => {
      toast.error("Failed to assign meeting", { description: error.message });
    },
  });
}

/**
 * Remove a meeting assignment by id.
 */
export function useUnassignMeeting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      meetingId,
      entityType,
      entityId,
    }: {
      id: string;
      meetingId: string;
      entityType?: AssignmentEntityType;
      entityId?: string;
    }) => {
      const { error } = await supabase
        .from("meeting_assignments")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: [ASSIGNMENTS_KEY, vars.meetingId] });
      if (vars.entityType && vars.entityId) {
        queryClient.invalidateQueries({
          queryKey: [ASSIGNMENTS_KEY, "entity", vars.entityType, vars.entityId],
        });
      }
      toast.success("Meeting unassigned");
    },
    onError: (error: Error) => {
      toast.error("Failed to unassign meeting", { description: error.message });
    },
  });
}
