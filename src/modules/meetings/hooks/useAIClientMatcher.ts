/**
 * AI Client Matcher Hook
 *
 * Invokes the AI client matching edge function to suggest a client
 * match for a meeting based on its content and metadata.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const AI_CLIENT_MATCHER_KEY = "ai-client-matcher";

interface ClientMatchResult {
  meeting_id: string;
  matched_client_id: string | null;
  matched_client_name: string | null;
  confidence: number;
  reasoning: string | null;
}

/**
 * Invoke AI client matching for a meeting.
 * Returns matched client data with confidence score.
 */
export function useAIClientMatcher() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ meeting_id }: { meeting_id: string }): Promise<ClientMatchResult> => {
      const { data, error } = await supabase.functions.invoke(
        "ai-match-meeting-client",
        {
          body: { meeting_id },
        }
      );

      if (error) throw error;
      return data as ClientMatchResult;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [AI_CLIENT_MATCHER_KEY] });
      if (data.matched_client_id) {
        toast.success(
          `Matched to client: ${data.matched_client_name} (${Math.round(data.confidence * 100)}% confidence)`
        );
      } else {
        toast.info("No matching client found for this meeting");
      }
    },
    onError: (error: Error) => {
      toast.error("Failed to match meeting to client", {
        description: error.message,
      });
    },
  });
}
