/**
 * Extract Meeting Issues Hook
 *
 * Uses AI to identify potential EOS issues from meeting transcripts.
 * Provides two mutations: one for AI extraction via edge function,
 * and one for batch-inserting confirmed issues with suggestion records.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface ExtractedIssue {
  title: string;
  description: string;
  category: "people" | "process" | "system" | "external";
  priority: "low" | "medium" | "high" | "critical";
  confidence: number;
}

/**
 * Extract potential EOS issues from a meeting transcript via AI edge function.
 */
export function useExtractMeetingIssues() {
  return useMutation({
    mutationFn: async ({
      meetingId,
      transcriptContent,
    }: {
      meetingId: string;
      transcriptContent: string;
    }): Promise<ExtractedIssue[]> => {
      const { data, error } = await supabase.functions.invoke(
        "extract-meeting-issues",
        {
          body: {
            meeting_id: meetingId,
            transcript: transcriptContent,
          },
        }
      );

      if (error) throw error;

      return (data?.issues || data || []) as ExtractedIssue[];
    },
    onSuccess: () => {
      toast.success("Issues extracted from transcript");
    },
    onError: (error: Error) => {
      toast.error("Failed to extract issues", {
        description: error.message,
      });
    },
  });
}

/**
 * Batch-insert confirmed extracted issues into EOS issues
 * and create corresponding suggestion records with confidence scores.
 */
export function useCreateIssuesFromExtraction() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      meetingId,
      issues,
      podId,
    }: {
      meetingId: string;
      issues: ExtractedIssue[];
      podId?: string;
    }) => {
      // Batch insert EOS issues
      const issueRows = issues.map((issue) => ({
        title: issue.title,
        description: issue.description || null,
        status: "open",
        priority: issue.priority || "medium",
        category: issue.category || "process",
        pod_id: podId || null,
        source: "meeting",
        meeting_id: meetingId,
        reported_by: user?.id || null,
        is_anonymous: false,
      }));

      const { data: createdIssues, error: issuesError } = await (
        supabase as any
      )
        .from("eos_issues")
        .insert(issueRows)
        .select();

      if (issuesError) throw issuesError;

      // Create suggestion entries for each issue with confidence scores
      const suggestionRows = (createdIssues || []).map(
        (created: any, index: number) => ({
          issue_id: created.id,
          suggestion_type: "root_cause",
          content: issues[index].description,
          confidence: issues[index].confidence,
          status: "pending",
        })
      );

      if (suggestionRows.length > 0) {
        const { error: suggestionsError } = await supabase
          .from("eos_issue_suggestions")
          .insert(suggestionRows);

        if (suggestionsError) throw suggestionsError;
      }

      return createdIssues;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["eos-issues"] });
      toast.success(
        `${(data || []).length} issue(s) created from meeting extraction`
      );
    },
    onError: (error: Error) => {
      toast.error("Failed to create issues", {
        description: error.message,
      });
    },
  });
}
