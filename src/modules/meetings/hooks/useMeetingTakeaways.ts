/**
 * Meeting Takeaways Hook - CRUD operations for meeting_takeaways
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { MeetingTakeaway } from "../types/index";

const TAKEAWAYS_KEY = "meeting-takeaways";

/**
 * Fetch takeaways for a meeting
 */
export function useMeetingTakeaways(meetingId: string | undefined) {
  return useQuery({
    queryKey: [TAKEAWAYS_KEY, meetingId],
    queryFn: async (): Promise<MeetingTakeaway[]> => {
      if (!meetingId) return [];

      const { data, error } = await (supabase as any)
        .from("meeting_takeaways")
        .select(`
          *,
          assignee:profiles!meeting_takeaways_assigned_to_fkey(id, full_name, email)
        `)
        .eq("meeting_id", meetingId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []).map((item: any) => ({
        ...item,
        assignee: item.assignee || null,
      })) as MeetingTakeaway[];
    },
    enabled: !!meetingId,
  });
}

/**
 * Add a takeaway
 */
export function useAddTakeaway() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      meetingId,
      data,
    }: {
      meetingId: string;
      data: {
        content: string;
        takeaway_type?: string;
        agenda_item_id?: string;
        assigned_to?: string;
        due_date?: string;
        priority?: string;
        status?: string;
      };
    }): Promise<MeetingTakeaway> => {
      if (!user) throw new Error("User not authenticated");

      const { data: takeaway, error } = await (supabase as any)
        .from("meeting_takeaways")
        .insert({
          meeting_id: meetingId,
          content: data.content,
          takeaway_type: data.takeaway_type || "note",
          agenda_item_id: data.agenda_item_id || null,
          assigned_to: data.assigned_to || null,
          due_date: data.due_date || null,
          priority: data.priority || "medium",
          status: data.status || "open",
          is_completed: false,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return takeaway as MeetingTakeaway;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [TAKEAWAYS_KEY, variables.meetingId] });
      toast.success("Takeaway added");
    },
    onError: (error: Error) => {
      toast.error(`Failed to add takeaway: ${error.message}`);
    },
  });
}

/**
 * Update a takeaway
 */
export function useUpdateTakeaway() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Pick<MeetingTakeaway, "content" | "assigned_to" | "due_date" | "status" | "is_completed" | "takeaway_type" | "priority">>;
    }): Promise<MeetingTakeaway> => {
      const { data, error } = await (supabase as any)
        .from("meeting_takeaways")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as MeetingTakeaway;
    },
    onSuccess: (takeaway) => {
      queryClient.invalidateQueries({ queryKey: [TAKEAWAYS_KEY, takeaway.meeting_id] });
      toast.success("Takeaway updated");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update takeaway: ${error.message}`);
    },
  });
}

/**
 * Toggle takeaway completion status
 */
export function useToggleTakeaway() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      meetingId,
      is_completed,
    }: {
      id: string;
      meetingId: string;
      is_completed: boolean;
    }): Promise<MeetingTakeaway> => {
      const { data, error } = await (supabase as any)
        .from("meeting_takeaways")
        .update({ is_completed, status: is_completed ? "completed" : "open" })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as MeetingTakeaway;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [TAKEAWAYS_KEY, variables.meetingId] });
      toast.success("Takeaway updated");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update takeaway: ${error.message}`);
    },
  });
}

/**
 * Delete a takeaway
 */
export function useDeleteTakeaway() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      meetingId,
    }: {
      id: string;
      meetingId?: string;
    }): Promise<{ meeting_id: string }> => {
      const { data: item } = await (supabase as any)
        .from("meeting_takeaways")
        .select("meeting_id")
        .eq("id", id)
        .single();

      const { error } = await (supabase as any).from("meeting_takeaways").delete().eq("id", id);

      if (error) throw error;
      const finalMeetingId = meetingId || item?.meeting_id || "";
      return { meeting_id: finalMeetingId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [TAKEAWAYS_KEY] });
      if (result.meeting_id) {
        queryClient.invalidateQueries({ queryKey: [TAKEAWAYS_KEY, result.meeting_id] });
      }
      toast.success("Takeaway deleted");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete takeaway: ${error.message}`);
    },
  });
}
