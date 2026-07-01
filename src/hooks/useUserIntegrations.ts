/**
 * User Integration Hooks
 * Sprint 10: User Integration Connections
 * Handles individual user OAuth connections to external services
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface UserOAuthToken {
  id: string;
  user_id: string;
  provider_slug: string;
  // Sensitive fields (access_token, refresh_token) excluded from client queries
  token_type: string;
  expires_at: string | null;
  scopes: string[];
  account_email: string | null;
  account_name: string | null;
  account_id: string | null;
  account_avatar_url: string | null;
  is_active: boolean;
  last_used_at: string | null;
  last_refreshed_at: string | null;
  error_message: string | null;
  error_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// Non-sensitive columns to select (explicitly excludes access_token, refresh_token)
const SAFE_TOKEN_COLUMNS = `
  id,
  user_id,
  provider_slug,
  token_type,
  expires_at,
  scopes,
  account_email,
  account_name,
  account_id,
  account_avatar_url,
  is_active,
  last_used_at,
  last_refreshed_at,
  error_message,
  error_at,
  metadata,
  created_at,
  updated_at
`;

export type UserProviderConnectionMethod = 'oauth_redirect' | 'activecollab_issue_token';

export interface AvailableProvider {
  provider_slug: string;
  provider_name: string;
  description: string;
  icon: string;
  scopes: string[];
  /** True when the provider uses browser OAuth (not ActiveCollab issue-token). */
  oauth_enabled: boolean;
  connection_method: UserProviderConnectionMethod;
}

// Fetch user's connected services (excludes sensitive token fields)
export function useUserOAuthTokens() {
  const { user } = useAuth();

  return useQuery<UserOAuthToken[]>({
    queryKey: ['user-oauth-tokens', user?.id],
    queryFn: async (): Promise<UserOAuthToken[]> => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('user_oauth_tokens')
        .select(SAFE_TOKEN_COLUMNS)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as UserOAuthToken[];
    },
    enabled: !!user,
  });
}

// Fetch a specific provider connection (excludes sensitive token fields)
export function useUserOAuthToken(providerSlug: string) {
  const { user } = useAuth();

  return useQuery<UserOAuthToken | null>({
    queryKey: ['user-oauth-token', user?.id, providerSlug],
    queryFn: async (): Promise<UserOAuthToken | null> => {
      if (!user) return null;

      const { data, error } = await supabase
        .from('user_oauth_tokens')
        .select(SAFE_TOKEN_COLUMNS)
        .eq('user_id', user.id)
        .eq('provider_slug', providerSlug)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data as UserOAuthToken | null;
    },
    enabled: !!user && !!providerSlug,
  });
}

export interface ConnectActiveCollabTokenInput {
  base_url: string;
  client_name: string;
  client_vendor: string;
  username: string;
  password: string;
}

// Check if a provider is available for user connection (admin enabled it)
export function useAvailableUserProviders() {
  return useQuery<AvailableProvider[]>({
    queryKey: ['available-user-providers'],
    queryFn: async () => {
      const { data: orgIntegrations, error } = await supabase
        .from('organization_integrations')
        .select(`
          *,
          integration_providers (
            slug,
            name,
            description,
            oauth_config,
            auth_type
          )
        `)
        .eq('connection_status', 'connected');

      if (error) throw error;

      interface OrgIntegrationRow {
        enabled?: boolean | null;
        integration_providers: {
          slug: string;
          name: string;
          description: string | null;
          oauth_config: unknown;
          auth_type: string | null;
        } | null;
      }

      const oauthProviders: AvailableProvider[] = (orgIntegrations || [])
        .filter((raw) => {
          const oi = raw as OrgIntegrationRow;
          const provider = oi.integration_providers;
          if (!provider || oi.enabled === false) return false;
          if (provider.slug === 'activecollab') return false;
          const auth = (provider.auth_type ?? '').toLowerCase();
          return auth.startsWith('oauth') && provider.oauth_config != null;
        })
        .map((raw) => {
          const oi = raw as OrgIntegrationRow;
          const provider = oi.integration_providers!;
          const oauthCfg = (provider.oauth_config || {}) as { default_scopes?: string[] };
          return {
            provider_slug: provider.slug,
            provider_name: provider.name,
            description: provider.description ?? '',
            icon: '',
            scopes: oauthCfg.default_scopes ?? [],
            oauth_enabled: true,
            connection_method: 'oauth_redirect' as const,
          };
        });

      const { data: acRow, error: acError } = await supabase
        .from('integration_providers')
        .select('slug, name, description, is_available')
        .eq('slug', 'activecollab')
        .maybeSingle();

      if (acError) throw acError;

      const list: AvailableProvider[] = [...oauthProviders];
      if (acRow && acRow.is_available !== false) {
        list.push({
          provider_slug: acRow.slug,
          provider_name: acRow.name,
          description: acRow.description ?? '',
          icon: '',
          scopes: [],
          oauth_enabled: false,
          connection_method: 'activecollab_issue_token',
        });
      }

      return list;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Initiate OAuth connection for a provider
export function useConnectOAuth() {
  return useMutation({
    mutationFn: async ({ provider, redirect_uri }: { provider: string; redirect_uri?: string }) => {
      // Call edge function to get OAuth URL
      const body: { provider: string; redirect_uri?: string } = { provider };
      if (redirect_uri != null && redirect_uri !== '') body.redirect_uri = redirect_uri;
      const { data, error } = await supabase.functions.invoke('user-oauth-connect', {
        body,
      });

      if (error) throw error;

      // Redirect to OAuth URL
      if (data?.authorization_url) {
        window.location.href = data.authorization_url;
      }

      return data;
    },
    onError: (error: Error) => {
      toast.error(`Failed to connect: ${error.message}`);
    },
  });
}

/** ActiveCollab: POST issue-token with user email/password; stores API token server-side. */
export function useConnectActiveCollabToken() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: ConnectActiveCollabTokenInput): Promise<void> => {
      const { data, error } = await supabase.functions.invoke('activecollab-issue-token', {
        body: {
          base_url: input.base_url.trim(),
          client_name: input.client_name.trim(),
          client_vendor: input.client_vendor.trim(),
          username: input.username.trim(),
          password: input.password,
        },
      });
      if (error) throw error;
      const payload = data as { error?: string } | null;
      if (payload && typeof payload.error === 'string' && payload.error.length > 0) {
        throw new Error(payload.error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-oauth-tokens'] });
      queryClient.invalidateQueries({ queryKey: ['user-oauth-token', user?.id, 'activecollab'] });
      queryClient.invalidateQueries({ queryKey: ['available-user-providers'] });
      toast.success('ActiveCollab connected');
    },
    onError: (error: Error) => {
      toast.error(error.message ?? 'Failed to connect ActiveCollab');
    },
  });
}

// Disconnect a provider
export function useDisconnectOAuth() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ provider }: { provider: string }) => {
      if (!user) throw new Error('Not authenticated');

      // Call edge function to revoke and disconnect
      const { data, error } = await supabase.functions.invoke('user-oauth-disconnect', {
        body: { provider },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user-oauth-tokens'] });
      queryClient.invalidateQueries({ queryKey: ['user-oauth-token', user?.id, variables.provider] });
      // Invalidate available providers in case admin disabled this provider mid-session
      queryClient.invalidateQueries({ queryKey: ['available-user-providers'] });
      toast.success('Service disconnected successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to disconnect: ${error.message}`);
    },
  });
}

// Refresh an OAuth token
export function useRefreshOAuthToken() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ provider }: { provider: string }) => {
      const { data, error } = await supabase.functions.invoke('user-oauth-refresh', {
        body: { provider },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user-oauth-tokens'] });
      queryClient.invalidateQueries({ queryKey: ['user-oauth-token', user?.id, variables.provider] });
      // Invalidate available providers in case admin disabled this provider mid-session
      queryClient.invalidateQueries({ queryKey: ['available-user-providers'] });
      toast.success('Token refreshed successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to refresh token: ${error.message}`);
    },
  });
}

// Check if user has a valid (non-expired) token for a provider
// Google Drive files interface
export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime: string;
  webViewLink?: string;
  webContentLink?: string;
  thumbnailLink?: string;
}

export interface DriveListResponse {
  success: boolean;
  files: DriveFile[];
  folders: DriveFile[];
  total: number;
}

// Hook to list Google Drive files
export function useDriveFiles(folderId?: string) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['drive-files', user?.id, folderId],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated');
      
      const { data, error } = await supabase.functions.invoke('user-drive-list', {
        body: { folder_id: folderId },
      });

      if (error) throw error;
      return data as DriveListResponse;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

export function useHasValidToken(providerSlug: string) {
  const { data: token, isLoading } = useUserOAuthToken(providerSlug);

  const isValid =
    token?.is_active &&
    (!token.expires_at || new Date(token.expires_at) > new Date()) &&
    !token.error_message;

  return {
    hasValidToken: isValid,
    token,
    isLoading,
    isExpired: token?.expires_at && new Date(token.expires_at) <= new Date(),
    hasError: !!token?.error_message,
    errorMessage: token?.error_message,
  };
}
