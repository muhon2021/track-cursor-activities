/**
 * OpenRouter integration helpers (client-safe).
 * API keys are encrypted server-side; this module exposes types and non-secret metadata only.
 */

import type { OrganizationIntegration } from '@/lib/integration-utils';
import { CONFIGURED_CREDENTIAL_PLACEHOLDER } from '@/lib/integration-utils';

export const OPENROUTER_INTEGRATION_SLUG = 'openrouter';
export const OPENROUTER_DEFAULT_MODEL = 'deepseek/deepseek-r1';
export const OPENROUTER_DOCS_URL = 'https://openrouter.ai/docs';

export interface OpenRouterPublicConfig {
  defaultModel: string;
  isConnected: boolean;
  lastUpdated: string | null;
}

export function isOpenRouterConnected(
  orgIntegration?: OrganizationIntegration | null,
): boolean {
  return orgIntegration?.connection_status === 'connected' && orgIntegration.enabled !== false;
}

/** Read non-sensitive OpenRouter settings from masked integration config. */
export function getOpenRouterPublicConfig(
  orgIntegration?: OrganizationIntegration | null,
): OpenRouterPublicConfig {
  const config = (orgIntegration?.config ?? {}) as Record<string, string>;
  const defaultModel =
    config.default_model?.trim() || config.defaultModel?.trim() || OPENROUTER_DEFAULT_MODEL;

  const apiKey = config.api_key ?? config.apiKey ?? '';
  const hasConfiguredKey =
    apiKey === CONFIGURED_CREDENTIAL_PLACEHOLDER || Boolean(apiKey?.trim());

  return {
    defaultModel,
    isConnected: isOpenRouterConnected(orgIntegration) && hasConfiguredKey,
    lastUpdated: orgIntegration?.updated_at ?? orgIntegration?.last_tested_at ?? null,
  };
}
