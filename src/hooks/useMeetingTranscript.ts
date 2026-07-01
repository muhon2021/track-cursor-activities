/**
 * useMeetingTranscript
 *
 * Fetches transcript turns from meeting_transcripts table for a single meeting.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/cache";

export interface TranscriptTurn {
  timestamp: string;
  speaker?: string;
  text: string;
}

export interface MeetingTranscript {
  status: "pending" | "processing" | "complete" | "failed";
  turns: TranscriptTurn[];
  content: string | null;
  error: string | null;
}

export function useMeetingTranscript(meetingId: string) {
  const { data, isLoading, error } = useQuery<MeetingTranscript>({
    queryKey: queryKeys.meetings.transcript(meetingId),
    queryFn: async (): Promise<MeetingTranscript> => {
      const { data: turns, error: dbError } = await supabase
        .from("meeting_transcripts")
        .select("speaker, content, created_at")
        .eq("meeting_id", meetingId)
        .order("created_at", { ascending: true });

      if (dbError) throw dbError;

      const parsed: TranscriptTurn[] = (turns ?? []).map((t) => ({
        timestamp: t.created_at,
        speaker: t.speaker ?? undefined,
        text: t.content ?? "",
      }));

      const fullContent = parsed.map((t) => `${t.speaker || "Unknown"}: ${t.text}`).join("\n\n");

      return {
        status: parsed.length > 0 ? "complete" : "pending",
        turns: parsed,
        content: fullContent || null,
        error: null,
      };
    },
    enabled: !!meetingId,
  });

  return {
    transcript: data,
    status: data?.status ?? "pending",
    error: data?.error ?? null,
    isLoading,
    queryError: error,
  };
}
