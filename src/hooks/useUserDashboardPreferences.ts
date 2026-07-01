import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

type DashboardType = 'owner' | 'pm' | 'ic';

interface DashboardPreference {
  widget_slug: string;
  is_visible: boolean;
  sort_order: number;
  filter_pod_id?: string | null;
  filter_client_status?: string | null;
  filter_project_status?: string | null;
  filter_risk_level?: string | null;
}

export function useUserDashboardPreferences(dashboardType: DashboardType) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: preferences = {} } = useQuery({
    queryKey: ['user-dashboard-preferences', user?.id, dashboardType],
    queryFn: async () => {
      if (!user?.id) return {};

      const { data, error } = await (supabase as any)
        .from('user_dashboard_preferences')
        .select('*')
        .eq('user_id', user.id)
        .eq('dashboard_type', dashboardType);

      if (error) {
        console.error('Failed to fetch dashboard preferences:', error);
        return {};
      }

      return (data as any[]).reduce(
        (acc: Record<string, DashboardPreference>, pref: any) => {
          acc[pref.widget_slug] = pref;
          return acc;
        },
        {} as Record<string, DashboardPreference>
      );
    },
    enabled: !!user?.id,
  });

  const updateWidgetVisibility = useMutation({
    mutationFn: async ({
      widgetSlug,
      isVisible,
    }: {
      widgetSlug: string;
      isVisible: boolean;
    }) => {
      const { error } = await (supabase as any)
        .from('user_dashboard_preferences')
        .upsert({
          user_id: user?.id,
          dashboard_type: dashboardType,
          widget_slug: widgetSlug,
          is_visible: isVisible,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['user-dashboard-preferences', user?.id, dashboardType],
      });
      toast.success('Dashboard updated');
    },
    onError: () => {
      toast.error('Failed to update dashboard');
    },
  });

  const updateFilters = useMutation({
    mutationFn: async ({
      widgetSlug,
      filters,
    }: {
      widgetSlug: string;
      filters: {
        filter_pod_id?: string | null;
        filter_client_status?: string | null;
        filter_project_status?: string | null;
        filter_risk_level?: string | null;
      };
    }) => {
      const { error } = await (supabase as any)
        .from('user_dashboard_preferences')
        .upsert({
          user_id: user?.id,
          dashboard_type: dashboardType,
          widget_slug: widgetSlug,
          ...filters,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['user-dashboard-preferences', user?.id, dashboardType],
      });
      toast.success('Filters updated');
    },
    onError: () => {
      toast.error('Failed to update filters');
    },
  });

  return {
    preferences,
    updateWidgetVisibility,
    updateFilters,
  };
}
