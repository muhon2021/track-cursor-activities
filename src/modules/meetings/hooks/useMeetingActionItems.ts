/**
 * Meeting Action Items Hook
 *
 * Queries meeting_takeaways filtered by takeaway_type = 'action_item'.
 * Provides per-meeting action items, user-specific action items across all meetings,
 * and aggregate action item statistics (total, completed, overdue, upcoming).
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { MeetingTakeaway } from "../types";

const ACTION_ITEMS_KEY = "meeting-action-items";

interface ActionItemWithMeeting extends MeetingTakeaway {
  meeting?: { id: string; title: string; scheduled_at: string | null } | null;
}

/**
 * Fetch action items for a single meeting.
 */
export function useMeetingActionItems(meetingId: string) {
  return useQuery({
    queryKey: [ACTION_ITEMS_KEY, meetingId],
    queryFn: async (): Promise<MeetingTakeaway[]> => {
      const { data, error } = await supabase
        .from("meeting_takeaways")
        .select("*")
        .eq("meeting_id", meetingId)
        .eq("takeaway_type", "action_item")
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as MeetingTakeaway[];
    },
    enabled: !!meetingId,
  });
}

/**
 * Fetch all action items assigned to the current user across all meetings,
 * with meeting title joined.
 */
export function useMyActionItems() {
  const { user } = useAuth();

  return useQuery({
    queryKey: [ACTION_ITEMS_KEY, "my", user?.id],
    queryFn: async (): Promise<ActionItemWithMeeting[]> => {
      const { data, error } = await supabase
        .from("meeting_takeaways")
        .select("*, meeting:meetings(id, title, scheduled_at)")
        .eq("takeaway_type", "action_item")
        .eq("assigned_to", user!.id)
        .order("due_date", { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as ActionItemWithMeeting[];
    },
    enabled: !!user?.id,
  });
}

/**
 * Compute action item statistics for the current user:
 * total, completed, overdue (due_date < today & not completed),
 * upcoming (due_date within 7 days & not completed).
 */
export function useActionItemStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: [ACTION_ITEMS_KEY, "stats", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_takeaways")
        .select("*")
        .eq("takeaway_type", "action_item")
        .eq("assigned_to", user!.id);

      if (error) throw error;

      const items = (data || []) as unknown as MeetingTakeaway[];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const sevenDaysFromNow = new Date(today);
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

      const total = items.length;
      const completed = items.filter((i) => i.is_completed).length;
      const overdue = items.filter(
        (i) => !i.is_completed && i.due_date && new Date(i.due_date) < today
      ).length;
      const upcoming = items.filter(
        (i) =>
          !i.is_completed &&
          i.due_date &&
          new Date(i.due_date) >= today &&
          new Date(i.due_date) <= sevenDaysFromNow
      ).length;

      return { total, completed, overdue, upcoming };
    },
    enabled: !!user?.id,
  });
}
