import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/cache";

export interface Permission {
  id: string;
  key: string;
  name: string;
  category: string;
  resource: string;
  action: string;
  description: string | null;
}

export function usePermissions() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: queryKeys.admin.permissions,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_user_permissions", {
        _user_id: user!.id,
      });
      if (error) throw error;
      return (data ?? []) as string[];
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
    placeholderData: keepPreviousData,
  });

  const hasPermission = (key: string) => {
    return (query.data ?? []).includes(key);
  };

  const hasAnyPermission = (keys: string[]) => {
    const perms = query.data ?? [];
    return keys.some((k) => perms.includes(k));
  };

  return {
    permissions: query.data ?? [],
    hasPermission,
    hasAnyPermission,
    isLoading: query.isLoading,
    isSuccess: query.isSuccess,
    refetch: query.refetch,
  };
}

export function usePermissionCatalog() {
  return useQuery({
    queryKey: ["permissions", "catalog"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("permissions")
        .select("id, key, name, category, resource, action, description")
        .order("category")
        .order("key");

      if (error) throw error;
      return (data ?? []) as Permission[];
    },
    staleTime: 1000 * 60 * 30,
  });
}

export function useRolePermissions(roleId?: string) {
  return useQuery({
    queryKey: ["role_permissions", roleId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("role_permissions")
        .select("permission_id, permissions(key)")
        .eq("role_id", roleId);

      if (error) throw error;
      return (data ?? []).map(
        (row: { permissions: { key: string } }) => row.permissions.key
      ) as string[];
    },
    enabled: !!roleId,
  });
}
