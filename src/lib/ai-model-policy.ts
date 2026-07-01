/**
 * Org-wide AI model policy for agent chat — types, validation, and data access.
 */

import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export type IntegrationSettingsRow =
  Database['public']['Tables']['integration_settings']['Row'];

export type ModelSelectionMode = 'admin_locked' | 'user_choice';
export type UserVisibleModels = 'all_enabled' | 'default_only';

export interface AIModelPolicy {
  selection_mode: ModelSelectionMode;
  default_chat_model_id: string | null;
  default_provider_slug: string | null;
  user_visible_models: UserVisibleModels;
}

export const AI_INTEGRATION_SLUGS = [
  'openai',
  'anthropic',
  'google-gemini',
  'perplexity',
  'openrouter',
] as const;

export const INTEGRATION_TO_AI_PROVIDER_SLUG: Record<string, string> = {
  openai: 'openai',
  anthropic: 'anthropic',
  'google-gemini': 'google',
  perplexity: 'perplexity',
  openrouter: 'openrouter',
};

export const DEFAULT_AI_MODEL_POLICY: AIModelPolicy = {
  selection_mode: 'user_choice',
  default_chat_model_id: null,
  default_provider_slug: null,
  user_visible_models: 'all_enabled',
};

export const AGENT_CHAT_MODEL_STORAGE_KEY = 'agent-chat-model:v1';

export interface SelectableChatModel {
  id: string;
  name: string;
  model_id: string;
  is_default: boolean;
  provider_id: string;
  provider_name: string;
  provider_slug: string;
}

export function integrationSlugToAIProviderSlug(slug: string): string {
  return INTEGRATION_TO_AI_PROVIDER_SLUG[slug] ?? slug;
}

export function integrationSlugFromAIProviderSlug(aiSlug: string): string {
  const entry = Object.entries(INTEGRATION_TO_AI_PROVIDER_SLUG).find(([, v]) => v === aiSlug);
  return entry?.[0] ?? aiSlug;
}

export function normalizeAIModelPolicy(raw: unknown): AIModelPolicy {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_AI_MODEL_POLICY };
  }

  const obj = raw as Record<string, unknown>;
  const selection_mode =
    obj.selection_mode === 'admin_locked' ? 'admin_locked' : 'user_choice';
  const user_visible_models =
    obj.user_visible_models === 'default_only' ? 'default_only' : 'all_enabled';
  const default_chat_model_id =
    typeof obj.default_chat_model_id === 'string' && obj.default_chat_model_id.length > 0
      ? obj.default_chat_model_id
      : null;
  const default_provider_slug =
    typeof obj.default_provider_slug === 'string' && obj.default_provider_slug.length > 0
      ? obj.default_provider_slug
      : null;

  return { selection_mode, default_chat_model_id, default_provider_slug, user_visible_models };
}

async function fetchGlobalSettingsRow(): Promise<IntegrationSettingsRow | null> {
  const { data, error } = await supabase
    .from('integration_settings')
    .select('*')
    .is('organization_id', null)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getAIModelPolicy(): Promise<AIModelPolicy> {
  const row = await fetchGlobalSettingsRow();
  return normalizeAIModelPolicy(row?.ai_model_policy);
}

export async function getConnectedAIIntegrationSlugs(): Promise<Set<string>> {
  const { data: orgIntegrations, error: orgError } = await supabase
    .from('organization_integrations')
    .select('connection_status, enabled, provider:integration_providers(slug)')
    .eq('connection_status', 'connected')
    .eq('enabled', true);

  if (orgError) throw orgError;

  const connectedIntegrationSlugs = new Set<string>();
  for (const row of orgIntegrations ?? []) {
    const slug = (row.provider as { slug?: string } | null)?.slug;
    if (slug && (AI_INTEGRATION_SLUGS as readonly string[]).includes(slug)) {
      connectedIntegrationSlugs.add(slug);
    }
  }
  return connectedIntegrationSlugs;
}

export async function getConnectedAIProviderIds(): Promise<Set<string>> {
  const connectedIntegrationSlugs = await getConnectedAIIntegrationSlugs();
  if (connectedIntegrationSlugs.size === 0) return new Set();

  const aiSlugs = [...connectedIntegrationSlugs].map(integrationSlugToAIProviderSlug);
  if (aiSlugs.length === 0) return new Set();

  const { data: providers, error: provError } = await supabase
    .from('ai_providers')
    .select('id')
    .in('slug', aiSlugs);

  if (provError) throw provError;
  return new Set((providers ?? []).map((p) => p.id));
}

export async function fetchSelectableChatModels(): Promise<SelectableChatModel[]> {
  const connectedProviderIds = await getConnectedAIProviderIds();
  if (connectedProviderIds.size === 0) return [];

  const { data, error } = await supabase
    .from('ai_models')
    .select('id, name, model_id, is_default, provider_id, ai_providers(name, slug)')
    .eq('category', 'chat')
    .eq('enabled', true)
    .order('is_default', { ascending: false })
    .order('name');

  if (error) throw error;

  return (data ?? [])
    .filter((m) => connectedProviderIds.has(m.provider_id))
    .map((m) => {
      const provider = m.ai_providers as { name: string; slug: string } | null;
      return {
        id: m.id,
        name: m.name,
        model_id: m.model_id,
        is_default: m.is_default,
        provider_id: m.provider_id,
        provider_name: provider?.name ?? 'Unknown',
        provider_slug: provider?.slug ?? '',
      };
    });
}

export async function setGlobalDefaultChatModel(modelId: string): Promise<void> {
  const { error: unsetError } = await supabase
    .from('ai_models')
    .update({ is_default: false })
    .eq('category', 'chat');

  if (unsetError) throw unsetError;

  const { error: setError } = await supabase
    .from('ai_models')
    .update({ is_default: true })
    .eq('id', modelId);

  if (setError) throw setError;
}

export function sanitizeAIModelPolicy(
  input: AIModelPolicy,
  selectableModels: SelectableChatModel[],
  connectedIntegrationSlugs: Iterable<string> = []
): { policy: AIModelPolicy; warnings: string[] } {
  const warnings: string[] = [];
  const selectableIds = new Set(selectableModels.map((m) => m.id));

  let default_chat_model_id = input.default_chat_model_id;
  if (default_chat_model_id && !selectableIds.has(default_chat_model_id)) {
    warnings.push('Selected default model is not available from a connected provider.');
    const providerScopedModels = input.default_provider_slug
      ? selectableModels.filter(
          (m) =>
            integrationSlugFromAIProviderSlug(m.provider_slug) === input.default_provider_slug
        )
      : selectableModels;
    const fallback =
      providerScopedModels.find((m) => m.is_default) ?? providerScopedModels[0] ?? null;
    default_chat_model_id = fallback?.id ?? null;
  }

  if (!default_chat_model_id && input.default_provider_slug) {
    const providerModels = selectableModels.filter(
      (m) =>
        integrationSlugFromAIProviderSlug(m.provider_slug) === input.default_provider_slug
    );
    default_chat_model_id =
      providerModels.find((m) => m.is_default)?.id ?? providerModels[0]?.id ?? null;
    if (!default_chat_model_id) {
      warnings.push(
        `No chat models are enabled for ${input.default_provider_slug.replace(/-/g, ' ')} yet. Sync or add models in AI Models admin.`
      );
    }
  } else if (!default_chat_model_id && selectableModels.length > 0 && !input.default_provider_slug) {
    const fallback =
      selectableModels.find((m) => m.is_default) ?? selectableModels[0];
    default_chat_model_id = fallback.id;
  }

  const selection_mode =
    input.selection_mode === 'admin_locked' ? 'admin_locked' : 'user_choice';
  const user_visible_models =
    input.user_visible_models === 'default_only' ? 'default_only' : 'all_enabled';

  const connectedSlugs = new Set<string>();
  for (const slug of connectedIntegrationSlugs) {
    connectedSlugs.add(slug);
  }
  for (const model of selectableModels) {
    connectedSlugs.add(integrationSlugFromAIProviderSlug(model.provider_slug));
  }
  let default_provider_slug = input.default_provider_slug;
  if (
    default_provider_slug &&
    connectedSlugs.size > 0 &&
    !connectedSlugs.has(default_provider_slug)
  ) {
    warnings.push('Default AI provider is not connected.');
    default_provider_slug = null;
  }

  if (default_provider_slug && default_chat_model_id) {
    const model = selectableModels.find((m) => m.id === default_chat_model_id);
    const modelIntegrationSlug = model
      ? integrationSlugFromAIProviderSlug(model.provider_slug)
      : null;
    if (modelIntegrationSlug && modelIntegrationSlug !== default_provider_slug) {
      warnings.push('Default model does not belong to the default AI provider.');
    }
  }

  return {
    policy: {
      selection_mode,
      default_chat_model_id,
      default_provider_slug,
      user_visible_models,
    },
    warnings,
  };
}

export function filterModelsForAgentChat(
  policy: AIModelPolicy,
  models: SelectableChatModel[]
): SelectableChatModel[] {
  if (models.length === 0) return [];

  const defaultModel =
    models.find((m) => m.id === policy.default_chat_model_id) ??
    models.find((m) => m.is_default) ??
    models[0];

  if (
    policy.selection_mode === 'admin_locked' ||
    policy.user_visible_models === 'default_only'
  ) {
    return defaultModel ? [defaultModel] : models.slice(0, 1);
  }

  return models;
}

export function shouldShowModelPicker(
  policy: AIModelPolicy,
  visibleModels: SelectableChatModel[]
): boolean {
  return (
    policy.selection_mode === 'user_choice' &&
    policy.user_visible_models === 'all_enabled' &&
    visibleModels.length > 1
  );
}

export function resolveAgentChatModelId(
  policy: AIModelPolicy,
  visibleModels: SelectableChatModel[],
  userSelectedId?: string | null,
  storedModelId?: string | null
): string | undefined {
  const visibleIds = new Set(visibleModels.map((m) => m.id));
  const defaultId =
    policy.default_chat_model_id && visibleIds.has(policy.default_chat_model_id)
      ? policy.default_chat_model_id
      : visibleModels.find((m) => m.is_default)?.id ?? visibleModels[0]?.id;

  if (policy.selection_mode === 'admin_locked') {
    return defaultId;
  }

  if (userSelectedId && visibleIds.has(userSelectedId)) {
    return userSelectedId;
  }

  if (storedModelId && visibleIds.has(storedModelId)) {
    return storedModelId;
  }

  return defaultId;
}

export async function saveAIModelPolicy(
  input: AIModelPolicy
): Promise<{ policy: AIModelPolicy; warnings: string[] }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const selectableModels = await fetchSelectableChatModels();
  const connectedIntegrationSlugs = await getConnectedAIIntegrationSlugs();
  const { policy, warnings } = sanitizeAIModelPolicy(
    input,
    selectableModels,
    connectedIntegrationSlugs
  );

  const { data: existing, error: fetchError } = await supabase
    .from('integration_settings')
    .select('id')
    .is('organization_id', null)
    .maybeSingle();

  if (fetchError) throw fetchError;

  const payload = {
    organization_id: null,
    ai_model_policy: policy as unknown as IntegrationSettingsRow['ai_model_policy'],
    updated_by: user.id,
  };

  if (existing?.id) {
    const { error } = await supabase
      .from('integration_settings')
      .update(payload)
      .eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('integration_settings').insert(payload);
    if (error) throw error;
  }

  if (policy.default_chat_model_id) {
    await setGlobalDefaultChatModel(policy.default_chat_model_id);
  }

  return { policy, warnings };
}

export function isDefaultModelInvalid(
  policy: AIModelPolicy,
  selectableModels: SelectableChatModel[]
): boolean {
  if (!policy.default_chat_model_id) return selectableModels.length > 0;
  return !selectableModels.some((m) => m.id === policy.default_chat_model_id);
}

/** Set this integration as the org default AI provider (Flow 5 — only one allowed). */
export async function setDefaultAIProvider(
  integrationSlug: string,
  defaultChatModelId: string | null
): Promise<{ policy: AIModelPolicy; warnings: string[] }> {
  const current = await getAIModelPolicy();
  const selectableModels = await fetchSelectableChatModels();
  const providerModels = selectableModels.filter(
    (m) => integrationSlugFromAIProviderSlug(m.provider_slug) === integrationSlug
  );
  const resolvedModelId =
    defaultChatModelId ??
    providerModels.find((m) => m.is_default)?.id ??
    providerModels[0]?.id ??
    null;

  return saveAIModelPolicy({
    ...current,
    default_provider_slug: integrationSlug,
    default_chat_model_id: resolvedModelId,
  });
}

export async function clearDefaultAIProvider(
  integrationSlug: string
): Promise<{ policy: AIModelPolicy; warnings: string[] }> {
  const current = await getAIModelPolicy();
  if (current.default_provider_slug !== integrationSlug) {
    return { policy: current, warnings: [] };
  }
  return saveAIModelPolicy({
    ...current,
    default_provider_slug: null,
  });
}
