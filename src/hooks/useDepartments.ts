/**
 * Department Management Hooks
 * CRUD and user assignment for departments
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys, invalidateKeys } from "@/lib/cache";
import { toast } from "sonner";
import { logActivity } from "@/lib/activity-logger";
import type { DepartmentFormData } from "@/lib/validation";

export interface Department {
  id: string;
  name: string;
  description: string | null;
  manager_id: string | null;
  head_user_id: string | null;
  color: string | null;
  parent_department_id: string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface DepartmentWithStats extends Department {
  user_count: number;
  pod_count: number;
  head_name: string | null;
}

export interface DepartmentUser {
  id: string;
  department_id: string;
  user_id: string;
  created_at: string;
  profile?: {
    id: string;
    email: string | null;
    full_name: string | null;
    avatar_url: string | null;
    is_active: boolean | null;
  } | null;
}

export type DepartmentSortField = "name" | "created_at";
export type DepartmentSortDir = "asc" | "desc";

export interface DepartmentListFilters {
  search?: string;
  sortField?: DepartmentSortField;
  sortDir?: DepartmentSortDir;
  activeOnly?: boolean;
}

async function fetchDepartmentStats(departmentIds: string[]) {
  const [usersRes, podsRes] = await Promise.all([
    supabase.from("department_users").select("department_id").in("department_id", departmentIds),
    supabase.from("pods").select("department_id").in("department_id", departmentIds).eq("is_active", true),
  ]);

  const userCounts = new Map<string, number>();
  (usersRes.data || []).forEach((row) => {
    userCounts.set(row.department_id, (userCounts.get(row.department_id) || 0) + 1);
  });

  const podCounts = new Map<string, number>();
  (podsRes.data || []).forEach((row) => {
    if (row.department_id) {
      podCounts.set(row.department_id, (podCounts.get(row.department_id) || 0) + 1);
    }
  });

  return { userCounts, podCounts };
}

async function fetchHeadNames(headUserIds: string[]) {
  const headMap = new Map<string, string>();
  if (headUserIds.length === 0) return headMap;

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", headUserIds);

  (data || []).forEach((p) => {
    headMap.set(p.id, p.full_name || p.email || "Unknown");
  });
  return headMap;
}

function sortDepartments(
  departments: DepartmentWithStats[],
  sortField: DepartmentSortField,
  sortDir: DepartmentSortDir
) {
  const sorted = [...departments].sort((a, b) => {
    if (sortField === "name") {
      return a.name.localeCompare(b.name);
    }
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
    return aTime - bTime;
  });
  return sortDir === "desc" ? sorted.reverse() : sorted;
}

export function useDepartments(filters?: DepartmentListFilters) {
  const activeOnly = filters?.activeOnly ?? true;

  return useQuery({
    queryKey: queryKeys.departments.list(filters as Record<string, unknown> | undefined),
    queryFn: async (): Promise<DepartmentWithStats[]> => {
      let query = supabase.from("departments").select("*").order("name");

      if (activeOnly) {
        query = query.eq("is_active", true);
      }

      const { data, error } = await query;
      if (error) throw error;

      const departments = (data || []) as Department[];
      if (departments.length === 0) return [];

      const ids = departments.map((d) => d.id);
      const headUserIds = [...new Set(departments.map((d) => d.head_user_id).filter(Boolean))] as string[];
      const [{ userCounts, podCounts }, headNames] = await Promise.all([
        fetchDepartmentStats(ids),
        fetchHeadNames(headUserIds),
      ]);

      let result: DepartmentWithStats[] = departments.map((d) => ({
        ...d,
        user_count: userCounts.get(d.id) || 0,
        pod_count: podCounts.get(d.id) || 0,
        head_name: d.head_user_id ? headNames.get(d.head_user_id) || null : null,
      }));

      if (filters?.search?.trim()) {
        const q = filters.search.toLowerCase();
        result = result.filter(
          (d) =>
            d.name.toLowerCase().includes(q) ||
            (d.description || "").toLowerCase().includes(q)
        );
      }

      return sortDepartments(
        result,
        filters?.sortField || "name",
        filters?.sortDir || "asc"
      );
    },
  });
}

export function useDepartment(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.departments.detail(id || ""),
    queryFn: async (): Promise<DepartmentWithStats | null> => {
      if (!id) return null;

      const { data, error } = await supabase
        .from("departments")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      const dept = data as Department;
      const [{ userCounts, podCounts }, headNames] = await Promise.all([
        fetchDepartmentStats([id]),
        fetchHeadNames(dept.head_user_id ? [dept.head_user_id] : []),
      ]);
      return {
        ...dept,
        user_count: userCounts.get(id) || 0,
        pod_count: podCounts.get(id) || 0,
        head_name: dept.head_user_id ? headNames.get(dept.head_user_id) || null : null,
      };
    },
    enabled: !!id,
  });
}

export function useDepartmentUsers(departmentId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.departments.users(departmentId || ""),
    queryFn: async (): Promise<DepartmentUser[]> => {
      if (!departmentId) return [];

      const { data, error } = await supabase
        .from("department_users")
        .select("id, department_id, user_id, created_at")
        .eq("department_id", departmentId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) return [];

      const userIds = data.map((row) => row.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, full_name, avatar_url, is_active")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

      return data.map((row) => ({
        ...row,
        profile: profileMap.get(row.user_id) || null,
      }));
    },
    enabled: !!departmentId,
  });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: DepartmentFormData) => {
      const { data: department, error } = await supabase
        .from("departments")
        .insert({
          name: data.name.trim(),
          description: data.description?.trim() || null,
          head_user_id: data.head_user_id || null,
          color: data.color || null,
          parent_department_id: data.parent_department_id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return department as Department;
    },
    onSuccess: (department) => {
      invalidateKeys.departments(queryClient);
      void logActivity({
        action: "department.created",
        resourceType: "department",
        resourceId: department.id,
        details: { name: department.name },
      });
      toast.success("Department created successfully");
    },
    onError: (error: Error) => {
      console.error("Error creating department:", error);
      toast.error(error.message.includes("unique") ? "A department with this name already exists" : "Failed to create department");
    },
  });
}

export function useUpdateDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: DepartmentFormData }) => {
      const { data: department, error } = await supabase
        .from("departments")
        .update({
          name: data.name.trim(),
          description: data.description?.trim() || null,
          head_user_id: data.head_user_id || null,
          color: data.color || null,
          parent_department_id: data.parent_department_id || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return department as Department;
    },
    onSuccess: (department, { id }) => {
      invalidateKeys.departments(queryClient);
      queryClient.invalidateQueries({ queryKey: queryKeys.departments.detail(id) });
      void logActivity({
        action: "department.updated",
        resourceType: "department",
        resourceId: id,
        details: { name: department.name },
      });
      toast.success("Department updated successfully");
    },
    onError: (error: Error) => {
      console.error("Error updating department:", error);
      toast.error(error.message.includes("unique") ? "A department with this name already exists" : "Failed to update department");
    },
  });
}

export function useDeleteDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("departments")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      invalidateKeys.departments(queryClient);
      void logActivity({
        action: "department.deleted",
        resourceType: "department",
        resourceId: id,
      });
      toast.success("Department deactivated successfully");
    },
    onError: (error: Error) => {
      console.error("Error deleting department:", error);
      toast.error("Failed to deactivate department");
    },
  });
}

export function useAssignDepartmentUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ departmentId, userId }: { departmentId: string; userId: string }) => {
      const { error: assignError } = await supabase
        .from("department_users")
        .insert({ department_id: departmentId, user_id: userId });

      if (assignError) {
        if (assignError.code === "23505") {
          throw new Error("User is already assigned to this department");
        }
        throw assignError;
      }

      const { data: existingProfile } = await supabase
        .from("employee_profiles")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (existingProfile) {
        const { error: profileError } = await supabase
          .from("employee_profiles")
          .update({ department_id: departmentId, updated_at: new Date().toISOString() })
          .eq("user_id", userId);

        if (profileError) throw profileError;
      }
    },
    onSuccess: (_, { departmentId }) => {
      invalidateKeys.departments(queryClient);
      queryClient.invalidateQueries({ queryKey: queryKeys.departments.users(departmentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.departments.detail(departmentId) });
      toast.success("User assigned to department");
    },
    onError: (error: Error) => {
      console.error("Error assigning user:", error);
      toast.error(error.message || "Failed to assign user");
    },
  });
}

export function useRemoveDepartmentUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      departmentId,
      userId,
      assignmentId,
    }: {
      departmentId: string;
      userId: string;
      assignmentId: string;
    }) => {
      const { error: removeError } = await supabase
        .from("department_users")
        .delete()
        .eq("id", assignmentId);

      if (removeError) throw removeError;

      const { error: profileError } = await supabase
        .from("employee_profiles")
        .update({ department_id: null, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("department_id", departmentId);

      if (profileError) throw profileError;
    },
    onSuccess: (_, { departmentId }) => {
      invalidateKeys.departments(queryClient);
      queryClient.invalidateQueries({ queryKey: queryKeys.departments.users(departmentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.departments.detail(departmentId) });
      toast.success("User removed from department");
    },
    onError: (error: Error) => {
      console.error("Error removing user:", error);
      toast.error("Failed to remove user from department");
    },
  });
}

export function useActiveUsersSearch(search?: string) {
  return useQuery({
    queryKey: ["profiles", "active-search", search],
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select("id, email, full_name, avatar_url")
        .eq("is_active", true)
        .order("full_name")
        .limit(50);

      if (search?.trim()) {
        query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });
}

export function useAvailableDepartmentUsers(departmentId: string | undefined, search?: string) {
  return useQuery({
    queryKey: ["departments", "available-users", departmentId, search],
    queryFn: async () => {
      if (!departmentId) return [];

      const { data: assigned, error: assignedError } = await supabase
        .from("department_users")
        .select("user_id")
        .eq("department_id", departmentId);

      if (assignedError) throw assignedError;

      const assignedIds = new Set((assigned || []).map((row) => row.user_id));

      let query = supabase
        .from("profiles")
        .select("id, email, full_name, avatar_url, is_active")
        .eq("is_active", true)
        .order("full_name");

      if (search?.trim()) {
        query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;

      return (data || []).filter((profile) => !assignedIds.has(profile.id));
    },
    enabled: !!departmentId,
  });
}
