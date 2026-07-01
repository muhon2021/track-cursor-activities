/**
 * Entity Meetings Hook
 *
 * Generic hook for fetching meetings linked to any entity type via the
 * meeting_assignments table. Also provides mutations for adding and
 * removing entity-meeting assignments.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { MeetingAssignment } from "../types";

const ENTITY_MEETINGS_KEY = "entity-meetings";

interface EntityMeetingAssignment extends MeetingAssignment {
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
 * Fetch all meetings linked to a specific entity via meeting_assignments.
 */
export function useEntityMeetings(entityType: string, entityId: string) {
  return useQuery({
    queryKey: [ENTITY_MEETINGS_KEY, entityType, entityId],
    queryFn: async (): Promise<EntityMeetingAssignment[]> => {
      const { data, error } = await supabase
        .from("meeting_assignments")
        .select(
          "*, meeting:meetings(id, title, scheduled_at, status, duration_minutes, slug)"
        )
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as EntityMeetingAssignment[];
    },
    enabled: !!entityType && !!entityId,
  });
}

/**
 * Link a meeting to an entity by inserting into meeting_assignments.
 */
export function useAddEntityMeeting() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      entityType,
      entityId,
      meetingId,
    }: {
      entityType: string;
      entityId: string;
      meetingId: string;
    }) => {
      const { data, error } = await supabase
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
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({
        queryKey: [ENTITY_MEETINGS_KEY, vars.entityType, vars.entityId],
      });
      toast.success("Meeting linked");
    },
    onError: (error: Error) => {
      if (error.message?.includes("unique") || error.message?.includes("duplicate")) {
        toast.error("This meeting is already linked");
      } else {
        toast.error("Failed to link meeting", { description: error.message });
      }
    },
  });
}

/**
 * Remove an entity-meeting assignment by its id.
 */
export function useRemoveEntityMeeting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      entityType,
      entityId,
    }: {
      id: string;
      entityType: string;
      entityId: string;
    }) => {
      const { error } = await supabase
        .from("meeting_assignments")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({
        queryKey: [ENTITY_MEETINGS_KEY, vars.entityType, vars.entityId],
      });
      toast.success("Meeting unlinked");
    },
    onError: (error: Error) => {
      toast.error("Failed to unlink meeting", { description: error.message });
    },
  });
}
