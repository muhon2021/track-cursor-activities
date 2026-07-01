/**
 * Project Detail Hooks - Members, Milestones, Comments, Risks
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { ProjectMember, ProjectMilestone, ProjectComment, ProjectRisk } from "../types";

// ======================== Members ========================

export function useProjectMembers(projectId: string) {
  return useQuery({
    queryKey: ["project-members", projectId],
    queryFn: async (): Promise<ProjectMember[]> => {
      const { data, error } = await supabase
        .from("project_members")
        .select("*")
        .eq("project_id", projectId)
        .order("joined_at");
      if (error) throw error;
      return (data || []) as unknown as ProjectMember[];
    },
    enabled: !!projectId,
  });
}

export function useAddProjectMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, userId, role }: { projectId: string; userId: string; role?: string }) => {
      const { error } = await supabase.from("project_members").insert({
        project_id: projectId,
        user_id: userId,
        role: role || "member",
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["project-members", vars.projectId] });
      toast.success("Member added");
    },
    onError: (error: Error) => toast.error("Failed to add member", { description: error.message }),
  });
}

// ======================== Milestones ========================

export function useProjectMilestones(projectId: string) {
  return useQuery({
    queryKey: ["project-milestones", projectId],
    queryFn: async (): Promise<ProjectMilestone[]> => {
      const { data, error } = await supabase
        .from("project_milestones")
        .select("*")
        .eq("project_id", projectId)
        .order("sort_order");
      if (error) throw error;
      return (data || []) as ProjectMilestone[];
    },
    enabled: !!projectId,
  });
}

export function useAddMilestone() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ projectId, title, description, due_date }: {
      projectId: string; title: string; description?: string; due_date?: string;
    }) => {
      const { error } = await supabase.from("project_milestones").insert({
        project_id: projectId,
        title,
        description: description || null,
        due_date: due_date || null,
        created_by: user?.id || null,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["project-milestones", vars.projectId] });
      toast.success("Milestone added");
    },
    onError: (error: Error) => toast.error("Failed to add milestone", { description: error.message }),
  });
}

export function useUpdateMilestone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projectId, data }: {
      id: string; projectId: string; data: Partial<{ title: string; status: string; completed_at: string | null }>;
    }) => {
      const { error } = await supabase.from("project_milestones").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["project-milestones", vars.projectId] });
    },
    onError: (error: Error) => toast.error("Failed to update milestone", { description: error.message }),
  });
}

// ======================== Comments ========================

export function useProjectComments(projectId: string) {
  return useQuery({
    queryKey: ["project-comments", projectId],
    queryFn: async (): Promise<ProjectComment[]> => {
      const { data, error } = await supabase
        .from("project_comments")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as ProjectComment[];
    },
    enabled: !!projectId,
  });
}

export function useAddProjectComment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ projectId, content }: { projectId: string; content: string }) => {
      const { error } = await supabase.from("project_comments").insert({
        project_id: projectId,
        user_id: user?.id!,
        content,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["project-comments", vars.projectId] });
      toast.success("Comment added");
    },
    onError: (error: Error) => toast.error("Failed to add comment", { description: error.message }),
  });
}

// ======================== Risks ========================

export function useProjectRisks(projectId: string) {
  return useQuery({
    queryKey: ["project-risks", projectId],
    queryFn: async (): Promise<ProjectRisk[]> => {
      const { data, error } = await supabase
        .from("project_risks")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as ProjectRisk[];
    },
    enabled: !!projectId,
  });
}

export function useAddProjectRisk() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ projectId, title, description, severity }: {
      projectId: string; title: string; description?: string; severity?: string;
    }) => {
      const { error } = await supabase.from("project_risks").insert({
        project_id: projectId,
        title,
        description: description || null,
        severity: severity || "medium",
        reported_by: user?.id || null,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["project-risks", vars.projectId] });
      toast.success("Risk added");
    },
    onError: (error: Error) => toast.error("Failed to add risk", { description: error.message }),
  });
}
