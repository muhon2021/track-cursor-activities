import { useUserDashboardPreferences } from './useUserDashboardPreferences';

type DashboardType = 'owner' | 'pm' | 'ic';

export interface DashboardFilters {
  pod_id?: string | null;
  client_status?: string | null;
  project_status?: string | null;
  risk_level?: string | null;
}

export function useDashboardFilters(dashboardType: DashboardType) {
  const { preferences } = useUserDashboardPreferences(dashboardType);

  const globalPrefs = (preferences['dashboard-global'] || {}) as Record<string, any>;

  const filters: DashboardFilters = {
    pod_id: globalPrefs.filter_pod_id || null,
    client_status: globalPrefs.filter_client_status || null,
    project_status: globalPrefs.filter_project_status || null,
    risk_level: globalPrefs.filter_risk_level || null,
  };

  return filters;
}
