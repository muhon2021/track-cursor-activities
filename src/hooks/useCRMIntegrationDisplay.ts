/**
 * Read CRM integration display settings for Clients / Deals / Contacts pages.
 */

import { useMemo } from 'react';
import { usePrimaryByCategorySettings } from '@/hooks/useIntegrationSettings';
import {
  getDataDestinationsForProvider,
  shouldShowSyncedDataOnPage,
  type PrimaryIntegrationCategorySlug,
} from '@/lib/integration-preferences';

const CRM_CATEGORY: PrimaryIntegrationCategorySlug = 'crm-systems';

export function useCRMIntegrationDisplay() {
  const { data: primaryByCategory, isLoading } = usePrimaryByCategorySettings();

  return useMemo(() => {
    const pref = primaryByCategory?.[CRM_CATEGORY];
    const primarySlug = pref?.primary_slug ?? null;
    const destinations = getDataDestinationsForProvider(
      pref,
      primarySlug,
      CRM_CATEGORY
    );

    return {
      isLoading,
      pref,
      primarySlug,
      destinations,
      showOnClients: shouldShowSyncedDataOnPage(pref, primarySlug, 'clients', CRM_CATEGORY),
      showOnDeals: shouldShowSyncedDataOnPage(pref, primarySlug, 'deals', CRM_CATEGORY),
      showOnContacts: shouldShowSyncedDataOnPage(pref, primarySlug, 'contacts', CRM_CATEGORY),
    };
  }, [isLoading, primaryByCategory]);
}
