/**
 * Auto-Embed Meetings Hook
 *
 * Triggers automatic embedding of meeting content into the knowledge base.
 * Also provides a query to check a meeting's embedding status.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const AUTO_EMBED_KEY = "auto-embed-meetings";

interface AutoEmbedResult {
  meeting_id: string;
  status: string;
  embeddings_created: number;
}

/**
 * Trigger auto-embedding for a meeting by invoking the edge function.
 */
export function useAutoEmbedMeetings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ meeting_id }: { meeting_id: string }): Promise<AutoEmbedResult> => {
      const { data, error } = await supabase.functions.invoke(
        "auto-embed-meetings",
        {
          body: { meeting_id },
        }
      );

      if (error) throw error;
      return data as AutoEmbedResult;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [AUTO_EMBED_KEY] });
      toast.success(
        `Meeting embedded successfully (${data.embeddings_created} embedding${data.embeddings_created !== 1 ? "s" : ""} created)`
      );
    },
    onError: (error: Error) => {
      toast.error("Failed to embed meeting", {
        description: error.message,
      });
    },
  });
}

/**
 * Fetch the embedding status for a specific meeting.
 */
export function useEmbeddingStatus(meetingId: string) {
  return useQuery({
    queryKey: [AUTO_EMBED_KEY, meetingId],
    queryFn: async (): Promise<{ embedding_status: string | null }> => {
      const { data, error } = await supabase
        .from("meetings")
        .select("embedding_status")
        .eq("id", meetingId)
        .single();

      if (error) throw error;
      return data as unknown as { embedding_status: string | null };
    },
    enabled: !!meetingId,
  });
}
