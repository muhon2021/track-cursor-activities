/**
 * Projects Hook - CRUD operations for projects
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Project, ProjectFormData, ProjectFilters, ProjectStatus } from "../types";

const PROJECTS_KEY = "projects";
const STATUSES_KEY = "project-statuses";

const DEFAULT_SORT = "updated_at";
const DEFAULT_ASC = false;

export function useProjects(filters?: ProjectFilters) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [PROJECTS_KEY, filters],
    queryFn: async (): Promise<Project[]> => {
      let query = supabase
        .from("projects")
        .select("*")
        .eq("is_archived", filters?.is_archived ?? false);

      if (filters?.status_id) query = query.eq("status_id", filters.status_id);
      if (filters?.owner_id) query = query.eq("owner_id", filters.owner_id);
      if (filters?.client_id) query = query.eq("client_id", filters.client_id);
      if (filters?.search) query = query.ilike("name", `%${filters.search}%`);
      if (filters?.external_provider === "internal") {
        query = query.is("external_provider", null);
      } else if (filters?.external_provider) {
        query = query.eq("external_provider", filters.external_provider);
      }
      if (filters?.date_from) query = query.gte("start_date", filters.date_from);
      if (filters?.date_to) query = query.lte("end_date", filters.date_to);

      const sortBy = filters?.sort_by ?? DEFAULT_SORT;
      const asc = filters?.sort_asc ?? DEFAULT_ASC;
      const needBilling = filters?.show_over_budget_only || sortBy === "over_budget_gap";
      const orderBy = sortBy === "over_budget_gap" ? DEFAULT_SORT : sortBy;
      query = query.order(orderBy, { ascending: asc });

      const { data: rawData, error } = await query;
      if (error) throw error;
      let list = (rawData || []) as unknown as Project[];

      if (list.length > 0 && needBilling) {
        const { data: billingRows } = await supabase
          .from("project_billing")
          .select("project_id, invoiced_amount")
          .in("project_id", list.map((p) => p.id));
        const invoicedByProject = new Map(
          (billingRows || []).map((r: { project_id: string; invoiced_amount: number | null }) => [
            r.project_id,
            r.invoiced_amount ?? 0,
          ])
        );
        if (filters?.show_over_budget_only) {
          list = list.filter((p) => {
            if (p.budget == null || p.budget <= 0) return false;
            return (invoicedByProject.get(p.id) ?? 0) > p.budget;
          });
        }
        if (sortBy === "over_budget_gap") {
          list = [...list].sort((a, b) => {
            const budgetA = a.budget ?? 0;
            const budgetB = b.budget ?? 0;
            const invA = invoicedByProject.get(a.id) ?? 0;
            const invB = invoicedByProject.get(b.id) ?? 0;
            const gapA = budgetA > 0 ? invA - budgetA : 0;
            const gapB = budgetB > 0 ? invB - budgetB : 0;
            return gapB - gapA;
          });
        }
      }

      return list;
    },
    enabled: !!user,
  });
}

export function useProject(slug: string | undefined) {
  return useQuery({
    queryKey: [PROJECTS_KEY, slug],
    queryFn: async (): Promise<Project> => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, project_statuses(*)")
        .eq("slug", slug)
        .single();
      if (error) throw error;
      const row = data as Record<string, unknown>;
      const projectStatuses = row.project_statuses as { name: string; color: string } | null;
      return {
        ...row,
        status: projectStatuses ?? null,
        owner: null, // Resolved separately via profiles in UI when owner_id is set
        project_statuses: undefined,
      } as unknown as Project;
    },
    enabled: !!slug,
  });
}

/** Alias for useProject for replication guide compatibility */
export const useProjectBySlug = useProject;

export function useManagers() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["profiles", "managers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name");
      if (error) throw error;
      return (data || []) as { id: string; full_name: string | null; email: string | null }[];
    },
    enabled: !!user,
  });
}

/** Placeholder for future project teams - returns empty until backend supports */
export function useTeams() {
  return useQuery({
    queryKey: ["project-teams"],
    queryFn: async (): Promise<{ id: string; name: string }[]> => [],
    enabled: false,
  });
}

/** Placeholder for future project categories - returns empty until backend supports */
export function useProjectCategories() {
  return useQuery({
    queryKey: ["project-categories"],
    queryFn: async (): Promise<{ id: string; name: string }[]> => [],
    enabled: false,
  });
}

export function useProjectStatuses() {
  return useQuery({
    queryKey: [STATUSES_KEY],
    queryFn: async (): Promise<ProjectStatus[]> => {
      const { data, error } = await supabase
        .from("project_statuses")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return (data || []) as ProjectStatus[];
    },
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (data: ProjectFormData) => {
      const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const { data: project, error } = await supabase
        .from("projects")
        .insert({
          name: data.name,
          slug: `${slug}-${Date.now().toString(36)}`,
          description: data.description || null,
          status_id: data.status_id || null,
          client_id: data.client_id || null,
          owner_id: data.owner_id || user?.id || null,
          start_date: data.start_date || null,
          end_date: data.end_date || null,
          budget: data.budget || null,
          created_by: user?.id || null,
        })
        .select()
        .single();
      if (error) throw error;
      return project;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROJECTS_KEY] });
      toast.success("Project created");
    },
    onError: (error: Error) => toast.error("Failed to create project", { description: error.message }),
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ProjectFormData> }) => {
      const { data: project, error } = await supabase
        .from("projects")
        .update({
          ...(data.name !== undefined && { name: data.name }),
          ...(data.description !== undefined && { description: data.description || null }),
          ...(data.status_id !== undefined && { status_id: data.status_id || null }),
          ...(data.client_id !== undefined && { client_id: data.client_id || null }),
          ...(data.owner_id !== undefined && { owner_id: data.owner_id || null }),
          ...(data.start_date !== undefined && { start_date: data.start_date || null }),
          ...(data.end_date !== undefined && { end_date: data.end_date || null }),
          ...(data.budget !== undefined && { budget: data.budget || null }),
        })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return project;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROJECTS_KEY] });
      toast.success("Project updated");
    },
    onError: (error: Error) => toast.error("Failed to update project", { description: error.message }),
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROJECTS_KEY] });
      toast.success("Project deleted");
    },
    onError: (error: Error) => toast.error("Failed to delete project", { description: error.message }),
  });
}
