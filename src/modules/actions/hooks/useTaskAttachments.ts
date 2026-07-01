/**
 * Task Attachments Hook
 *
 * Fetches file attachments for a task from task_attachments.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TaskAttachment } from "../types/tasks";
import { queryKeys } from "@/lib/cache";

export function useTaskAttachments(taskId: string | undefined) {
  return useQuery({
    queryKey: [...queryKeys.tasks.detail(taskId ?? ""), "attachments"],
    queryFn: async (): Promise<TaskAttachment[]> => {
      if (!taskId) return [];

      const { data, error } = await supabase
        .from("task_attachments")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []) as TaskAttachment[];
    },
    enabled: !!taskId,
  });
}
