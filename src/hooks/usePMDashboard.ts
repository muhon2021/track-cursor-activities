import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys, cacheConfig } from "@/lib/cache";
import { useAuth } from "@/contexts/AuthContext";

export interface PodCapacity {
  pod_id: string;
  total_team_members: number;
  at_capacity: number;
  available: number;
  avg_utilization: number;
  week_start: string;
}

/**
 * Queries the pm_team_capacity view for all pods.
 * Requires productivity_records rows for the current week.
 */
export function usePMTeamCapacity(podId?: string) {
  return useQuery({
    queryKey: queryKeys.dashboard.pmCapacity(podId),
    queryFn: async (): Promise<PodCapacity[]> => {
      // pm_team_capacity is a view not yet in generated types
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase as any)
        .from("pm_team_capacity")
        .select("*");

      if (podId) {
        query = query.eq("pod_id", podId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as PodCapacity[];
    },
    staleTime: cacheConfig.staleTime.short,
  });
}

/**
 * Returns tasks assigned to the current user.
 * Used on the IC dashboard "My Work" kanban.
 *
 * @param hideCompleted - when true, excludes done/cancelled tasks (matches
 *   the user's hide_completed_tasks dashboard preference). When false (default),
 *   all statuses including done are returned so the kanban can show a Done column.
 */
export function useMyTasks(filters?: { hideCompleted?: boolean }) {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.dashboard.myTasks(user?.id ?? "", filters),
    queryFn: async () => {
      if (!user?.id) return [];
      let query = supabase
        .from("tasks")
        .select("id, title, status, priority, due_date, client_id, clients(name)")
        .eq("assigned_to", user.id)
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (filters?.hideCompleted) {
        query = query.not("status", "in", "(\"completed\",\"cancelled\")");
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.id,
    staleTime: cacheConfig.staleTime.short,
  });
}

/**
 * Returns projects where the current user is a member.
 * Used on the IC dashboard "My Projects" section.
 */
export function useMyProjects() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.dashboard.myProjects(user?.id ?? ""),
    queryFn: async () => {
      if (!user?.id) return [];
      // Find project IDs where user is a member
      const { data: memberRows, error: memberError } = await supabase
        .from("project_members")
        .select("project_id, role")
        .eq("user_id", user.id);

      if (memberError) throw memberError;
      if (!memberRows || memberRows.length === 0) return [];

      const projectIds = memberRows.map((r: { project_id: string }) => r.project_id);
      const roleMap = Object.fromEntries(
        memberRows.map((r: { project_id: string; role: string }) => [r.project_id, r.role])
      );

      const { data, error } = await supabase
        .from("projects")
        .select("id, name, slug, status_id, end_date, client_id, clients(name), project_statuses(name, color, slug)")
        .in("id", projectIds)
        .eq("is_archived", false)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data ?? []).map((p: any) => ({ ...p, myRole: roleMap[p.id] ?? "member" }));
    },
    enabled: !!user?.id,
    staleTime: cacheConfig.staleTime.medium,
  });
}
