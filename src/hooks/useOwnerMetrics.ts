import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys, cacheConfig } from "@/lib/cache";
import { useDashboardFilters } from "./useDashboardFilters";

export interface OwnerMetrics {
  revenue_this_week: number;
  team_utilization: number;
  projects_in_progress: number;
  projects_at_risk: number;
  active_clients: number;
  active_team_members: number;
  generated_at: string;
}

/**
 * Queries the owner_dashboard_metrics view.
 * Returns a single-row aggregate with key business health metrics.
 *
 * Dashboard filters are included in the cache key so changes to filters
 * trigger a refetch. The view is currently a global aggregate; when
 * per-pod / per-status views are added, query filters can be applied here.
 */
export function useOwnerMetrics() {
  const filters = useDashboardFilters("owner");

  return useQuery({
    queryKey: [...queryKeys.dashboard.ownerMetrics, filters],
    queryFn: async (): Promise<OwnerMetrics> => {
      const { data, error } = await supabase
        .from("owner_dashboard_metrics" as any)
        .select("*")
        .single();

      if (error) throw error;
      return data as unknown as OwnerMetrics;
    },
    staleTime: cacheConfig.staleTime.short,
  });
}
