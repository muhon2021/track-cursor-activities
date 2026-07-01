/**
 * Extract Meeting Tasks Hook
 *
 * Uses AI to extract action items from meeting transcripts and creates
 * takeaway records. Provides two mutations: one for AI extraction via
 * edge function, and one for batch-inserting confirmed tasks.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface ExtractedTask {
  content: string;
  assignee_hint: string | null;
  due_date_hint: string | null;
  confidence: number;
}

/**
 * Extract action items from a meeting transcript via AI edge function.
 */
export function useExtractMeetingTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      meetingId,
      transcriptContent,
    }: {
      meetingId: string;
      transcriptContent: string;
    }): Promise<ExtractedTask[]> => {
      const { data, error } = await supabase.functions.invoke(
        "extract-meeting-tasks",
        {
          body: {
            meeting_id: meetingId,
            transcript: transcriptContent,
          },
        }
      );

      if (error) throw error;

      return (data?.tasks || data || []) as ExtractedTask[];
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({
        queryKey: ["meeting-takeaways", vars.meetingId],
      });
      toast.success("Tasks extracted from transcript");
    },
    onError: (error: Error) => {
      toast.error("Failed to extract tasks", {
        description: error.message,
      });
    },
  });
}

/**
 * Batch-insert confirmed extracted tasks as meeting takeaways.
 */
export function useCreateTasksFromExtraction() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      meetingId,
      tasks,
    }: {
      meetingId: string;
      tasks: ExtractedTask[];
    }) => {
      const rows = tasks.map((task) => ({
        meeting_id: meetingId,
        content: task.content,
        takeaway_type: "action_item",
        assigned_to: task.assignee_hint || null,
        due_date: task.due_date_hint || null,
        is_completed: false,
        created_by: user?.id || null,
      }));

      const { data, error } = await supabase
        .from("meeting_takeaways")
        .insert(rows)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({
        queryKey: ["meeting-takeaways", vars.meetingId],
      });
      toast.success(`${vars.tasks.length} task(s) created from extraction`);
    },
    onError: (error: Error) => {
      toast.error("Failed to create tasks", {
        description: error.message,
      });
    },
  });
}
