/**
 * Meeting Transcript Summary Hook
 *
 * Fetches the AI-generated summary for a meeting and provides a mutation
 * to generate or regenerate the summary via the edge function.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const TRANSCRIPT_SUMMARY_KEY = "meeting-transcript-summary";

interface TranscriptSummaryData {
  id: string;
  ai_summary: string | null;
}

interface GenerateSummaryResult {
  meeting_id: string;
  summary: string;
}

/**
 * Fetch the AI summary for a specific meeting.
 */
export function useMeetingTranscriptSummary(meetingId: string) {
  return useQuery({
    queryKey: [TRANSCRIPT_SUMMARY_KEY, meetingId],
    queryFn: async (): Promise<TranscriptSummaryData> => {
      const { data, error } = await supabase
        .from("meetings")
        .select("id, ai_summary")
        .eq("id", meetingId)
        .single();

      if (error) throw error;
      return data as unknown as TranscriptSummaryData;
    },
    enabled: !!meetingId,
  });
}

/**
 * Generate or regenerate the AI transcript summary for a meeting.
 */
export function useGenerateTranscriptSummary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      meeting_id,
    }: {
      meeting_id: string;
    }): Promise<GenerateSummaryResult> => {
      const { data, error } = await supabase.functions.invoke(
        "generate-meeting-summary-v2",
        {
          body: { meeting_id },
        }
      );

      if (error) throw error;
      return data as GenerateSummaryResult;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: [TRANSCRIPT_SUMMARY_KEY, vars.meeting_id] });
      queryClient.invalidateQueries({ queryKey: ["meeting-transcripts"] });
      toast.success("Transcript summary generated");
    },
    onError: (error: Error) => {
      toast.error("Failed to generate transcript summary", {
        description: error.message,
      });
    },
  });
}
