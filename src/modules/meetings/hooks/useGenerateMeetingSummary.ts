/**
 * Generate Meeting Summary Hook
 *
 * Invokes the generate-meeting-summary edge function and stores the AI summary.
 * Returns structured summary data including executive summary, key decisions,
 * action items, and follow-up topics.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface MeetingSummaryResult {
  executive_summary: string;
  key_decisions: string[];
  action_items: string[];
  follow_up_topics: string[];
}

/**
 * Generate an AI summary for a meeting by invoking the edge function.
 */
export function useGenerateMeetingSummary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      meetingId,
      transcriptContent,
    }: {
      meetingId: string;
      transcriptContent?: string;
    }): Promise<MeetingSummaryResult> => {
      const { data, error } = await supabase.functions.invoke(
        "generate-meeting-summary",
        {
          body: {
            meeting_id: meetingId,
            transcript: transcriptContent,
          },
        }
      );

      if (error) throw error;

      return data as MeetingSummaryResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting-transcripts"] });
      toast.success("Meeting summary generated");
    },
    onError: (error: Error) => {
      toast.error("Failed to generate meeting summary", {
        description: error.message,
      });
    },
  });
}
