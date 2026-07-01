/**
 * Read meeting-provider integration display settings for Schedule / Transcripts pages.
 */

import { useMemo } from 'react';
import { usePrimaryByCategorySettings } from '@/hooks/useIntegrationSettings';
import {
  getDataDestinationsForProvider,
  shouldShowSyncedDataOnPage,
  type PrimaryIntegrationCategorySlug,
} from '@/lib/integration-preferences';

const MEETING_CATEGORY: PrimaryIntegrationCategorySlug = 'meeting-providers';

function formatProviderLabel(slug: string): string {
  const labels: Record<string, string> = {
    zoom: 'Zoom',
    'microsoft-teams': 'Microsoft Teams',
    'google-meet': 'Google Meet',
    webex: 'Webex',
    gotomeeting: 'GoTo Meeting',
    fellow: 'Fellow',
  };
  return labels[slug] ?? slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function useMeetingIntegrationDisplay() {
  const { data: primaryByCategory, isLoading } = usePrimaryByCategorySettings();

  return useMemo(() => {
    const pref = primaryByCategory?.[MEETING_CATEGORY];
    const primarySlug = pref?.primary_slug ?? null;
    const destinations = getDataDestinationsForProvider(
      pref,
      primarySlug,
      MEETING_CATEGORY
    );

    return {
      isLoading,
      pref,
      primarySlug,
      primaryLabel: primarySlug ? formatProviderLabel(primarySlug) : null,
      destinations,
      showOnSchedule: shouldShowSyncedDataOnPage(
        pref,
        primarySlug,
        'schedule',
        MEETING_CATEGORY
      ),
      showOnTranscripts: shouldShowSyncedDataOnPage(
        pref,
        primarySlug,
        'transcripts',
        MEETING_CATEGORY
      ),
    };
  }, [isLoading, primaryByCategory]);
}
