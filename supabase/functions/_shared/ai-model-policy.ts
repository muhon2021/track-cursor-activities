/**
 * Deno shared helpers for org-wide AI model policy enforcement in edge functions.
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export type ModelSelectionMode = 'admin_locked' | 'user_choice'
export type UserVisibleModels = 'all_enabled' | 'default_only'

export interface AIModelPolicy {
  selection_mode: ModelSelectionMode
  default_chat_model_id: string | null
  default_provider_slug: string | null
  user_visible_models: UserVisibleModels
}

export const AI_INTEGRATION_SLUGS = [
  'openai',
  'anthropic',
  'google-gemini',
  'perplexity',
  'openrouter',
] as const

export const INTEGRATION_TO_AI_PROVIDER_SLUG: Record<string, string> = {
  openai: 'openai',
  anthropic: 'anthropic',
  'google-gemini': 'google',
  perplexity: 'perplexity',
  openrouter: 'openrouter',
}

const DEFAULT_AI_MODEL_POLICY: AIModelPolicy = {
  selection_mode: 'user_choice',
  default_chat_model_id: null,
  default_provider_slug: null,
  user_visible_models: 'all_enabled',
}

export interface AllowedChatModel {
  id: string
  is_default: boolean
  provider_id: string
}

export function normalizeAIModelPolicy(raw: unknown): AIModelPolicy {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_AI_MODEL_POLICY }
  }

  const obj = raw as Record<string, unknown>
  return {
    selection_mode: obj.selection_mode === 'admin_locked' ? 'admin_locked' : 'user_choice',
    user_visible_models:
      obj.user_visible_models === 'default_only' ? 'default_only' : 'all_enabled',
    default_chat_model_id:
      typeof obj.default_chat_model_id === 'string' && obj.default_chat_model_id.length > 0
        ? obj.default_chat_model_id
        : null,
    default_provider_slug:
      typeof obj.default_provider_slug === 'string' && obj.default_provider_slug.length > 0
        ? obj.default_provider_slug
        : null,
  }
}

export async function getAIModelPolicy(supabase: SupabaseClient): Promise<AIModelPolicy> {
  const { data, error } = await supabase
    .from('integration_settings')
    .select('ai_model_policy')
    .is('organization_id', null)
    .maybeSingle()

  if (error) throw error
  return normalizeAIModelPolicy(data?.ai_model_policy)
}

async function getConnectedAIProviderIds(supabase: SupabaseClient): Promise<Set<string>> {
  const { data: orgIntegrations, error: orgError } = await supabase
    .from('organization_integrations')
    .select('connection_status, enabled, provider:integration_providers(slug)')
    .eq('connection_status', 'connected')
    .eq('enabled', true)

  if (orgError) throw orgError

  const connectedIntegrationSlugs = new Set<string>()
  for (const row of orgIntegrations ?? []) {
    const slug = (row.provider as { slug?: string } | null)?.slug
    if (slug && (AI_INTEGRATION_SLUGS as readonly string[]).includes(slug)) {
      connectedIntegrationSlugs.add(slug)
    }
  }

  const aiSlugs = [...connectedIntegrationSlugs].map(
    (slug) => INTEGRATION_TO_AI_PROVIDER_SLUG[slug] ?? slug
  )
  if (aiSlugs.length === 0) return new Set()

  const { data: providers, error: provError } = await supabase
    .from('ai_providers')
    .select('id')
    .in('slug', aiSlugs)

  if (provError) throw provError
  return new Set((providers ?? []).map((p: { id: string }) => p.id))
}

export async function fetchAllowedChatModels(
  supabase: SupabaseClient
): Promise<AllowedChatModel[]> {
  const connectedProviderIds = await getConnectedAIProviderIds(supabase)
  if (connectedProviderIds.size === 0) return []

  const { data, error } = await supabase
    .from('ai_models')
    .select('id, is_default, provider_id')
    .eq('category', 'chat')
    .eq('enabled', true)

  if (error) throw error

  return (data ?? []).filter((m: AllowedChatModel) => connectedProviderIds.has(m.provider_id))
}

function filterModelsForPolicy(
  policy: AIModelPolicy,
  models: AllowedChatModel[]
): AllowedChatModel[] {
  if (models.length === 0) return []

  const defaultModel =
    models.find((m) => m.id === policy.default_chat_model_id) ??
    models.find((m) => m.is_default) ??
    models[0]

  if (
    policy.selection_mode === 'admin_locked' ||
    policy.user_visible_models === 'default_only'
  ) {
    return defaultModel ? [defaultModel] : models.slice(0, 1)
  }

  return models
}

export async function resolveEffectiveModelId(
  supabase: SupabaseClient,
  requestedModelId?: string | null
): Promise<string | undefined> {
  const policy = await getAIModelPolicy(supabase)
  const allowedModels = await fetchAllowedChatModels(supabase)
  const visibleModels = filterModelsForPolicy(policy, allowedModels)
  const visibleIds = new Set(visibleModels.map((m) => m.id))

  const defaultId =
    policy.default_chat_model_id && visibleIds.has(policy.default_chat_model_id)
      ? policy.default_chat_model_id
      : visibleModels.find((m) => m.is_default)?.id ?? visibleModels[0]?.id

  if (policy.selection_mode === 'admin_locked') {
    return defaultId
  }

  if (requestedModelId && visibleIds.has(requestedModelId)) {
    return requestedModelId
  }

  return defaultId
}
