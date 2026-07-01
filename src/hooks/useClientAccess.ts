/**
 * Client Access Hooks - Project client portal (token + password)
 * Create, list, revoke, restore client access; reset password.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ProjectClientAccessRow {
  id: string;
  project_id: string;
  client_email: string;
  client_name: string | null;
  access_token: string;
  is_active: boolean;
  project_slug: string | null;
  login_count: number;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  revoked_at: string | null;
  revoked_by: string | null;
  created_by: string | null;
}

export function useProjectClientAccess(projectId: string) {
  return useQuery({
    queryKey: ["client-access", projectId],
    queryFn: async (): Promise<ProjectClientAccessRow[]> => {
      const { data, error } = await supabase
        .from("project_client_access")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as ProjectClientAccessRow[];
    },
    enabled: !!projectId,
  });
}

export function useCreateClientAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      clientEmail,
      clientName,
      projectSlug,
    }: {
      projectId: string;
      clientEmail: string;
      clientName?: string;
      projectSlug?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("create-client-access", {
        body: {
          project_id: projectId,
          client_email: clientEmail,
          client_name: clientName,
          project_slug: projectSlug,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to create client access");
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["client-access", variables.projectId] });
      toast.success("Client access created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create client access: ${error.message}`);
    },
  });
}

export function useResetClientPassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      clientEmail,
    }: {
      accessId: string;
      projectId: string;
      clientEmail: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("create-client-access", {
        body: { project_id: projectId, client_email: clientEmail },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to reset password");
      return { newPassword: data.password };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["client-access", variables.projectId] });
      toast.success("Password reset successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to reset password: ${error.message}`);
    },
  });
}

export function useRevokeClientAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ accessId, projectId }: { accessId: string; projectId: string }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("project_client_access")
        .update({
          is_active: false,
          revoked_at: new Date().toISOString(),
          revoked_by: user?.id ?? null,
        })
        .eq("id", accessId);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["client-access", variables.projectId] });
      toast.success("Client access revoked");
    },
    onError: (error: Error) => {
      toast.error(`Failed to revoke access: ${error.message}`);
    },
  });
}

export function useRestoreClientAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ accessId, projectId }: { accessId: string; projectId: string }) => {
      const { error } = await supabase
        .from("project_client_access")
        .update({
          is_active: true,
          revoked_at: null,
          revoked_by: null,
        })
        .eq("id", accessId);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["client-access", variables.projectId] });
      toast.success("Client access restored");
    },
    onError: (error: Error) => {
      toast.error(`Failed to restore access: ${error.message}`);
    },
  });
}
