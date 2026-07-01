/**
 * EOS issue comments hook.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys, cacheConfig, invalidateKeys } from "@/lib/cache";
import { toast } from "sonner";
import type { EOSIssueComment } from "../types";

export function useIssueComments(issueId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.eos.issueComments(issueId || ""),
    queryFn: async (): Promise<EOSIssueComment[]> => {
      const { data, error } = await supabase
        .from("eos_issue_comments")
        .select("*")
        .eq("issue_id", issueId!)
        .order("created_at");

      if (error) throw error;

      const comments = data || [];
      const userIds = [...new Set(comments.map((c) => c.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));

      return comments.map((c) => ({
        ...c,
        user: profileMap[c.user_id] || null,
      })) as EOSIssueComment[];
    },
    enabled: !!user && !!issueId,
    staleTime: cacheConfig.staleTime.short,
  });
}

export function useAddIssueComment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ issueId, content }: { issueId: string; content: string }) => {
      const { data, error } = await supabase
        .from("eos_issue_comments")
        .insert({ issue_id: issueId, user_id: user!.id, content })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.eos.issueComments(vars.issueId) });
      toast.success("Comment added");
    },
    onError: (e: Error) => toast.error("Failed to add comment", { description: e.message }),
  });
}

export function useUpdateIssueRootCause() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      issueId,
      root_cause,
      resolution_entry,
    }: {
      issueId: string;
      root_cause?: Record<string, unknown>;
      resolution_entry?: Record<string, unknown>;
    }) => {
      const updates: Record<string, unknown> = {};
      if (root_cause) updates.root_cause = root_cause;

      if (resolution_entry) {
        const { data: existing } = await supabase
          .from("eos_issues")
          .select("resolution_history")
          .eq("id", issueId)
          .single();
        const history = Array.isArray(existing?.resolution_history)
          ? existing.resolution_history
          : [];
        updates.resolution_history = [...history, { ...resolution_entry, at: new Date().toISOString() }];
      }

      const { error } = await supabase.from("eos_issues").update(updates).eq("id", issueId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      invalidateKeys.eos(queryClient);
    },
  });
}
