/**
 * EOS Issues Hooks
 *
 * CRUD operations and filtered queries for EOS issues.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { EOSIssue, EOSIssueFormData, IssueFilters, IssueStats } from "../types";

const ISSUES_KEY = "eos-issues";

/**
 * Fetch issues with filters.
 */
export function useEOSIssues(filters?: IssueFilters) {
  const { user } = useAuth();

  return useQuery({
    queryKey: [ISSUES_KEY, filters],
    queryFn: async (): Promise<EOSIssue[]> => {
      let query = supabase
        .from("eos_issues")
        .select("*")
        .order("created_at", { ascending: false });

      if (filters?.status && filters.status !== "all") {
        query = query.eq("status", filters.status);
      }
      if (filters?.priority && filters.priority !== "all") {
        query = query.eq("priority", filters.priority);
      }
      if (filters?.category && filters.category !== "all") {
        query = query.eq("category", filters.category);
      }
      if (filters?.pod_id) {
        query = query.eq("pod_id", filters.pod_id);
      }
      if (filters?.assigned_to) {
        query = query.eq("assigned_to", filters.assigned_to);
      }
      if (filters?.search) {
        query = query.ilike("title", `%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as EOSIssue[];
    },
    enabled: !!user,
  });
}

/**
 * Fetch a single issue by ID.
 */
export function useEOSIssue(id: string | undefined) {
  return useQuery({
    queryKey: [ISSUES_KEY, "detail", id],
    queryFn: async (): Promise<EOSIssue | null> => {
      if (!id) return null;

      const { data, error } = await supabase
        .from("eos_issues")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as unknown as EOSIssue;
    },
    enabled: !!id,
  });
}

/**
 * Issue statistics.
 */
export function useIssueStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: [ISSUES_KEY, "stats"],
    queryFn: async (): Promise<IssueStats> => {
      const { data, error } = await supabase
        .from("eos_issues")
        .select("status, priority");

      if (error) throw error;
      const issues = data || [];

      return {
        total: issues.length,
        open: issues.filter((i) => i.status === "open").length,
        in_progress: issues.filter((i) => i.status === "in_progress").length,
        solved: issues.filter((i) => i.status === "solved").length,
        archived: issues.filter((i) => i.status === "archived").length,
        critical: issues.filter((i) => i.priority === "critical").length,
      };
    },
    enabled: !!user,
  });
}

/**
 * Create a new issue.
 */
export function useCreateIssue() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: EOSIssueFormData) => {
      const { data: issue, error } = await supabase
        .from("eos_issues")
        .insert({
          title: data.title,
          description: data.description || null,
          status: data.status || "open",
          priority: data.priority || "medium",
          category: data.category || "process",
          pod_id: data.pod_id || null,
          assigned_to: data.assigned_to || null,
          is_anonymous: data.is_anonymous || false,
          source: data.source || "manual",
          reported_by: data.is_anonymous ? null : user!.id,
        })
        .select()
        .single();

      if (error) throw error;
      return issue;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ISSUES_KEY] });
      toast.success("Issue created");
    },
    onError: (error: Error) => {
      toast.error("Failed to create issue", { description: error.message });
    },
  });
}

/**
 * Update an existing issue.
 */
export function useUpdateIssue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<EOSIssueFormData> & { solved_at?: string | null; archived_at?: string | null } }) => {
      const updateData: Record<string, unknown> = { ...data, updated_at: new Date().toISOString() };

      // Auto-set timestamps
      if (data.status === "solved" && !data.solved_at) {
        updateData.solved_at = new Date().toISOString();
      }
      if (data.status === "archived" && !data.archived_at) {
        updateData.archived_at = new Date().toISOString();
      }

      const { data: issue, error } = await supabase
        .from("eos_issues")
        .update(updateData as any)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return issue;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ISSUES_KEY] });
      toast.success("Issue updated");
    },
    onError: (error: Error) => {
      toast.error("Failed to update issue", { description: error.message });
    },
  });
}

/**
 * Delete an issue.
 */
export function useDeleteIssue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("eos_issues").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ISSUES_KEY] });
      toast.success("Issue deleted");
    },
    onError: (error: Error) => {
      toast.error("Failed to delete issue", { description: error.message });
    },
  });
}
