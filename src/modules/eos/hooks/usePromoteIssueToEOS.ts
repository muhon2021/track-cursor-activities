/**
 * Promote Issue to EOS Hook
 *
 * Converts a project or meeting-sourced issue into an EOS issue.
 * Sets the appropriate source and links back to the originating meeting
 * when applicable.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface PromoteIssueParams {
  title: string;
  description?: string;
  source: "meeting" | "project";
  source_meeting_id?: string;
  pod_id?: string;
  priority?: "low" | "medium" | "high" | "critical";
  category?: "people" | "process" | "system" | "external";
}

/**
 * Promote an issue from a meeting or project context into an EOS issue.
 */
export function usePromoteIssueToEOS() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: PromoteIssueParams) => {
      const { data: issue, error } = await supabase
        .from("eos_issues")
        .insert({
          title: params.title,
          description: params.description || null,
          status: "open",
          priority: params.priority || "medium",
          category: params.category || "process",
          pod_id: params.pod_id || null,
          source: params.source,
          meeting_id:
            params.source === "meeting" && params.source_meeting_id
              ? params.source_meeting_id
              : null,
          reported_by: user?.id || null,
          is_anonymous: false,
        })
        .select()
        .single();

      if (error) throw error;
      return issue;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eos-issues"] });
      toast.success("Issue promoted to EOS");
    },
    onError: (error: Error) => {
      toast.error("Failed to promote issue", {
        description: error.message,
      });
    },
  });
}
