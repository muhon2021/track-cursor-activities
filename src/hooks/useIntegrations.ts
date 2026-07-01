/**
 * Integration Hub Hooks
 * React Query hooks for integration management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  IntegrationCategory,
  IntegrationProvider,
  IntegrationField,
  OrganizationIntegration,
  IntegrationService,
  IntegrationUsageLog,
  sortCategoriesByOrder,
  sortProvidersByOrder,
} from '@/lib/integration-utils';

// ============================================
// QUERY KEYS
// ============================================
export const integrationKeys = {
  all: ['integrations'] as const,
  categories: () => [...integrationKeys.all, 'categories'] as const,
  providers: () => [...integrationKeys.all, 'providers'] as const,
  providersByCategory: (categoryId: string) =>
    [...integrationKeys.providers(), categoryId] as const,
  provider: (slug: string) => [...integrationKeys.providers(), slug] as const,
  fields: (providerId: string) => [...integrationKeys.all, 'fields', providerId] as const,
  orgIntegrations: () => [...integrationKeys.all, 'org-integrations'] as const,
  orgIntegration: (providerId: string) =>
    [...integrationKeys.orgIntegrations(), providerId] as const,
  services: (providerId: string) => [...integrationKeys.all, 'services', providerId] as const,
  usageLogs: (filters?: any) => [...integrationKeys.all, 'usage-logs', filters] as const,
};

// ============================================
// CATEGORIES
// ============================================

/**
 * Fetch all integration categories
 */
export function useIntegrationCategories() {
  return useQuery({
    queryKey: integrationKeys.categories(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('integration_categories')
        .select('*')
        .eq('enabled', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return sortCategoriesByOrder(data as IntegrationCategory[]);
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// ============================================
// PROVIDERS
// ============================================

/**
 * Fetch all integration providers
 */
export function useIntegrationProviders(categoryId?: string) {
  return useQuery({
    queryKey: categoryId
      ? integrationKeys.providersByCategory(categoryId)
      : integrationKeys.providers(),
    queryFn: async () => {
      let query = supabase
        .from('integration_providers')
        .select('*')
        .order('display_order', { ascending: true });

      if (categoryId) {
        query = query.eq('category_id', categoryId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return sortProvidersByOrder(data as IntegrationProvider[]);
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Fetch a single provider by slug
 */
export function useIntegrationProvider(slug: string) {
  return useQuery({
    queryKey: integrationKeys.provider(slug),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('integration_providers')
        .select('*')
        .eq('slug', slug)
        .single();

      if (error) throw error;
      return data as IntegrationProvider;
    },
    staleTime: 10 * 60 * 1000,
    enabled: !!slug,
  });
}

// ============================================
// FIELDS
// ============================================

/**
 * Fetch integration fields for a provider
 */
export function useIntegrationFields(providerId: string) {
  return useQuery({
    queryKey: integrationKeys.fields(providerId),
    queryFn: async (): Promise<IntegrationField[]> => {
      const { data, error } = await supabase
        .from('integration_fields')
        .select('*')
        .eq('provider_id', providerId)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data as IntegrationField[];
    },
    staleTime: 10 * 60 * 1000,
    enabled: !!providerId,
  });
}

// ============================================
// ORGANIZATION INTEGRATIONS
// ============================================

/**
 * Fetch all organization integrations with provider details
 */
export function useOrganizationIntegrations() {
  return useQuery({
    queryKey: integrationKeys.orgIntegrations(),
    queryFn: async (): Promise<(OrganizationIntegration & { provider: IntegrationProvider })[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('organization_integrations')
        .select(`
          *,
          provider:integration_providers(*)
        `)
        .eq('user_id', user.id);

      if (error) throw error;
      return data as (OrganizationIntegration & { provider: IntegrationProvider })[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetch organization integration for a specific provider (masked sensitive credentials)
 */
export function useOrganizationIntegration(providerId: string) {
  return useQuery({
    queryKey: integrationKeys.orgIntegration(providerId),
    queryFn: async (): Promise<{
      integration: OrganizationIntegration | null;
      configured_sensitive_fields: string[];
    }> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('integration-config', {
        body: {
          action: 'get',
          provider_id: providerId,
        },
      });

      if (error) throw error;
      const payload = data as {
        integration: OrganizationIntegration | null;
        configured_sensitive_fields?: string[];
      };

      return {
        integration: payload.integration,
        configured_sensitive_fields: payload.configured_sensitive_fields ?? [],
      };
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!providerId,
  });
}

/**
 * Save or update integration configuration (encrypts sensitive fields server-side)
 */
export function useUpdateIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      providerId,
      config,
      enabled = true,
    }: {
      providerId: string;
      config: Record<string, any>;
      enabled?: boolean;
    }): Promise<{
      integration: OrganizationIntegration;
      configured_sensitive_fields: string[];
    }> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('integration-config', {
        body: {
          provider_id: providerId,
          config,
          enabled,
        },
      });

      if (error) throw error;
      const payload = data as {
        integration: OrganizationIntegration;
        configured_sensitive_fields?: string[];
        error?: string;
        message?: string;
      };

      if (payload?.error) {
        throw new Error(payload.message || payload.error);
      }

      return {
        integration: payload.integration,
        configured_sensitive_fields: payload.configured_sensitive_fields ?? [],
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: integrationKeys.orgIntegrations() });
      queryClient.invalidateQueries({
        queryKey: integrationKeys.orgIntegration(data.integration.provider_id),
      });
    },
  });
}

/**
 * Test integration connection
 */
export function useTestConnection() {
  return useMutation({
    mutationFn: async ({
      providerSlug,
      providerId,
      credentials,
    }: {
      providerSlug: string;
      providerId?: string;
      credentials: Record<string, any>;
    }) => {
      // Call the validate-api-key edge function
      const { data, error } = await supabase.functions.invoke('validate-api-key', {
        body: {
          provider: providerSlug,
          provider_id: providerId,
          credentials,
        },
      });

      if (error) throw error;
      return data as { valid: boolean; message: string; details?: Record<string, any> };
    },
  });
}

/**
 * Disconnect integration
 */
export function useDisconnectIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ providerId }: { providerId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('organization_integrations')
        .delete()
        .eq('user_id', user.id)
        .eq('provider_id', providerId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: integrationKeys.orgIntegrations() });
      queryClient.invalidateQueries({
        queryKey: integrationKeys.orgIntegration(variables.providerId),
      });
    },
  });
}

// ============================================
// SERVICES
// ============================================

/**
 * Fetch services for a provider
 */
export function useIntegrationServices(providerId: string) {
  return useQuery({
    queryKey: integrationKeys.services(providerId),
    queryFn: async (): Promise<IntegrationService[]> => {
      const { data, error } = await supabase
        .from('integration_services')
        .select('*')
        .eq('provider_id', providerId)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data as IntegrationService[];
    },
    staleTime: 10 * 60 * 1000,
    enabled: !!providerId,
  });
}

/**
 * Toggle service enable/disable
 */
export function useToggleService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      serviceId,
      enabled,
    }: {
      serviceId: string;
      enabled: boolean;
    }): Promise<IntegrationService> => {
      const { data, error } = await supabase
        .from('integration_services')
        .update({ enabled })
        .eq('id', serviceId)
        .select()
        .single();

      if (error) throw error;
      return data as IntegrationService;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: integrationKeys.services(data.provider_id),
      });
    },
  });
}

/**
 * Set default service
 */
export function useSetDefaultService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      providerId,
      serviceId,
    }: {
      providerId: string;
      serviceId: string;
    }): Promise<IntegrationService> => {
      // First, unset all defaults for this provider
      await supabase
        .from('integration_services')
        .update({ is_default: false })
        .eq('provider_id', providerId);

      // Then set the new default
      const { data, error } = await supabase
        .from('integration_services')
        .update({ is_default: true })
        .eq('id', serviceId)
        .select()
        .single();

      if (error) throw error;
      return data as IntegrationService;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: integrationKeys.services(data.provider_id),
      });
    },
  });
}

// ============================================
// USAGE LOGS
// ============================================

interface UsageLogsFilters {
  providerId?: string;
  categoryId?: string;
  dateRange?: string;
  startDate?: Date;
  endDate?: Date;
  status?: 'success' | 'error' | 'partial';
  limit?: number;
}

/**
 * Fetch integration usage logs
 */
export function useIntegrationUsageLogs(filters: UsageLogsFilters = {}) {
  return useQuery({
    queryKey: integrationKeys.usageLogs(filters),
    queryFn: async (): Promise<(IntegrationUsageLog & {
      provider: { name: string; slug: string };
      service: { name: string; service_key: string };
      user: { email: string };
    })[]> => {
      let query = supabase
        .from('integration_usage_logs')
        .select(`
          *,
          provider:integration_providers(name, slug),
          service:integration_services(name, service_key),
          user:profiles(email)
        `)
        .order('created_at', { ascending: false })
        .limit(filters.limit || 100);

      if (filters.providerId) {
        query = query.eq('provider_id', filters.providerId);
      }

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.startDate) {
        query = query.gte('created_at', filters.startDate.toISOString());
      }

      if (filters.endDate) {
        query = query.lte('created_at', filters.endDate.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as any;
    },
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

/**
 * Get usage statistics for a provider
 */
export function useProviderUsageStats(providerId: string, days: number = 30) {
  return useQuery({
    queryKey: [...integrationKeys.usageLogs({ providerId }), 'stats', days],
    queryFn: async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from('integration_usage_logs')
        .select('status, estimated_cost')
        .eq('provider_id', providerId)
        .gte('created_at', startDate.toISOString());

      if (error) throw error;

      const totalCalls = data?.length || 0;
      const successfulCalls = data?.filter(d => d.status === 'success').length || 0;
      const failedCalls = data?.filter(d => d.status === 'error').length || 0;
      const totalCost = data?.reduce((sum, d) => sum + (d.estimated_cost || 0), 0) || 0;

      return {
        totalCalls,
        successfulCalls,
        failedCalls,
        totalCost,
        successRate: totalCalls > 0 ? (successfulCalls / totalCalls) * 100 : 0,
      };
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!providerId,
  });
}

// ============================================
// GROUPED DATA
// ============================================

interface GroupedProviders {
  category: IntegrationCategory;
  providers: (IntegrationProvider & { orgIntegration?: OrganizationIntegration })[];
  stats: {
    totalProviders: number;
    connectedProviders: number;
  };
}

/**
 * Get all providers grouped by category with connection status
 */
/**
 * Send a test email via Microsoft Graph (Integration Hub Outlook user_oauth_tokens).
 */
export function useSendOutlookTestEmail() {
  return useMutation({
    mutationFn: async (recipient_email?: string) => {
      const { data, error } = await supabase.functions.invoke('outlook-send-test-email', {
        body: recipient_email ? { recipient_email } : {},
      });
      if (error) throw error;
      const payload = data as { error?: string; success?: boolean; to?: string };
      if (payload?.error) throw new Error(payload.error);
      return payload;
    },
  });
}

export function useProvidersGroupedByCategory() {
  const categoriesQuery = useIntegrationCategories();
  const providersQuery = useIntegrationProviders();
  const orgIntegrationsQuery = useOrganizationIntegrations();

  const isLoading =
    categoriesQuery.isLoading || providersQuery.isLoading || orgIntegrationsQuery.isLoading;
  const error = categoriesQuery.error || providersQuery.error || orgIntegrationsQuery.error;

  const grouped: GroupedProviders[] | undefined = categoriesQuery.data?.map((category) => {
    let categoryProviders =
      providersQuery.data?.filter((p) => p.category_id === category.id) || [];

    // CRM hub: hide placeholder providers (Coming Soon + not available) so only actionable CRMs show (e.g. Zoho).
    if (category.slug === 'crm-systems') {
      categoryProviders = categoryProviders.filter(
        (p) => p.is_available === true || p.is_coming_soon !== true
      );
    }

    // Attach org integration to each provider
    const providersWithIntegration = categoryProviders.map((provider) => ({
      ...provider,
      orgIntegration: orgIntegrationsQuery.data?.find((i) => i.provider_id === provider.id),
    }));

    const connectedProviders = providersWithIntegration.filter(
      (p) => p.orgIntegration?.connection_status === 'connected'
    ).length;

    return {
      category,
      providers: providersWithIntegration,
      stats: {
        totalProviders: providersWithIntegration.length,
        connectedProviders,
      },
    };
  });

  return {
    grouped,
    isLoading,
    error,
  };
}
