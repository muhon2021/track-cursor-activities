/**
 * useSearchTranscripts
 *
 * Searches across meeting_transcripts content and returns matching meetings.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TranscriptSearchResult {
  id: string;
  title: string;
  slug: string | null;
  scheduled_at: string | null;
  transcript_preview: string | null;
}

export function useSearchTranscripts(query: string) {
  const trimmed = query.trim();

  const { data, isLoading, error } = useQuery<TranscriptSearchResult[]>({
    queryKey: ["search-transcripts", trimmed],
    queryFn: async (): Promise<TranscriptSearchResult[]> => {
      if (!trimmed) return [];

      // Search in meeting_transcripts content
      const { data: turns, error: dbError } = await supabase
        .from("meeting_transcripts")
        .select("meeting_id, content")
        .ilike("content", `%${trimmed}%`)
        .limit(50);

      if (dbError) throw dbError;
      if (!turns || turns.length === 0) return [];

      // Get unique meeting IDs
      const meetingIds = [...new Set(turns.map((t) => t.meeting_id))];

      const { data: meetings } = await supabase
        .from("meetings")
        .select("id, title, slug, scheduled_at")
        .in("id", meetingIds)
        .limit(20);

      return (meetings ?? []).map((m) => ({
        id: m.id,
        title: m.title,
        slug: m.slug ?? null,
        scheduled_at: m.scheduled_at,
        transcript_preview: turns.find((t) => t.meeting_id === m.id)?.content?.substring(0, 200) ?? null,
      }));
    },
    enabled: trimmed.length >= 2,
    staleTime: 30_000,
  });

  return {
    results: data ?? [],
    isLoading,
    error,
  };
}
