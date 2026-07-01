/**
 * Read email-provider integration display settings for Lead Follow-Up / Contacts / Notifications.
 */

import { useMemo } from 'react';
import { usePrimaryByCategorySettings } from '@/hooks/useIntegrationSettings';
import {
  getDataDestinationsForProvider,
  shouldShowSyncedDataOnPage,
  type PrimaryIntegrationCategorySlug,
} from '@/lib/integration-preferences';

const EMAIL_CATEGORY: PrimaryIntegrationCategorySlug = 'email-providers';

function formatProviderLabel(slug: string): string {
  const labels: Record<string, string> = {
    sendgrid: 'SendGrid',
    outlook: 'Outlook',
    mailgun: 'Mailgun',
    postmark: 'Postmark',
    'amazon-ses': 'Amazon SES',
    resend: 'Resend',
  };
  return labels[slug] ?? slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function useEmailIntegrationDisplay() {
  const { data: primaryByCategory, isLoading } = usePrimaryByCategorySettings();

  return useMemo(() => {
    const pref = primaryByCategory?.[EMAIL_CATEGORY];
    const primarySlug = pref?.primary_slug ?? null;
    const destinations = getDataDestinationsForProvider(
      pref,
      primarySlug,
      EMAIL_CATEGORY
    );

    return {
      isLoading,
      pref,
      primarySlug,
      primaryLabel: primarySlug ? formatProviderLabel(primarySlug) : null,
      destinations,
      showOnLeadFollowup: shouldShowSyncedDataOnPage(
        pref,
        primarySlug,
        'lead-followup',
        EMAIL_CATEGORY
      ),
      showOnContacts: shouldShowSyncedDataOnPage(
        pref,
        primarySlug,
        'contacts',
        EMAIL_CATEGORY
      ),
      showOnNotifications: shouldShowSyncedDataOnPage(
        pref,
        primarySlug,
        'notifications',
        EMAIL_CATEGORY
      ),
    };
  }, [isLoading, primaryByCategory]);
}
