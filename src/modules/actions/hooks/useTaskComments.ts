/**
 * Task Comment Hooks
 *
 * CRUD for threaded comments on tasks.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { TaskComment } from "../types/tasks";

const COMMENTS_KEY = "actions-task-comments";

/**
 * Fetch comments for a task, organized into threads.
 * Fetches profiles separately because task_comments.user_id references auth.users (no direct FK to profiles in schema).
 */
export function useTaskComments(taskId: string | undefined) {
  return useQuery({
    queryKey: [COMMENTS_KEY, taskId],
    queryFn: async (): Promise<TaskComment[]> => {
      if (!taskId) return [];

      const { data: rows, error } = await supabase
        .from("task_comments")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const comments = (rows || []) as (TaskComment & { profiles?: unknown })[];

      // Fetch profiles for all comment authors (user_id matches profiles.id in this app)
      const userIds = [
        ...new Set(comments.map((c) => c.user_id).filter((id): id is string => !!id)),
      ];
      const profileMap: Record<string, { full_name: string | null; email: string | null; avatar_url: string | null }> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email, avatar_url")
          .in("id", userIds);
        for (const p of profiles || []) {
          profileMap[p.id] = {
            full_name: p.full_name ?? null,
            email: p.email ?? null,
            avatar_url: p.avatar_url ?? null,
          };
        }
      }

      const withUser = comments.map((c) => ({
        ...c,
        user: profileMap[c.user_id] ?? null,
        profiles: undefined,
      })) as TaskComment[];

      // Build thread tree: top-level comments with nested replies
      const topLevel = withUser.filter((c) => !c.parent_comment_id);
      const replies = withUser.filter((c) => c.parent_comment_id);

      return topLevel.map((comment) => ({
        ...comment,
        replies: replies.filter((r) => r.parent_comment_id === comment.id),
      }));
    },
    enabled: !!taskId,
  });
}

/**
 * Add a comment to a task.
 */
export function useAddComment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      taskId,
      content,
      parentCommentId,
    }: {
      taskId: string;
      content: string;
      parentCommentId?: string;
    }) => {
      const { data, error } = await supabase
        .from("task_comments")
        .insert({
          task_id: taskId,
          user_id: user!.id,
          content,
          parent_comment_id: parentCommentId || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [COMMENTS_KEY, variables.taskId],
      });
      queryClient.refetchQueries({
        queryKey: [COMMENTS_KEY, variables.taskId],
      });
      toast.success("Comment added");
    },
    onError: (error: Error) => {
      toast.error("Failed to add comment", { description: error.message });
    },
  });
}

/**
 * Update a comment.
 */
export function useUpdateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, taskId, content }: { id: string; taskId: string; content: string }) => {
      const { error } = await supabase
        .from("task_comments")
        .update({
          content,
          is_edited: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [COMMENTS_KEY, variables.taskId],
      });
    },
    onError: (error: Error) => {
      toast.error("Failed to update comment", { description: error.message });
    },
  });
}

/**
 * Delete a comment.
 */
export function useDeleteComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, taskId }: { id: string; taskId: string }) => {
      const { error } = await supabase.from("task_comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [COMMENTS_KEY, variables.taskId],
      });
      toast.success("Comment deleted");
    },
    onError: (error: Error) => {
      toast.error("Failed to delete comment", { description: error.message });
    },
  });
}
