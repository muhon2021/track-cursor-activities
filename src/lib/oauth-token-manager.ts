/**
 * OAuth Token Manager
 * Handles OAuth token refresh and validation
 * NOTE: These are placeholder implementations - tables don't exist yet
 */

import { supabase } from '@/integrations/supabase/client';

export interface OAuthTokens {
  access_token: string;
  refresh_token: string | null;
  token_type: string;
  expires_at: string | null;
  scope: string | null;
}

/**
 * Check if OAuth access token is expired or about to expire
 * @param expiresAt - ISO timestamp of token expiration
 * @param bufferMinutes - Minutes before expiration to consider token expired (default: 5)
 */
export function isTokenExpired(expiresAt: string | null, bufferMinutes = 5): boolean {
  if (!expiresAt) {
    // If no expiration time, assume token doesn't expire
    return false;
  }

  const expirationTime = new Date(expiresAt).getTime();
  const bufferTime = bufferMinutes * 60 * 1000; // Convert minutes to milliseconds
  const now = Date.now();

  return now >= (expirationTime - bufferTime);
}

/**
 * Refresh OAuth access token using refresh token
 * @param providerId - Provider ID
 * @param refreshToken - Refresh token
 */
export async function refreshOAuthToken(
  providerId: string,
  refreshToken: string
): Promise<{ success: boolean; tokens?: OAuthTokens; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('oauth-refresh-token', {
      body: {
        providerId,
        refreshToken,
      },
    });

    if (error) {
      console.error('Token refresh error:', error);
      return {
        success: false,
        error: error.message || 'Failed to refresh token',
      };
    }

    if (!data?.success) {
      return {
        success: false,
        error: data?.message || 'Token refresh failed',
      };
    }

    return {
      success: true,
      tokens: data.tokens,
    };
  } catch (error) {
    console.error('Unexpected token refresh error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get valid OAuth access token, refreshing if necessary
 * NOTE: Placeholder - organization_integrations table doesn't exist yet
 * @param orgIntegrationId - Organization integration ID
 */
export async function getValidAccessToken(
  orgIntegrationId: string
): Promise<{ success: boolean; accessToken?: string; error?: string }> {
  // Placeholder implementation - table doesn't exist
  console.warn('getValidAccessToken: organization_integrations table not configured');
  return {
    success: false,
    error: 'Integration tables not configured. Please run migrations first.',
  };
}

/**
 * Revoke OAuth access (disconnect)
 * Some providers support token revocation endpoints
 * @param providerId - Provider ID
 * @param accessToken - Access token to revoke
 */
export async function revokeOAuthToken(
  providerId: string,
  accessToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('oauth-revoke-token', {
      body: {
        providerId,
        accessToken,
      },
    });

    if (error) {
      console.error('Token revocation error:', error);
      return {
        success: false,
        error: error.message || 'Failed to revoke token',
      };
    }

    return {
      success: data?.success ?? true,
      error: data?.error,
    };
  } catch (error) {
    console.error('Unexpected token revocation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Build authorization header for OAuth API requests
 * @param accessToken - Access token
 * @param tokenType - Token type (default: Bearer)
 */
export function buildAuthorizationHeader(
  accessToken: string,
  tokenType: string = 'Bearer'
): string {
  return `${tokenType} ${accessToken}`;
}

/**
 * Check if integration has valid OAuth configuration
 * @param tokens - OAuth tokens object
 */
export function hasValidOAuthConfig(tokens: OAuthTokens | null): boolean {
  return !!(tokens && tokens.access_token);
}
