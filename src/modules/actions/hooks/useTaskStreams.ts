/**
 * Task Stream Hooks
 *
 * CRUD for task streams and stream membership.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { TaskStream } from "../types/tasks";

const STREAMS_KEY = "actions-streams";

/**
 * Fetch all task streams with task and member counts.
 */
export function useTaskStreams() {
  return useQuery({
    queryKey: [STREAMS_KEY],
    queryFn: async (): Promise<TaskStream[]> => {
      const { data, error } = await supabase
        .from("task_categories")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (error) throw error;

      // Fetch task counts per stream
      const streamIds = (data || []).map((s) => s.id);
      if (streamIds.length === 0) return [];

      const { data: taskCounts } = await supabase
        .from("tasks")
        .select("category_id")
        .in("category_id", streamIds)
        .is("parent_id", null);

      const taskCountMap: Record<string, number> = {};

      (taskCounts || []).forEach((t) => {
        if (t.category_id) taskCountMap[t.category_id] = (taskCountMap[t.category_id] || 0) + 1;
      });

      return (data || []).map((s) => ({
        ...s,
        description: s.description ?? null,
        is_archived: !(s.is_active ?? true),
        created_by: null,
        updated_at: s.created_at,
        task_count: taskCountMap[s.id] || 0,
        member_count: 0,
      }));
    },
  });
}

/**
 * Fetch a single stream by ID.
 */
export function useTaskStream(id: string | undefined) {
  return useQuery({
    queryKey: [STREAMS_KEY, id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("task_categories")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return {
        ...data,
        description: data.description ?? null,
        is_archived: !(data.is_active ?? true),
        created_by: null,
        updated_at: data.created_at,
      } as TaskStream;
    },
    enabled: !!id,
  });
}

/**
 * Fetch a single stream by slug (for URL /tasks/stream/:slug).
 * If slug looks like a UUID, fetches by id instead.
 */
export function useTaskStreamBySlug(slugOrId: string | undefined) {
  const isUuid = slugOrId?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  return useQuery({
    queryKey: [STREAMS_KEY, "slug", slugOrId],
    queryFn: async () => {
      if (!slugOrId) return null;
      const { data, error } = await supabase
        .from("task_categories")
        .select("*")
        .eq(isUuid ? "id" : "slug", slugOrId)
        .single();
      if (error) throw error;
      return {
        ...data,
        description: data.description ?? null,
        is_archived: !(data.is_active ?? true),
        created_by: null,
        updated_at: data.created_at,
      } as TaskStream;
    },
    enabled: !!slugOrId,
  });
}

/**
 * Create a new stream.
 */
export function useCreateStream() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; description?: string; color?: string }) => {
      const slug = data.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      const { data: stream, error } = await supabase
        .from("task_categories")
        .insert({
          name: data.name,
          slug,
          description: data.description || null,
          color: data.color || "#6366f1",
          icon: "layers",
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      return stream;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [STREAMS_KEY] });
      toast.success("Stream created");
    },
    onError: (error: Error) => {
      toast.error("Failed to create stream", { description: error.message });
    },
  });
}

/**
 * Update a stream.
 */
export function useUpdateStream() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Pick<TaskStream, "name" | "description" | "color" | "is_archived">> }) => {
      const { error } = await supabase
        .from("task_categories")
        .update({
          ...data,
          ...(data.is_archived !== undefined ? { is_active: !data.is_archived } : {}),
          ...(data.name
            ? {
                slug: data.name
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/^-|-$/g, ""),
              }
            : {}),
        } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [STREAMS_KEY] });
      toast.success("Stream updated");
    },
    onError: (error: Error) => {
      toast.error("Failed to update stream", { description: error.message });
    },
  });
}

/**
 * Delete (archive) a stream.
 */
export function useArchiveStream() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("task_categories")
        .update({ is_active: false } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [STREAMS_KEY] });
      toast.success("Stream archived");
    },
    onError: (error: Error) => {
      toast.error("Failed to archive stream", { description: error.message });
    },
  });
}
