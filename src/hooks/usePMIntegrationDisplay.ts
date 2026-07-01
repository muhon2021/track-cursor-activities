/**
 * Read project-management integration display settings for Projects / Tasks pages.
 */

import { useMemo } from 'react';
import { usePrimaryByCategorySettings } from '@/hooks/useIntegrationSettings';
import {
  getDataDestinationsForProvider,
  shouldShowSyncedDataOnPage,
  type PrimaryIntegrationCategorySlug,
} from '@/lib/integration-preferences';

const PM_CATEGORY: PrimaryIntegrationCategorySlug = 'project-management';

export function usePMIntegrationDisplay() {
  const { data: primaryByCategory, isLoading } = usePrimaryByCategorySettings();

  return useMemo(() => {
    const pref = primaryByCategory?.[PM_CATEGORY];
    const primarySlug = pref?.primary_slug ?? null;
    const destinations = getDataDestinationsForProvider(
      pref,
      primarySlug,
      PM_CATEGORY
    );

    return {
      isLoading,
      pref,
      primarySlug,
      destinations,
      showOnProjects: shouldShowSyncedDataOnPage(pref, primarySlug, 'projects', PM_CATEGORY),
      showOnTasks: shouldShowSyncedDataOnPage(pref, primarySlug, 'tasks', PM_CATEGORY),
    };
  }, [isLoading, primaryByCategory]);
}

export { getIntegrationViewPath } from '@/lib/integration-display';
