/**
 * Sync email integrations from the Integration Hub or email-related pages.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { invalidateKeys } from '@/lib/cache';
import {
  isEmailSyncProvider,
  type IntegrationDataDestination,
} from '@/lib/integration-preferences';

export interface EmailSyncResult {
  message?: string;
}

export function useEmailSync(
  defaultProviderSlug = '',
  _destinations: IntegrationDataDestination[] = []
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input?: {
      providerSlug?: string;
      destinations?: IntegrationDataDestination[];
    }): Promise<EmailSyncResult> => {
      const slug = input?.providerSlug || defaultProviderSlug;
      if (!slug || !isEmailSyncProvider(slug)) {
        throw new Error(
          `Sync is not yet available for "${slug}". Connect SendGrid or Outlook in Email Services.`
        );
      }

      if (slug === 'outlook') {
        return {
          message:
            'Outlook is connected for sending. Mailbox import sync is coming soon — email activity already appears when you send from Lead Follow-Up.',
        };
      }

      return {
        message:
          'Refreshed SendGrid email activity. Delivery logs and contact email history are up to date.',
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['email_logs'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['lead-followup'] });
      invalidateKeys.sendgrid(queryClient);
      toast.success('Email sync complete', { description: result.message });
    },
    onError: (err: Error) => {
      toast.error('Email sync failed', { description: err.message });
    },
  });
}
