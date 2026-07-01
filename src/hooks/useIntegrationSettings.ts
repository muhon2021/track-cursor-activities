/**
 * Integration Settings Hooks
 * Primary integrations and primary knowledge source preferences
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys, invalidateKeys, cacheConfig } from '@/lib/cache';
import { toast } from 'sonner';
import {
  INTERNAL_KNOWLEDGE_SOURCE_TYPES,
  KNOWLEDGE_CAPABLE_PROVIDER_SLUGS,
  PRIMARY_INTEGRATION_CATEGORY_SLUGS,
  getIntegrationPreferences,
  knowledgeSourceRefKey,
  keysToKnowledgeSourceRefs,
  saveIntegrationPreferences,
  getPrimaryByCategorySettings,
  savePrimaryByCategory,
  type IntegrationPreferenceOption,
  type IntegrationPreferencesInput,
  type PrimaryKnowledgeSourceRef,
  type PrimaryByCategory,
} from '@/lib/integration-preferences';
import { integrationPreferencesSchema } from '@/lib/validation';

export function useIntegrationSettings() {
  return useQuery({
    queryKey: queryKeys.integrationSettings.preferences(),
    queryFn: getIntegrationPreferences,
    staleTime: cacheConfig.staleTime.medium,
  });
}

export function useSaveIntegrationSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      input: IntegrationPreferencesInput
    ) => {
      const parsed = integrationPreferencesSchema.safeParse(input);
      if (!parsed.success) {
        throw new Error(parsed.error.errors[0]?.message ?? 'Invalid preferences');
      }

      return saveIntegrationPreferences(parsed.data as IntegrationPreferencesInput);
    },
    onSuccess: (data) => {
      invalidateKeys.integrationSettings(queryClient);
      toast.success('Settings saved successfully.');
      if (data.warnings?.length) {
        data.warnings.forEach((warning) => toast.warning(warning));
      }
    },
    onError: (err: Error) => {
      toast.error('Failed to save settings', { description: err.message });
    },
  });
}

export function useIntegrationPreferenceOptions() {
  return useQuery({
    queryKey: queryKeys.integrationSettings.options(),
    queryFn: async (): Promise<{
      primaryIntegrations: IntegrationPreferenceOption[];
      primaryKnowledgeSources: IntegrationPreferenceOption[];
    }> => {
      const { data: categories, error: catError } = await supabase
        .from('integration_categories')
        .select('id, name, slug')
        .in('slug', [...PRIMARY_INTEGRATION_CATEGORY_SLUGS]);

      if (catError) throw catError;

      const categoryIds = (categories ?? []).map((c) => c.id);
      const categoryById = new Map((categories ?? []).map((c) => [c.id, c]));

      const { data: providers, error: provError } = await supabase
        .from('integration_providers')
        .select('id, name, slug, is_available, category_id')
        .eq('is_available', true)
        .order('display_order', { ascending: true });

      if (provError) throw provError;

      const { data: orgIntegrations, error: orgError } = await supabase
        .from('organization_integrations')
        .select('connection_status, enabled, last_sync_at, provider:integration_providers(slug)');

      if (orgError) throw orgError;

      const { data: knowledgeSources, error: ksError } = await supabase
        .from('knowledge_sources')
        .select('name, source_type, is_active, last_synced_at')
        .eq('is_active', true);

      if (ksError) throw ksError;

      const connectionBySlug = new Map<
        string,
        { status: string | null; lastSyncAt: string | null; connected: boolean }
      >();

      for (const row of orgIntegrations ?? []) {
        const slug = (row.provider as { slug?: string } | null)?.slug;
        if (!slug) continue;
        const connected =
          row.connection_status === 'connected' && row.enabled === true;
        const existing = connectionBySlug.get(slug);
        if (!existing || (connected && !existing.connected)) {
          connectionBySlug.set(slug, {
            status: row.connection_status,
            lastSyncAt: row.last_sync_at,
            connected,
          });
        }
      }

      const primaryIntegrations: IntegrationPreferenceOption[] = (providers ?? [])
        .filter((p) => categoryIds.includes(p.category_id))
        .map((p) => {
          const category = categoryById.get(p.category_id);
          const connection = connectionBySlug.get(p.slug);
          const connected = connection?.connected ?? false;
          return {
            value: p.slug,
            label: p.name,
            categoryLabel: category?.name,
            connectionStatus: connection?.status ?? 'disconnected',
            lastSyncAt: connection?.lastSyncAt ?? null,
            isSelectable: connected,
            disabledReason: connected
              ? undefined
              : 'Integration must be connected before selection.',
            kind: 'integration' as const,
            slug: p.slug,
          };
        });

      const knowledgeIntegrationOptions: IntegrationPreferenceOption[] = (providers ?? [])
        .filter((p) =>
          (KNOWLEDGE_CAPABLE_PROVIDER_SLUGS as readonly string[]).includes(p.slug)
        )
        .map((p) => {
          const connection = connectionBySlug.get(p.slug);
          const connected = connection?.connected ?? false;
          return {
            value: knowledgeSourceRefKey({ kind: 'integration', slug: p.slug }),
            label: p.name,
            description: 'External knowledge integration',
            connectionStatus: connection?.status ?? 'disconnected',
            lastSyncAt: connection?.lastSyncAt ?? null,
            isSelectable: connected,
            disabledReason: connected
              ? undefined
              : 'Knowledge source must be connected before selection.',
            kind: 'integration' as const,
            slug: p.slug,
          };
        });

      const internalBySourceType = new Map<string, IntegrationPreferenceOption>();
      for (const s of knowledgeSources ?? []) {
        if (!(INTERNAL_KNOWLEDGE_SOURCE_TYPES as readonly string[]).includes(s.source_type)) {
          continue;
        }
        const value = knowledgeSourceRefKey({ kind: 'internal', source_type: s.source_type });
        if (internalBySourceType.has(s.source_type)) continue;
        internalBySourceType.set(s.source_type, {
          value,
          label: s.name,
          description: 'Internal platform source',
          connectionStatus: s.is_active ? 'connected' : 'disconnected',
          lastSyncAt: s.last_synced_at,
          isSelectable: s.is_active === true,
          disabledReason:
            s.is_active === true
              ? undefined
              : 'Internal source is not available for synchronization.',
          kind: 'internal' as const,
          sourceType: s.source_type,
        });
      }
      const internalOptions = Array.from(internalBySourceType.values());

      const knowledgeByValue = new Map<string, IntegrationPreferenceOption>();
      for (const opt of [...knowledgeIntegrationOptions, ...internalOptions]) {
        if (!knowledgeByValue.has(opt.value)) {
          knowledgeByValue.set(opt.value, opt);
        }
      }

      return {
        primaryIntegrations,
        primaryKnowledgeSources: Array.from(knowledgeByValue.values()),
      };
    },
    staleTime: cacheConfig.staleTime.short,
  });
}

export function usePrimaryByCategorySettings() {
  return useQuery({
    queryKey: queryKeys.integrationSettings.primaryByCategory(),
    queryFn: getPrimaryByCategorySettings,
    staleTime: cacheConfig.staleTime.medium,
  });
}

export interface CategoryIntegrationOption {
  slug: string;
  name: string;
  connected: boolean;
}

export interface CategoryWithOptions {
  slug: (typeof PRIMARY_INTEGRATION_CATEGORY_SLUGS)[number];
  name: string;
  options: CategoryIntegrationOption[];
}

/** Connected providers grouped by primary-eligible category, for the per-category cards */
export function useCategoryIntegrationOptions() {
  return useQuery({
    queryKey: queryKeys.integrationSettings.categoryOptions(),
    queryFn: async (): Promise<CategoryWithOptions[]> => {
      const { data: categories, error: catError } = await supabase
        .from('integration_categories')
        .select('id, name, slug')
        .in('slug', [...PRIMARY_INTEGRATION_CATEGORY_SLUGS]);
      if (catError) throw catError;

      const { data: providers, error: provError } = await supabase
        .from('integration_providers')
        .select('id, name, slug, is_available, category_id')
        .eq('is_available', true)
        .order('display_order', { ascending: true });
      if (provError) throw provError;

      const { data: orgIntegrations, error: orgError } = await supabase
        .from('organization_integrations')
        .select('connection_status, enabled, provider:integration_providers(slug)');
      if (orgError) throw orgError;

      const connectedSlugs = new Set<string>();
      for (const row of orgIntegrations ?? []) {
        const slug = (row.provider as { slug?: string } | null)?.slug;
        if (slug && row.connection_status === 'connected' && row.enabled === true) {
          connectedSlugs.add(slug);
        }
      }

      return (categories ?? []).map((category) => ({
        slug: category.slug as CategoryWithOptions['slug'],
        name: category.name,
        options: (providers ?? [])
          .filter((p) => p.category_id === category.id)
          .map((p) => ({
            slug: p.slug,
            name: p.name,
            connected: connectedSlugs.has(p.slug),
          })),
      }));
    },
    staleTime: cacheConfig.staleTime.short,
  });
}

export function useSavePrimaryByCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Partial<PrimaryByCategory>) => savePrimaryByCategory(input),
    onSuccess: (data) => {
      invalidateKeys.integrationSettings(queryClient);
      toast.success('Integration preferences saved.');
      data.warnings.forEach((warning) => toast.warning(warning));
    },
    onError: (err: Error) => {
      toast.error('Failed to save integration preferences', { description: err.message });
    },
  });
}

/** Convert saved knowledge source refs to multi-select keys */
export function knowledgeRefsToKeys(refs: PrimaryKnowledgeSourceRef[]): string[] {
  return refs.map(knowledgeSourceRefKey);
}

/** Convert multi-select keys to knowledge source refs for save */
export function knowledgeKeysToRefs(keys: string[]): PrimaryKnowledgeSourceRef[] {
  return keysToKnowledgeSourceRefs(keys);
}
