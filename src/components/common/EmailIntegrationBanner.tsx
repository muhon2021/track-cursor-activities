/**
 * Banner for email-related pages — default provider, display destinations, and sync.
 */

import { useState } from 'react';
import { Link2, Mail, X, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEmailIntegrationDisplay } from '@/hooks/useEmailIntegrationDisplay';
import { useEmailSync } from '@/hooks/useEmailSync';
import {
  isEmailSyncProvider,
  INTEGRATION_DATA_DESTINATION_LABELS,
} from '@/lib/integration-preferences';

const DISMISS_KEY = 'hide-email-integration-banner';

interface EmailIntegrationBannerProps {
  page: 'lead-followup' | 'contacts' | 'notifications';
}

export function EmailIntegrationBanner({ page }: EmailIntegrationBannerProps) {
  const [dismissed, setDismissed] = useState(
    () => !!localStorage.getItem(DISMISS_KEY)
  );
  const {
    primarySlug,
    primaryLabel,
    destinations,
    showOnLeadFollowup,
    showOnContacts,
    showOnNotifications,
    isLoading,
  } = useEmailIntegrationDisplay();
  const emailSync = useEmailSync(primarySlug ?? '', destinations);

  const pageEnabled =
    page === 'lead-followup'
      ? showOnLeadFollowup
      : page === 'contacts'
        ? showOnContacts
        : showOnNotifications;
  const canSync = !!primarySlug && isEmailSyncProvider(primarySlug);

  if (dismissed || isLoading || !pageEnabled || !primarySlug || !primaryLabel) {
    return null;
  }

  const destinationLabels = destinations.map(
    (d) => INTEGRATION_DATA_DESTINATION_LABELS[d]
  );

  return (
    <div className="flex items-center gap-3 w-full rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm dark:border-blue-900 dark:bg-blue-950/40">
      <Link2 className="h-4 w-4 text-blue-600 flex-shrink-0" />
      <span className="flex-1 text-blue-800 dark:text-blue-100">
        <span className="font-medium">Email via {primaryLabel}</span>
        {destinationLabels.length > 0 && (
          <span className="text-blue-600 dark:text-blue-300">
            {' '}
            · Showing on: {destinationLabels.join(', ')}
          </span>
        )}
      </span>
      {canSync && (
        <Button
          variant="outline"
          size="sm"
          className="border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:text-blue-200"
          disabled={emailSync.isPending}
          onClick={() =>
            emailSync.mutate({
              providerSlug: primarySlug,
              destinations: [page],
            })
          }
        >
          {emailSync.isPending ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          )}
          Sync {primaryLabel}
        </Button>
      )}
      <Button variant="ghost" size="sm" asChild className="text-blue-700">
        <a href="/admin/integrations">
          <Mail className="h-3.5 w-3.5 mr-1" />
          Integrations
        </a>
      </Button>
      <button
        type="button"
        onClick={() => {
          localStorage.setItem(DISMISS_KEY, '1');
          setDismissed(true);
        }}
        className="text-blue-400 hover:text-blue-600 transition-colors flex-shrink-0"
        aria-label="Dismiss banner"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
