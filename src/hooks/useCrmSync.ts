/**
 * Sync CRM integrations from the Integration Hub or CRM pages.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { API } from '@/shared/config/api';
import { invalidateKeys } from '@/lib/cache';
import {
  isCrmSyncProvider,
  type IntegrationDataDestination,
} from '@/lib/integration-preferences';
import type { ZohoCrmResource } from '@/hooks/useIntegrationSync';

export interface CrmSyncResult {
  processed: number;
  message?: string;
}

function resourcesForDestinations(
  destinations: IntegrationDataDestination[]
): ZohoCrmResource[] {
  const resources = new Set<ZohoCrmResource>();
  if (destinations.includes('clients')) resources.add('accounts');
  if (destinations.includes('deals')) {
    resources.add('deals');
    resources.add('leads');
  }
  if (destinations.includes('contacts')) resources.add('contacts');
  if (resources.size === 0) {
    return ['accounts', 'deals', 'leads', 'contacts'];
  }
  return [...resources];
}

export function useCrmSync(
  defaultProviderSlug = '',
  destinations: IntegrationDataDestination[] = []
) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input?: {
      providerSlug?: string;
      destinations?: IntegrationDataDestination[];
    }): Promise<CrmSyncResult> => {
      const slug = input?.providerSlug || defaultProviderSlug;
      if (!slug || !isCrmSyncProvider(slug)) {
        throw new Error(
          `Sync is not yet available for "${slug}". Connect Zoho CRM to sync clients, deals, and contacts.`
        );
      }

      const activeDestinations = input?.destinations?.length
        ? input.destinations
        : destinations;
      const resources = resourcesForDestinations(activeDestinations);
      let processed = 0;

      for (const resource of resources) {
        const { data, error } = await supabase.functions.invoke(API.CRM.ZOHO_SYNC, {
          body: {
            resource,
            provider: slug,
            user_id: user?.id ?? undefined,
          },
        });
        if (error) throw error;
        if (
          data &&
          typeof data === 'object' &&
          'error' in data &&
          (data as { error?: string }).error
        ) {
          throw new Error(String((data as { error: string }).error));
        }
        processed += (data as { processed?: number })?.processed ?? 0;
      }

      return {
        processed,
        message: `Synced ${processed} CRM record${processed !== 1 ? 's' : ''} from Zoho.`,
      };
    },
    onSuccess: (result) => {
      invalidateKeys.clients(queryClient);
      invalidateKeys.deals(queryClient);
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('CRM sync complete', { description: result.message });
    },
    onError: (err: Error) => {
      toast.error('CRM sync failed', { description: err.message });
    },
  });
}
