/**
 * Sync meeting platform integrations from the Integration Hub or meeting pages.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  isMeetingSyncProvider,
  type IntegrationDataDestination,
} from '@/lib/integration-preferences';

export interface MeetingSyncResult {
  message?: string;
}

export function useMeetingSync(
  defaultProviderSlug = '',
  destinations: IntegrationDataDestination[] = []
) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input?: {
      providerSlug?: string;
      destinations?: IntegrationDataDestination[];
    }): Promise<MeetingSyncResult> => {
      const slug = input?.providerSlug || defaultProviderSlug;
      if (!slug || !isMeetingSyncProvider(slug)) {
        throw new Error(
          `Sync is not yet available for "${slug}". Connect Zoom, Microsoft Teams, or Google Meet.`
        );
      }

      if (slug === 'microsoft-teams') {
        throw new Error(
          'Microsoft Teams sync runs through the Teams calendar connector. Use Sync on the hub or meeting page.'
        );
      }

      if (!user) throw new Error('User not authenticated');

      const activeDestinations = input?.destinations?.length
        ? input.destinations
        : destinations;
      const syncTranscripts =
        activeDestinations.includes('transcripts') || activeDestinations.length === 0;

      const functionName =
        slug === 'google-meet' ? 'sync-google-meet' : 'sync-zoom-files';

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: {
          user_id: user.id,
          force_refresh: false,
          sync_recordings: true,
          sync_transcripts: syncTranscripts,
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

      const message =
        (data as { message?: string })?.message ??
        `Synced meetings from ${slug.replace(/-/g, ' ')}.`;

      return { message };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      queryClient.invalidateQueries({ queryKey: ['zoom-files'] });
      queryClient.invalidateQueries({ queryKey: ['google-meet-files'] });
      queryClient.invalidateQueries({ queryKey: ['meeting-transcripts'] });
      toast.success('Meeting sync complete', { description: result.message });
    },
    onError: (err: Error) => {
      toast.error('Meeting sync failed', { description: err.message });
    },
  });
}
