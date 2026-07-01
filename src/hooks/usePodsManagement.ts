/**
 * Admin POD Management — fetch pods with member counts and profile stats.
 * Used by the POD Management admin page.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const PODS_MANAGEMENT_KEY = ["admin", "pods-management"] as const;

export interface PodWithStats {
  id: string;
  name: string;
  description: string | null;
  department_id: string | null;
  is_active: boolean | null;
  created_at: string | null;
  hr_synced: number;
  rp_members: number;
  has_profile: number;
  show_in_projection: boolean;
}

export interface PodsManagementStats {
  totalPods: number;
  hrSynced: number;
  rpMembers: number;
  hasLogin: number;
  noProfile: number;
}

export interface PodsManagementData {
  pods: PodWithStats[];
  stats: PodsManagementStats;
}

export function usePodsManagement(search?: string) {
  return useQuery({
    queryKey: [...PODS_MANAGEMENT_KEY, search ?? ""],
    queryFn: async (): Promise<PodsManagementData> => {
      const [podRes, memberRes, profileRes] = await Promise.all([
        supabase
          .from("pods")
          .select("id, name, description, department_id, is_active, created_at")
          .order("name"),
        supabase.from("pod_members").select("pod_id, user_id"),
        supabase.from("employee_profiles").select("user_id"),
      ]);

      const pods = (podRes.data || []) as Array<{
        id: string;
        name: string;
        description: string | null;
        department_id: string | null;
        is_active: boolean | null;
        created_at: string | null;
      }>;
      const members = (memberRes.data || []) as Array<{ pod_id: string; user_id: string }>;
      const profileUserIds = new Set(
        (profileRes.data || []).map((p: { user_id: string | null }) => p.user_id).filter(Boolean)
      );

      let totalHrSynced = 0;
      const hasLoginSet = new Set<string>();
      const noProfileSet = new Set<string>();

      const podsWithStats: PodWithStats[] = pods.map((pod) => {
        const podMembers = members.filter((m) => m.pod_id === pod.id);
        const withProfile = podMembers.filter((m) => profileUserIds.has(m.user_id)).length;
        podMembers.forEach((m) => {
          totalHrSynced += 1;
          if (profileUserIds.has(m.user_id)) {
            hasLoginSet.add(m.user_id);
          } else {
            noProfileSet.add(m.user_id);
          }
        });
        return {
          ...pod,
          hr_synced: podMembers.length,
          rp_members: podMembers.length,
          has_profile: withProfile,
          show_in_projection: true, // Default until we have a DB column
        };
      });

      const stats: PodsManagementStats = {
        totalPods: pods.length,
        hrSynced: totalHrSynced,
        rpMembers: totalHrSynced,
        hasLogin: hasLoginSet.size,
        noProfile: noProfileSet.size,
      };

      let result = podsWithStats;
      if (search?.trim()) {
        const q = search.trim().toLowerCase();
        result = result.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.description || "").toLowerCase().includes(q)
        );
      }

      return { pods: result, stats };
    },
  });
}

export function useInvalidatePodsManagement() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: PODS_MANAGEMENT_KEY });
}
