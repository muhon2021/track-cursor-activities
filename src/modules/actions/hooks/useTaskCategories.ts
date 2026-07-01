/**
 * Task Categories Hooks
 *
 * CRUD operations for the task_categories table.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { TaskCategory } from "../types/tasks";

const CATEGORIES_KEY = "task-categories";

interface UseTaskCategoriesOptions {
  includeInactive?: boolean;
}

interface UpsertTaskCategoryInput {
  name: string;
  color: string;
  description?: string;
  icon?: string;
  parent_id?: string;
}

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function useTaskCategories(options?: UseTaskCategoriesOptions) {
  return useQuery({
    queryKey: [CATEGORIES_KEY, options?.includeInactive ? "all" : "active"],
    queryFn: async (): Promise<TaskCategory[]> => {
      let query = supabase
        .from("task_categories")
        .select("*")
        .order("sort_order", { ascending: true });

      if (!options?.includeInactive) {
        query = query.eq("is_active", true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });
}

export function useCreateTaskCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: UpsertTaskCategoryInput) => {
      const slug = slugify(data.name);

      // Get next sort_order
      const { data: existing } = await supabase
        .from("task_categories")
        .select("sort_order")
        .order("sort_order", { ascending: false })
        .limit(1);

      const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

      const { data: category, error } = await supabase
        .from("task_categories")
        .insert({
          name: data.name,
          color: data.color,
          slug,
          sort_order: nextOrder,
          description: data.description ?? null,
          icon: data.icon ?? "layers",
          parent_id: data.parent_id ?? null,
          is_active: true,
        } as never)
        .select()
        .single();

      if (error) throw error;
      return category;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CATEGORIES_KEY] });
      toast.success("Category created");
    },
    onError: (error: Error) => toast.error("Failed to create category", { description: error.message }),
  });
}

export function useUpdateTaskCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: {
        name?: string;
        color?: string;
        sort_order?: number;
        description?: string;
        icon?: string;
        parent_id?: string | null;
      };
    }) => {
      const payload = {
        ...data,
        ...(data.name ? { slug: slugify(data.name) } : {}),
      };

      const { error } = await supabase
        .from("task_categories")
        .update(payload as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CATEGORIES_KEY] });
      toast.success("Category updated");
    },
    onError: (error: Error) => toast.error("Failed to update category", { description: error.message }),
  });
}

export function useToggleTaskCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("task_categories")
        .update({ is_active } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CATEGORIES_KEY] });
      toast.success("Stream status updated");
    },
    onError: (error: Error) =>
      toast.error("Failed to update stream status", { description: error.message }),
  });
}

export function useDeleteTaskCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Unlink tasks first
      await supabase.from("tasks").update({ category_id: null }).eq("category_id", id);
      const { error } = await supabase.from("task_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CATEGORIES_KEY] });
      queryClient.invalidateQueries({ queryKey: ["actions-tasks"] });
      toast.success("Category deleted");
    },
    onError: (error: Error) => toast.error("Failed to delete category", { description: error.message }),
  });
}
