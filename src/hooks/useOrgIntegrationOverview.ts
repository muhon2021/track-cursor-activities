/**
 * Org-wide integration hub status for user Settings (read-only).
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys, cacheConfig } from '@/lib/cache';
import {
  buildOrgIntegrationCategoryViews,
  type OrgIntegrationCategoryView,
  type OrgIntegrationHubStatusPayload,
} from '@/lib/org-integration-overview';

export function useOrgIntegrationOverview() {
  return useQuery({
    queryKey: queryKeys.integrationSettings.orgOverview(),
    queryFn: async (): Promise<OrgIntegrationCategoryView[]> => {
      const { data, error } = await supabase.rpc('get_org_integration_hub_status');
      if (error) throw error;
      return buildOrgIntegrationCategoryViews(
        data as OrgIntegrationHubStatusPayload | null
      );
    },
    staleTime: cacheConfig.staleTime.medium,
  });
}
