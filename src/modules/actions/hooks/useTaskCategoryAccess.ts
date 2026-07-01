import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { TaskCategoryAccessRule } from "../types/tasks";

const ACCESS_KEY = "task-category-access";

interface RoleRow {
  id: string;
  name: string;
}

interface AccessRuleWithRoleName extends TaskCategoryAccessRule {
  role_name?: string | null;
}

export function useTaskCategoryAccess() {
  return useQuery({
    queryKey: [ACCESS_KEY],
    queryFn: async (): Promise<AccessRuleWithRoleName[]> => {
      const { data, error } = await supabase
        .from("task_category_roles")
        .select("id, category_id, role, role_id, access_level, created_at");

      if (error) throw error;

      const rules = (data || []) as AccessRuleWithRoleName[];
      const roleIds = [...new Set(rules.map((rule) => rule.role_id).filter(Boolean))] as string[];
      if (roleIds.length === 0) return rules;

      const { data: rolesData, error: rolesError } = await supabase
        .from("roles")
        .select("id, name")
        .in("id", roleIds);
      if (rolesError) throw rolesError;

      const roleMap = new Map<string, string>();
      (rolesData as RoleRow[]).forEach((role) => roleMap.set(role.id, role.name));

      return rules.map((rule) => ({
        ...rule,
        role_name: rule.role_id ? roleMap.get(rule.role_id) || rule.role : rule.role,
      }));
    },
  });
}

export function useAddTaskCategoryAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      category_id: string;
      role_id: string;
      role: string;
      access_level: "full" | "read_only";
    }) => {
      const { error } = await supabase.from("task_category_roles").insert(input);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ACCESS_KEY] });
      toast.success("Access rule added");
    },
    onError: (error: Error) => toast.error("Failed to add access rule", { description: error.message }),
  });
}

export function useRemoveTaskCategoryAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("task_category_roles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ACCESS_KEY] });
      toast.success("Access rule removed");
    },
    onError: (error: Error) => toast.error("Failed to remove access rule", { description: error.message }),
  });
}
