/**
 * Project Statuses — CRUD hook for admin management
 *
 * Manages project_statuses table (name, color, sort_order, is_active, is_default).
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ProjectStatus {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  sort_order: number | null;
  is_active: boolean | null;
  is_default: boolean | null;
  created_at: string | null;
}

const QUERY_KEY = ["project-statuses"] as const;

export function useProjectStatuses() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<ProjectStatus[]> => {
      const { data, error } = await supabase
        .from("project_statuses")
        .select("*")
        .order("sort_order", { ascending: true, nullsFirst: false });

      if (error) throw error;
      return (data || []) as ProjectStatus[];
    },
  });
}

export function useCreateProjectStatus() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: { name: string; slug: string; color: string; sort_order: number }) => {
      const { data, error } = await supabase
        .from("project_statuses")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      toast({ title: "Status created" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create status", description: err.message, variant: "destructive" });
    },
  });
}

export function useUpdateProjectStatus() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...fields }: Partial<ProjectStatus> & { id: string }) => {
      const { data, error } = await supabase
        .from("project_statuses")
        .update(fields)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      toast({ title: "Status updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update status", description: err.message, variant: "destructive" });
    },
  });
}

export function useDeleteProjectStatus() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      // Check if any projects use this status
      const { count } = await supabase
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("status_id", id);

      if (count && count > 0) {
        throw new Error(`Cannot delete: ${count} project(s) are using this status`);
      }

      const { error } = await supabase
        .from("project_statuses")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      toast({ title: "Status deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to delete status", description: err.message, variant: "destructive" });
    },
  });
}

export function useReorderProjectStatuses() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      // Update sort_order for each status in batch
      const updates = orderedIds.map((id, index) =>
        supabase
          .from("project_statuses")
          .update({ sort_order: index })
          .eq("id", id)
      );
      const results = await Promise.all(updates);
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      toast({ title: "Order updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to reorder", description: err.message, variant: "destructive" });
    },
  });
}
