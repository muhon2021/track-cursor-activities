/**
 * Auth Configuration Hook
 * Fetches dynamic authentication settings for login page
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Helper to query tables not yet in generated Supabase types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const untypedFrom = (table: string) =>
  (supabase as any).from(table);

export interface SSOProvider {
  id: string;
  provider_type: 'google_workspace' | 'azure_ad' | 'saml' | 'oidc' | 'okta';
  display_name: string;
  is_primary: boolean;
  is_enabled: boolean;
  client_id?: string;
  tenant_id?: string;
  domain_restrictions?: string[];
  auto_provision_role?: string;
  auto_create_users?: boolean;
  metadata?: Record<string, any>;
}

export interface AuthConfig {
  allowEmailPassword: boolean;
  allowPublicSignup: boolean;
  requireSSO: boolean;
  defaultSSOProvider: string | null;
  sessionTimeoutHours: number;
  ssoProviders: SSOProvider[];
}

export interface SSODomain {
  id: string;
  domain: string;
  sso_config_id: string;
  is_active: boolean;
}

// Fetch auth configuration for login page
export function useAuthConfig() {
  return useQuery<AuthConfig>({
    queryKey: ['auth-config'],
    queryFn: async (): Promise<AuthConfig> => {
      // Fetch app_config entries
      const { data: configs, error: configError } = await supabase
        .from('app_config')
        .select('key, value')
        .like('key', 'auth.%');

      if (configError) {
        console.error('Error fetching auth config:', configError);
      }

      const configMap = new Map(
        configs?.map((c) => [c.key.replace('auth.', ''), c.value as unknown]) || []
      );

      // SSO providers would be fetched if table exists - for now return empty
      // This will work once sso_configurations table is properly typed
      const ssoProviders: SSOProvider[] = [];

      const defaultProvider = configMap.get('default_sso_provider');

      return {
        allowEmailPassword: configMap.get('allow_email_password') !== 'false',
        allowPublicSignup: configMap.get('allow_public_signup') !== 'false',
        requireSSO: configMap.get('require_sso') === 'true',
        defaultSSOProvider: typeof defaultProvider === 'string' ? defaultProvider : null,
        sessionTimeoutHours: parseInt(String(configMap.get('session_timeout_hours') || '24'), 10),
        ssoProviders,
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Fetch all SSO configurations (admin only)
// Note: sso_configurations table created via migration, using any for now
export function useSSOConfigurations() {
  return useQuery<SSOProvider[]>({
    queryKey: ['sso-configurations'],
    queryFn: async (): Promise<SSOProvider[]> => {
      // Use raw query since table not in generated types yet
      const { data, error } = await untypedFrom('sso_configurations')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as SSOProvider[];
    },
  });
}

// Fetch single SSO configuration
export function useSSOConfiguration(providerType: string) {
  return useQuery<SSOProvider | null>({
    queryKey: ['sso-configuration', providerType],
    queryFn: async (): Promise<SSOProvider | null> => {
      const { data, error } = await untypedFrom('sso_configurations')
        .select('*')
        .eq('provider_type', providerType)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data as SSOProvider | null;
    },
    enabled: !!providerType,
  });
}

// Create or update SSO configuration
export function useUpsertSSOConfiguration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (config: Partial<SSOProvider> & { provider_type: string }) => {
      const { data, error } = await untypedFrom('sso_configurations')
        .upsert(config, { onConflict: 'provider_type' })
        .select()
        .single();

      if (error) throw error;
      return data as SSOProvider;
    },
    onSuccess: (data: SSOProvider) => {
      queryClient.invalidateQueries({ queryKey: ['sso-configurations'] });
      queryClient.invalidateQueries({ queryKey: ['sso-configuration', data.provider_type] });
      queryClient.invalidateQueries({ queryKey: ['auth-config'] });
      toast.success('SSO configuration saved');
    },
    onError: (error: Error) => {
      toast.error(`Failed to save SSO configuration: ${error.message}`);
    },
  });
}

// Delete SSO configuration
export function useDeleteSSOConfiguration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (providerType: string) => {
      const { error } = await untypedFrom('sso_configurations')
        .delete()
        .eq('provider_type', providerType);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sso-configurations'] });
      queryClient.invalidateQueries({ queryKey: ['auth-config'] });
      toast.success('SSO configuration deleted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete SSO configuration: ${error.message}`);
    },
  });
}

// Fetch domain allowlist for a configuration
export function useSSODomains(configId: string) {
  return useQuery<SSODomain[]>({
    queryKey: ['sso-domains', configId],
    queryFn: async (): Promise<SSODomain[]> => {
      const { data, error } = await untypedFrom('sso_domain_allowlist')
        .select('*')
        .eq('sso_config_id', configId)
        .order('domain', { ascending: true });

      if (error) throw error;
      return (data || []) as SSODomain[];
    },
    enabled: !!configId,
  });
}

// Add domain to allowlist
export function useAddSSODomain() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ configId, domain }: { configId: string; domain: string }) => {
      const { data, error } = await untypedFrom('sso_domain_allowlist')
        .insert({ sso_config_id: configId, domain: domain.toLowerCase() })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sso-domains', variables.configId] });
      toast.success('Domain added to allowlist');
    },
    onError: (error: Error) => {
      toast.error(`Failed to add domain: ${error.message}`);
    },
  });
}

// Remove domain from allowlist
export function useRemoveSSODomain() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ domainId, configId }: { domainId: string; configId: string }) => {
      const { error } = await untypedFrom('sso_domain_allowlist')
        .delete()
        .eq('id', domainId);

      if (error) throw error;
      return configId;
    },
    onSuccess: (configId) => {
      queryClient.invalidateQueries({ queryKey: ['sso-domains', configId] });
      toast.success('Domain removed from allowlist');
    },
    onError: (error: Error) => {
      toast.error(`Failed to remove domain: ${error.message}`);
    },
  });
}

// Update auth configuration
export function useUpdateAuthConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (config: Partial<{
      allowEmailPassword: boolean;
      allowPublicSignup: boolean;
      requireSSO: boolean;
      defaultSSOProvider: string | null;
      sessionTimeoutHours: number;
    }>) => {
      const updates = [];

      if (config.allowEmailPassword !== undefined) {
        updates.push({
          key: 'auth.allow_email_password',
          value: String(config.allowEmailPassword),
          category: 'auth',
        });
      }
      if (config.allowPublicSignup !== undefined) {
        updates.push({
          key: 'auth.allow_public_signup',
          value: String(config.allowPublicSignup),
          category: 'auth',
        });
      }
      if (config.requireSSO !== undefined) {
        updates.push({
          key: 'auth.require_sso',
          value: String(config.requireSSO),
          category: 'auth',
        });
      }
      if (config.defaultSSOProvider !== undefined) {
        updates.push({
          key: 'auth.default_sso_provider',
          value: config.defaultSSOProvider || 'null',
          category: 'auth',
        });
      }
      if (config.sessionTimeoutHours !== undefined) {
        updates.push({
          key: 'auth.session_timeout_hours',
          value: String(config.sessionTimeoutHours),
          category: 'auth',
        });
      }

      for (const update of updates) {
        const { error } = await supabase
          .from('app_config')
          .upsert(update, { onConflict: 'key' });

        if (error) throw error;
      }

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth-config'] });
      toast.success('Authentication settings updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update settings: ${error.message}`);
    },
  });
}
