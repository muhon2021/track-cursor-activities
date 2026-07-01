/**
 * OpenRouter integration service (Edge Functions).
 * Configuration read + API key validation only — no chat/routing/embeddings.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const OPENROUTER_PROVIDER_SLUG = 'openrouter';
export const OPENROUTER_API_BASE_URL = 'https://openrouter.ai/api/v1';
export const OPENROUTER_DEFAULT_MODEL = 'deepseek/deepseek-r1';
export const OPENROUTER_ENV_API_KEY = 'OPENROUTER_API_KEY';

export interface OpenRouterConfig {
  apiKey: string;
  defaultModel: string;
  source: 'integration_config' | 'env';
}

export interface OpenRouterValidationResult {
  valid: boolean;
  message: string;
  details?: Record<string, unknown>;
}

function readConfigString(config: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = config[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

/**
 * Validate an OpenRouter API key against the models endpoint.
 * Duplicate of validateOpenRouter() in validate-api-key/index.ts (kept in sync).
 */
export async function validateOpenRouterApiKey(apiKey: string): Promise<OpenRouterValidationResult> {
  const trimmed = apiKey.trim();
  if (!trimmed || trimmed === '__CONFIGURED__' || trimmed.startsWith('•')) {
    return {
      valid: false,
      message: 'OpenRouter API key is required',
      details: {},
    };
  }

  try {
    const response = await fetch(`${OPENROUTER_API_BASE_URL}/models`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${trimmed}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      const models = Array.isArray(data?.data) ? data.data : [];
      return {
        valid: true,
        message: 'OpenRouter API key is valid',
        details: { models_count: models.length },
      };
    }

    const errorData = await response.json().catch(() => ({}));
    const apiMessage =
      (errorData as { error?: { message?: string } })?.error?.message ||
      (errorData as { message?: string })?.message;

    if (response.status === 401 || response.status === 403) {
      return {
        valid: false,
        message: apiMessage || 'Invalid OpenRouter API key',
        details: { status: response.status },
      };
    }

    return {
      valid: false,
      message: apiMessage || `OpenRouter validation failed (${response.status})`,
      details: { status: response.status },
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      valid: false,
      message: `OpenRouter validation error: ${message}`,
      details: {},
    };
  }
}

async function decryptIntegrationConfig(
  supabaseUrl: string,
  serviceKey: string,
  providerId: string,
  config: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const response = await fetch(`${supabaseUrl}/functions/v1/integration-config`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'decrypt_internal',
      provider_id: providerId,
      config,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      (payload as { message?: string })?.message ||
      (payload as { error?: string })?.error ||
      'Failed to decrypt OpenRouter configuration';
    throw new Error(message);
  }

  return ((payload as { config?: Record<string, unknown> })?.config ?? config) as Record<
    string,
    unknown
  >;
}

/**
 * Resolve OpenRouter credentials for a user (integration config first, then env).
 * Decrypts sensitive fields via integration-config when stored encrypted.
 */
export async function resolveOpenRouterConfig(
  supabase: SupabaseClient,
  userId: string,
): Promise<OpenRouterConfig | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim() ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() ?? '';

  const { data: provider } = await supabase
    .from('integration_providers')
    .select('id')
    .eq('slug', OPENROUTER_PROVIDER_SLUG)
    .maybeSingle();

  if (provider?.id) {
    const { data: orgIntegration } = await supabase
      .from('organization_integrations')
      .select('config, connection_status, enabled')
      .eq('provider_id', provider.id)
      .eq('user_id', userId)
      .eq('enabled', true)
      .eq('connection_status', 'connected')
      .maybeSingle();

    const rawConfig = (orgIntegration?.config ?? {}) as Record<string, unknown>;
    if (Object.keys(rawConfig).length > 0 && supabaseUrl && serviceKey) {
      let config = rawConfig;
      try {
        config = await decryptIntegrationConfig(supabaseUrl, serviceKey, provider.id, rawConfig);
      } catch (error) {
        console.warn('[openrouter] decrypt failed, using raw config keys:', error);
      }

      const apiKey = readConfigString(config, ['api_key', 'apiKey', 'openrouter_api_key']);
      const defaultModel =
        readConfigString(config, ['default_model', 'defaultModel']) || OPENROUTER_DEFAULT_MODEL;

      if (apiKey) {
        return { apiKey, defaultModel, source: 'integration_config' };
      }
    }
  }

  const envKey = Deno.env.get(OPENROUTER_ENV_API_KEY)?.trim() ?? '';
  if (envKey) {
    return {
      apiKey: envKey,
      defaultModel: OPENROUTER_DEFAULT_MODEL,
      source: 'env',
    };
  }

  return null;
}

/** Non-secret metadata exposed to future AI modules (no API key). */
export function extractOpenRouterPublicConfig(
  config: Record<string, unknown> | null | undefined,
): { defaultModel: string; hasApiKeyConfigured: boolean } {
  const defaultModel =
    readConfigString(config ?? {}, ['default_model', 'defaultModel']) || OPENROUTER_DEFAULT_MODEL;
  const apiKey = readConfigString(config ?? {}, ['api_key', 'apiKey', 'openrouter_api_key']);
  const hasApiKeyConfigured =
    apiKey.length > 0 && apiKey !== '__CONFIGURED__' && !apiKey.startsWith('v1:');

  return {
    defaultModel,
    hasApiKeyConfigured: hasApiKeyConfigured || apiKey.startsWith('v1:') || apiKey === '__CONFIGURED__',
  };
}
