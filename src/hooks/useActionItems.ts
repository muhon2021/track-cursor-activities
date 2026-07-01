/**
 * useActionItems
 *
 * Fetches AI-extracted action items for a single meeting from
 * the meeting_action_items table.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/cache";

export interface ActionItem {
  id: string;
  meeting_id: string;
  text: string;
  assignee_id: string | null;
  assignee_email: string | null;
  due_date: string | null;
  priority: string | null;
  status: string | null;
  task_id: string | null;
  extraction_confidence: number | null;
  extracted_from_transcript: boolean | null;
  created_at: string;
  updated_at: string;
}

export function useActionItems(meetingId: string) {
  const { data, isLoading, error } = useQuery<ActionItem[]>({
    queryKey: queryKeys.meetings.actionItems(meetingId),
    queryFn: async (): Promise<ActionItem[]> => {
      const { data, error: dbError } = await supabase
        .from("meeting_action_items")
        .select("*")
        .eq("meeting_id", meetingId)
        .order("created_at", { ascending: true });

      if (dbError) throw dbError;
      return (data ?? []) as ActionItem[];
    },
    enabled: !!meetingId,
  });

  return {
    actionItems: data ?? [],
    isLoading,
    error,
  };
}
