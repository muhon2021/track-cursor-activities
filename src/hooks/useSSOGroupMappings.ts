import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SSOGroupMapping {
  id: string;
  sso_config_id: string;
  external_group_id: string;
  external_group_name: string;
  role_id: string;
  department_id: string | null;
  is_active: boolean;
  roles?: { name: string } | null;
  departments?: { name: string } | null;
}

export interface SSOGroupMappingForm {
  sso_config_id: string;
  external_group_id: string;
  external_group_name: string;
  role_id: string;
  department_id?: string;
}

export function useSSOGroupMappings(ssoConfigId?: string) {
  return useQuery({
    queryKey: ["sso_group_mappings", ssoConfigId],
    queryFn: async () => {
      let query = (supabase as any)
        .from("sso_group_mappings")
        .select("*, roles(name), departments(name)")
        .order("created_at", { ascending: false });

      if (ssoConfigId) {
        query = query.eq("sso_config_id", ssoConfigId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as SSOGroupMapping[];
    },
  });
}

export function useCreateSSOGroupMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (form: SSOGroupMappingForm) => {
      const { data, error } = await (supabase as any)
        .from("sso_group_mappings")
        .insert({
          ...form,
          tenant_id: "00000000-0000-0000-0000-000000000001",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sso_group_mappings"] });
      toast.success("Group mapping created");
    },
    onError: () => toast.error("Failed to create group mapping"),
  });
}

export function useDeleteSSOGroupMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("sso_group_mappings")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sso_group_mappings"] });
      toast.success("Group mapping removed");
    },
    onError: () => toast.error("Failed to delete group mapping"),
  });
}
