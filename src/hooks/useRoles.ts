import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys, invalidateKeys } from "@/lib/cache";
import { toast } from "sonner";
import { invokeEdgeFunction } from "@/lib/edge-functions";

const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001";

export interface Role {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  tenant_id: string | null;
  is_system: boolean;
  cloned_from_id: string | null;
  created_at: string;
  permission_count?: number;
  assigned_user_count?: number;
}

export interface RoleFormData {
  name: string;
  description?: string;
  permissionKeys?: string[];
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function useRoles() {
  return useQuery({
    queryKey: queryKeys.admin.roles,
    queryFn: async () => {
      const [{ data: roles, error: rolesError }, { data: stats, error: statsError }] =
        await Promise.all([
          supabase.from("roles").select("*").order("created_at", { ascending: false }),
          supabase.rpc("get_role_stats"),
        ]);

      if (rolesError) throw rolesError;
      if (statsError) console.warn("Role stats unavailable:", statsError.message);

      const statsMap = new Map(
        ((stats ?? []) as Array<{
          role_id: string;
          permission_count: number;
          assigned_user_count: number;
        }>).map((s) => [s.role_id, s])
      );

      return ((roles ?? []) as unknown as Role[]).map((role) => ({
        ...role,
        permission_count: statsMap.get(role.id)?.permission_count ?? 0,
        assigned_user_count: statsMap.get(role.id)?.assigned_user_count ?? 0,
      }));
    },
  });
}

export function useRole(id: string) {
  return useQuery({
    queryKey: ["roles", "detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roles")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as unknown as Role;
    },
    enabled: !!id,
  });
}

export function useRoleUsers(roleId?: string) {
  return useQuery({
    queryKey: ["roles", "users", roleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, profiles(id, email, full_name)")
        .eq("role_id", roleId!);

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!roleId,
  });
}

export function useCreateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: RoleFormData) => {
      const slug = slugify(data.name);
      const { data: role, error } = await supabase
        .from("roles")
        .insert({
          name: data.name,
          slug,
          description: data.description || null,
          tenant_id: DEFAULT_TENANT_ID,
          is_system: false,
        })
        .select()
        .single();

      if (error) throw error;

      if (data.permissionKeys?.length) {
        await invokeEdgeFunction("rbac-manage", {
          action: "set_role_permissions",
          role_id: role.id,
          permission_keys: data.permissionKeys,
        });
      }

      return role as Role;
    },
    onSuccess: () => {
      invalidateKeys.roles(queryClient);
      toast.success("Role created successfully");
    },
    onError: (error: Error) => {
      console.error("Error creating role:", error);
      toast.error("Failed to create role");
    },
  });
}

export function useUpdateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: RoleFormData }) => {
      const { data: role, error } = await supabase
        .from("roles")
        .update({
          name: data.name,
          description: data.description || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      if (data.permissionKeys) {
        await invokeEdgeFunction("rbac-manage", {
          action: "set_role_permissions",
          role_id: id,
          permission_keys: data.permissionKeys,
        });
      }

      return role as Role;
    },
    onSuccess: () => {
      invalidateKeys.roles(queryClient);
      toast.success("Role updated successfully");
    },
    onError: (error: Error) => {
      console.error("Error updating role:", error);
      toast.error("Failed to update role");
    },
  });
}

export function useCloneRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sourceRoleId: string) => {
      const result = await invokeEdgeFunction<{ role: Role }>("rbac-manage", {
        action: "clone_role",
        role_id: sourceRoleId,
      });
      return result.role;
    },
    onSuccess: () => {
      invalidateKeys.roles(queryClient);
      toast.success("Role cloned successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to clone role");
    },
  });
}

export function useDeleteRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      reassignToRoleId,
    }: {
      id: string;
      reassignToRoleId?: string;
    }) => {
      await invokeEdgeFunction("rbac-manage", {
        action: "delete_role",
        role_id: id,
        reassign_to_role_id: reassignToRoleId,
      });
    },
    onSuccess: () => {
      invalidateKeys.roles(queryClient);
      toast.success("Role deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete role");
    },
  });
}

export function useUpdateRolePermissions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      roleId,
      permissionKeys,
    }: {
      roleId: string;
      permissionKeys: string[];
    }) => {
      await invokeEdgeFunction("rbac-manage", {
        action: "set_role_permissions",
        role_id: roleId,
        permission_keys: permissionKeys,
      });
    },
    onSuccess: () => {
      invalidateKeys.roles(queryClient);
      queryClient.invalidateQueries({ queryKey: ["role_permissions"] });
      toast.success("Permissions updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update permissions");
    },
  });
}
