import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys, cacheConfig } from "@/lib/cache";
import type { AgencyRole } from "@/hooks/useAgencyRole";

export interface DashboardWidget {
  id: string;
  widget_slug: string;
  display_name: string;
  description: string | null;
  component_name: string;
  agency_roles: string[];
  is_enabled: boolean;
  sort_order: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/**
 * Returns all widgets from the dashboard_widgets registry.
 * Optionally filters to only those applicable to a given agency role.
 *
 * Used by:
 *  - Admin DashboardWidgets page (no role filter — shows all)
 *  - Dashboard components (role-filtered + is_enabled checked)
 */
export function useDashboardWidgets(role?: AgencyRole | null) {
  const qKey = role
    ? [...queryKeys.dashboard.widgets, role]
    : queryKeys.dashboard.widgets;

  return useQuery<DashboardWidget[]>({
    queryKey: qKey,
    queryFn: async (): Promise<DashboardWidget[]> => {
      let query = (supabase as any)
        .from("dashboard_widgets")
        .select("*")
        .order("sort_order", { ascending: true });

      // Filter by role: widget must list the role in its agency_roles array
      if (role) {
        query = query.contains("agency_roles", [role]);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as DashboardWidget[];
    },
    staleTime: cacheConfig.staleTime.long,
  });
}

/**
 * Returns true if a specific widget slug is enabled for the current agency role.
 * Provides a zero-query fast-path by reading from the cached list.
 */
export function useIsWidgetEnabled(slug: string, role?: AgencyRole | null): boolean {
  const { data: widgets } = useDashboardWidgets(role);
  if (!widgets) return true; // optimistic default while loading
  const widget = widgets.find((w) => w.widget_slug === slug);
  if (!widget) return true; // unknown widgets default to visible
  return widget.is_enabled;
}

/* ─── Admin mutations ─────────────────────────────────────────────────────── */

export function useUpdateWidget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<Pick<DashboardWidget, "is_enabled" | "sort_order" | "display_name" | "description">>;
    }) => {
      const { error } = await (supabase as any)
        .from("dashboard_widgets")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      // Invalidate all variants (filtered + unfiltered)
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.widgets });
    },
    onError: () => {
      toast.error("Failed to update widget.");
    },
  });
}
