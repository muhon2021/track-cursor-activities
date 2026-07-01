/**
 * Model Sync Hook
 * Hook for syncing AI models from provider APIs
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface SyncModelsParams {
  providerSlug: string;
  apiKey?: string;
}

interface SyncResult {
  success: boolean;
  synced?: number;
  updated?: number;
  errors?: number;
  total?: number;
  error?: string;
}

/**
 * Sync models from a provider's API
 */
export function useSyncModels() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ providerSlug, apiKey }: SyncModelsParams): Promise<SyncResult> => {
      const { data, error } = await supabase.functions.invoke('sync-ai-models', {
        body: {
          providerSlug,
          apiKey,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to sync models');
      }

      if (!data.success) {
        throw new Error(data.error || 'Model sync failed');
      }

      return data as SyncResult;
    },
    onSuccess: () => {
      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ['ai_models'] });
      queryClient.invalidateQueries({ queryKey: ['ai_providers'] });
    },
  });
}

/**
 * Sync models for all providers
 */
export function useSyncAllModels() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<Record<string, SyncResult>> => {
      const providers = ['openai', 'anthropic', 'google', 'perplexity'];
      const results: Record<string, SyncResult> = {};

      for (const providerSlug of providers) {
        try {
          const { data, error } = await supabase.functions.invoke('sync-ai-models', {
            body: { providerSlug },
          });

          if (error || !data.success) {
            results[providerSlug] = {
              success: false,
              error: error?.message || data?.error || 'Sync failed',
            };
          } else {
            results[providerSlug] = data as SyncResult;
          }
        } catch (error) {
          results[providerSlug] = {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      }

      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai_models'] });
      queryClient.invalidateQueries({ queryKey: ['ai_providers'] });
    },
  });
}
