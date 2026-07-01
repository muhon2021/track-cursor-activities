import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// --- AI model policy + provider routing (inlined for single-file dashboard deploy) ---

type ModelSelectionMode = 'admin_locked' | 'user_choice'
type UserVisibleModels = 'all_enabled' | 'default_only'

interface AIModelPolicy {
  selection_mode: ModelSelectionMode
  default_chat_model_id: string | null
  default_provider_slug: string | null
  user_visible_models: UserVisibleModels
}

const AI_INTEGRATION_SLUGS = ['openai', 'anthropic', 'google-gemini', 'perplexity', 'openrouter'] as const

const INTEGRATION_TO_AI_PROVIDER_SLUG: Record<string, string> = {
  openai: 'openai',
  anthropic: 'anthropic',
  'google-gemini': 'google',
  perplexity: 'perplexity',
  openrouter: 'openrouter',
}

const AI_PROVIDER_TO_INTEGRATION_SLUG: Record<string, string> = {
  openai: 'openai',
  anthropic: 'anthropic',
  google: 'google-gemini',
  perplexity: 'perplexity',
  openrouter: 'openrouter',
}

const ENCRYPTED_VALUE_PREFIX = 'v1:'
const SENSITIVE_KEY_PATTERNS = [
  /api[_-]?key$/i,
  /client[_-]?secret$/i,
  /[_-]secret$/i,
  /[_-]token$/i,
  /password$/i,
  /private[_-]?key$/i,
]

const DEFAULT_AI_MODEL_POLICY: AIModelPolicy = {
  selection_mode: 'user_choice',
  default_chat_model_id: null,
  default_provider_slug: null,
  user_visible_models: 'all_enabled',
}

interface AllowedChatModel {
  id: string
  is_default: boolean
  provider_id: string
}

interface AIModel {
  id: string
  provider_id: string
  name: string
  model_id: string
  category: 'chat' | 'embedding'
  context_window: number
  input_cost_per_1k: number
  output_cost_per_1k: number
  embedding_cost_per_1k: number
  enabled: boolean
  is_default: boolean
  features: Record<string, boolean>
  ai_providers?: {
    name: string
    slug: string
    api_key_secret_name: string
    base_url: string
  }
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface ChatCompletionRequest {
  messages: ChatMessage[]
  model?: string
  max_tokens?: number
  temperature?: number
  stream?: boolean
}

interface ChatCompletionResponse {
  content: string
  input_tokens: number
  output_tokens: number
  model: string
}

function normalizeAIModelPolicy(raw: unknown): AIModelPolicy {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_AI_MODEL_POLICY }
  }
  const obj = raw as Record<string, unknown>
  return {
    selection_mode: obj.selection_mode === 'admin_locked' ? 'admin_locked' : 'user_choice',
    user_visible_models: obj.user_visible_models === 'default_only' ? 'default_only' : 'all_enabled',
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

async function getAIModelPolicy(supabase: SupabaseClient): Promise<AIModelPolicy> {
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

  const aiSlugs = [...connectedIntegrationSlugs].map((slug) => INTEGRATION_TO_AI_PROVIDER_SLUG[slug] ?? slug)
  if (aiSlugs.length === 0) return new Set()

  const { data: providers, error: provError } = await supabase.from('ai_providers').select('id').in('slug', aiSlugs)
  if (provError) throw provError
  return new Set((providers ?? []).map((p: { id: string }) => p.id))
}

async function fetchAllowedChatModels(supabase: SupabaseClient): Promise<AllowedChatModel[]> {
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

function filterModelsForPolicy(policy: AIModelPolicy, models: AllowedChatModel[]): AllowedChatModel[] {
  if (models.length === 0) return []
  const defaultModel =
    models.find((m) => m.id === policy.default_chat_model_id) ??
    models.find((m) => m.is_default) ??
    models[0]
  if (policy.selection_mode === 'admin_locked' || policy.user_visible_models === 'default_only') {
    return defaultModel ? [defaultModel] : models.slice(0, 1)
  }
  return models
}

async function resolveEffectiveModelId(
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
  if (policy.selection_mode === 'admin_locked') return defaultId
  if (requestedModelId && visibleIds.has(requestedModelId)) return requestedModelId
  return defaultId
}

async function getApiKey(supabase: SupabaseClient, secretName: string): Promise<string | null> {
  const envKey = Deno.env.get(secretName)
  if (envKey) return envKey
  const { data, error } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', `integrations.${secretName.toLowerCase()}`)
    .single()
  if (error || !data) return null
  return data.value
}

function readConfigString(config: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = config[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function isEncryptedConfigValue(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(ENCRYPTED_VALUE_PREFIX)
}

function isSensitiveIntegrationFieldKey(fieldKey: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(fieldKey))
}

class IntegrationConfigDecryption {
  private static readonly VERSION = 'v1'
  private static readonly ALGORITHM = 'AES-GCM'
  private static readonly IV_LENGTH = 12
  private static readonly TAG_LENGTH = 16

  static async decrypt(ciphertext: string, keyString: string): Promise<string> {
    const parts = ciphertext.split(':')
    if (parts.length !== 3) throw new Error('Invalid ciphertext format')
    const [version, ivBase64, encryptedBase64] = parts
    if (version !== this.VERSION) throw new Error(`Unsupported version: ${version}`)
    const iv = this.base64ToArrayBuffer(ivBase64)
    const encrypted = this.base64ToArrayBuffer(encryptedBase64)
    const key = await this.deriveKey(keyString)
    const decrypted = await crypto.subtle.decrypt(
      { name: this.ALGORITHM, iv, tagLength: this.TAG_LENGTH * 8 } as AesGcmParams,
      key,
      encrypted as BufferSource,
    )
    return new TextDecoder().decode(decrypted)
  }

  private static async deriveKey(keyString: string): Promise<CryptoKey> {
    const encoder = new TextEncoder()
    const baseKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(keyString),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey'],
    )
    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode('sj-integration-config-salt'),
        iterations: 100000,
        hash: 'SHA-256',
      },
      baseKey,
      { name: this.ALGORITHM, length: 256 },
      false,
      ['encrypt', 'decrypt'],
    )
  }

  private static base64ToArrayBuffer(base64: string): Uint8Array {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
  }
}

function getIntegrationEncryptionKey(): string {
  const key = Deno.env.get('ENCRYPTION_KEY')?.trim()
  if (key && key.length >= 16) return key
  const fallback = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim()
  if (fallback) return fallback
  throw new Error('ENCRYPTION_KEY is not configured')
}

async function decryptConfigValueIfNeeded(value: string): Promise<string> {
  if (!value || !isEncryptedConfigValue(value)) return value
  return await IntegrationConfigDecryption.decrypt(value, getIntegrationEncryptionKey())
}

async function decryptStoredIntegrationConfig(
  config: Record<string, unknown>,
  sensitiveKeys: Set<string>,
): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = { ...config }
  for (const fieldKey of sensitiveKeys) {
    const rawValue = config[fieldKey]
    if (typeof rawValue !== 'string') continue
    result[fieldKey] = await decryptConfigValueIfNeeded(rawValue)
  }
  for (const fieldKey of Object.keys(config)) {
    if (sensitiveKeys.has(fieldKey)) continue
    const rawValue = config[fieldKey]
    if (typeof rawValue === 'string' && isEncryptedConfigValue(rawValue)) {
      result[fieldKey] = await decryptConfigValueIfNeeded(rawValue)
    }
  }
  return result
}

async function getSensitiveFieldKeysForProvider(
  supabase: SupabaseClient,
  providerId: string,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('integration_fields')
    .select('field_key, is_sensitive')
    .eq('provider_id', providerId)
  if (error) throw error
  const keys = new Set<string>()
  for (const row of data ?? []) {
    const fieldKey = row.field_key as string
    if (row.is_sensitive === true || isSensitiveIntegrationFieldKey(fieldKey)) {
      keys.add(fieldKey)
    }
  }
  return keys
}

async function resolveIntegrationHubApiKey(
  supabase: SupabaseClient,
  integrationSlug: string,
  userId?: string | null,
): Promise<string | null> {
  const { data: provider, error: providerError } = await supabase
    .from('integration_providers')
    .select('id')
    .eq('slug', integrationSlug)
    .maybeSingle()
  if (providerError || !provider?.id) return null

  const { data: integrations, error: integrationError } = await supabase
    .from('organization_integrations')
    .select('user_id, config, connection_status, enabled')
    .eq('provider_id', provider.id)
    .eq('connection_status', 'connected')
    .eq('enabled', true)
  if (integrationError || !integrations?.length) return null

  const ranked = [...integrations].sort((a, b) => {
    const score = (row: { user_id: string | null }) => {
      if (userId && row.user_id === userId) return 0
      if (row.user_id == null) return 1
      return 2
    }
    return score(a) - score(b)
  })

  const storedConfig = (ranked[0]?.config ?? {}) as Record<string, unknown>
  if (Object.keys(storedConfig).length === 0) return null

  let config = storedConfig
  try {
    const sensitiveKeys = await getSensitiveFieldKeysForProvider(supabase, provider.id)
    config = await decryptStoredIntegrationConfig(storedConfig, sensitiveKeys)
  } catch (error) {
    console.warn('[agent-conversation-chat] decrypt integration config failed:', error)
  }

  const apiKey = readConfigString(config, [
    'api_key',
    'apiKey',
    'openrouter_api_key',
    'openai_api_key',
    'anthropic_api_key',
    'google_api_key',
    'perplexity_api_key',
  ])
  if (!apiKey || apiKey === '__CONFIGURED__' || apiKey.startsWith('•')) return null
  return apiKey
}

async function resolveProviderApiKey(
  supabase: SupabaseClient,
  provider: NonNullable<AIModel['ai_providers']>,
  userId?: string | null,
): Promise<string | null> {
  const envKey = await getApiKey(supabase, provider.api_key_secret_name)
  if (envKey) return envKey

  const integrationSlug = AI_PROVIDER_TO_INTEGRATION_SLUG[provider.slug] ?? provider.slug
  return await resolveIntegrationHubApiKey(supabase, integrationSlug, userId)
}

async function getModel(
  supabase: SupabaseClient,
  modelId?: string,
  category?: 'chat' | 'embedding'
): Promise<AIModel | null> {
  if (modelId) {
    const { data, error } = await supabase
      .from('ai_models')
      .select('*, ai_providers(*)')
      .eq('id', modelId)
      .eq('enabled', true)
      .single()
    if (error || !data) return null
    return data as AIModel
  }
  if (category) {
    const { data: settingsRow } = await supabase
      .from('integration_settings')
      .select('ai_model_policy')
      .is('organization_id', null)
      .maybeSingle()
    const policy = normalizeAIModelPolicy(settingsRow?.ai_model_policy)
    if (policy.default_chat_model_id) {
      const { data: policyModel, error: policyError } = await supabase
        .from('ai_models')
        .select('*, ai_providers(*)')
        .eq('id', policy.default_chat_model_id)
        .eq('enabled', true)
        .maybeSingle()
      if (!policyError && policyModel) return policyModel as AIModel
    }
    const { data, error } = await supabase
      .from('ai_models')
      .select('*, ai_providers(*)')
      .eq('category', category)
      .eq('is_default', true)
      .eq('enabled', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error || !data) return null
    return data as AIModel
  }
  return null
}

async function chatOpenAI(apiKey: string, request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: request.model || 'gpt-4o-mini',
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.max_tokens ?? 1000,
    }),
  })
  if (!response.ok) throw new Error(`OpenAI API error: ${await response.text()}`)
  const data = await response.json()
  return {
    content: data.choices[0].message.content,
    input_tokens: data.usage.prompt_tokens,
    output_tokens: data.usage.completion_tokens,
    model: data.model,
  }
}

async function chatAnthropic(apiKey: string, request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: request.model || 'claude-sonnet-4-20250514',
      messages: request.messages.filter((m) => m.role !== 'system'),
      system: request.messages.find((m) => m.role === 'system')?.content,
      max_tokens: request.max_tokens ?? 1000,
      temperature: request.temperature ?? 0.7,
    }),
  })
  if (!response.ok) throw new Error(`Anthropic API error: ${await response.text()}`)
  const data = await response.json()
  return {
    content: data.content[0].text,
    input_tokens: data.usage.input_tokens,
    output_tokens: data.usage.output_tokens,
    model: data.model,
  }
}

async function chatGoogle(apiKey: string, request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
  const model = request.model || 'gemini-2.5-flash'
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: request.messages
          .filter((m) => m.role !== 'system')
          .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        generationConfig: { temperature: request.temperature ?? 0.7, maxOutputTokens: request.max_tokens ?? 1000 },
      }),
    }
  )
  if (!response.ok) throw new Error(`Google AI API error: ${await response.text()}`)
  const data = await response.json()
  const content = data.candidates[0].content.parts[0].text
  return {
    content,
    input_tokens: data.usageMetadata?.promptTokenCount || Math.ceil(JSON.stringify(request.messages).length / 4),
    output_tokens: data.usageMetadata?.candidatesTokenCount || Math.ceil(content.length / 4),
    model,
  }
}

async function chatPerplexity(apiKey: string, request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: request.model || 'sonar',
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.max_tokens ?? 1000,
    }),
  })
  if (!response.ok) throw new Error(`Perplexity API error: ${await response.text()}`)
  const data = await response.json()
  return {
    content: data.choices[0].message.content,
    input_tokens: data.usage.prompt_tokens,
    output_tokens: data.usage.completion_tokens,
    model: data.model,
  }
}

async function chatOpenRouter(apiKey: string, request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
  const baseUrl = Deno.env.get('OPENROUTER_API_BASE_URL')?.trim() || 'https://openrouter.ai/api/v1'
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': Deno.env.get('SITE_URL')?.trim() || 'https://localhost',
      'X-Title': 'SJ Control Tower',
    },
    body: JSON.stringify({
      model: request.model || 'deepseek/deepseek-r1',
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.max_tokens ?? 1000,
    }),
  })
  if (!response.ok) throw new Error(`OpenRouter API error: ${await response.text()}`)
  const data = await response.json()
  return {
    content: data.choices[0].message.content,
    input_tokens: data.usage?.prompt_tokens ?? 0,
    output_tokens: data.usage?.completion_tokens ?? 0,
    model: data.model ?? request.model ?? 'deepseek/deepseek-r1',
  }
}

async function chatCompletion(
  supabase: SupabaseClient,
  request: ChatCompletionRequest,
  modelId?: string,
  userId?: string | null,
): Promise<ChatCompletionResponse> {
  let model = await getModel(supabase, modelId, 'chat')
  if (!model) {
    const { data } = await supabase
      .from('ai_models')
      .select('*, ai_providers(*)')
      .eq('category', 'chat')
      .eq('enabled', true)
      .limit(1)
      .single()
    if (data) model = data as AIModel
  }
  if (!model || !model.ai_providers) {
    const lovableKey = Deno.env.get('LOVABLE_API_KEY')
    if (lovableKey) {
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${lovableKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: request.messages,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.max_tokens ?? 1000,
        }),
      })
      if (!response.ok) throw new Error(`Lovable AI error: ${await response.text()}`)
      const data = await response.json()
      return {
        content: data.choices[0].message.content,
        input_tokens: data.usage?.prompt_tokens || 0,
        output_tokens: data.usage?.completion_tokens || 0,
        model: 'google/gemini-3-flash-preview',
      }
    }
    throw new Error('No valid chat model found')
  }
  const apiKey = await resolveProviderApiKey(supabase, model.ai_providers, userId)
  if (!apiKey) throw new Error(`API key not configured for ${model.ai_providers.name}`)
  const requestWithModel = { ...request, model: model.model_id }
  switch (model.ai_providers.slug) {
    case 'openai': return chatOpenAI(apiKey, requestWithModel)
    case 'anthropic': return chatAnthropic(apiKey, requestWithModel)
    case 'google': return chatGoogle(apiKey, requestWithModel)
    case 'perplexity': return chatPerplexity(apiKey, requestWithModel)
    case 'openrouter': return chatOpenRouter(apiKey, requestWithModel)
    default: throw new Error(`Unsupported provider: ${model.ai_providers.slug}`)
  }
}

async function logUsage(
  supabase: SupabaseClient,
  userId: string | null,
  modelId: string | null,
  functionName: string,
  inputTokens: number,
  outputTokens: number,
  embeddingTokens: number,
  estimatedCost: number,
  metadata?: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase.from('ai_usage_logs').insert({
    user_id: userId,
    model_id: modelId,
    function_name: functionName,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    embedding_tokens: embeddingTokens,
    estimated_cost: estimatedCost,
    metadata: metadata ?? {},
  })
  if (error) console.error('Failed to log AI usage:', error)
}

function calculateCost(model: AIModel, inputTokens: number, outputTokens: number, embeddingTokens: number): number {
  return (
    (inputTokens / 1000) * model.input_cost_per_1k +
    (outputTokens / 1000) * model.output_cost_per_1k +
    (embeddingTokens / 1000) * model.embedding_cost_per_1k
  )
}

// --- End AI model policy + provider routing ---

// --- Agent MCP tools (inlined for single-file dashboard deploy) ---

const MCP_HTTP_CONFIG_KEY = "x-http-config";

function isRestConfiguredTool(schema: Record<string, unknown>): boolean {
  const httpConfig = schema[MCP_HTTP_CONFIG_KEY] as { path?: string } | undefined;
  return Boolean(httpConfig?.path);
}

async function resolveAgentMcpServerIds(
  supabase: ReturnType<typeof createClient>,
  agentId: string,
  fromAgent: string[]
): Promise<string[]> {
  if (fromAgent.length > 0) return fromAgent;

  const { data: links, error } = await supabase
    .from("agent_mcp_servers")
    .select("server_id")
    .eq("agent_id", agentId)
    .eq("is_enabled", true);

  if (error) {
    console.warn("resolveAgentMcpServerIds:", error.message);
    return [];
  }

  return (links ?? []).map((row: { server_id: string }) => row.server_id);
}

interface AgentMcpToolDef {
  tool_id: string;
  server_id: string;
  tool_name: string;
  function_name: string;
  description: string;
  parameters: Record<string, unknown>;
}

interface McpChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

function stripHttpConfig(schema: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...schema };
  delete copy[MCP_HTTP_CONFIG_KEY];
  if (!copy.type) copy.type = "object";
  if (!copy.properties) copy.properties = {};
  return copy;
}

function makeFunctionName(serverName: string, toolName: string): string {
  const raw = `${serverName}_${toolName}`
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return (raw || "mcp_tool").slice(0, 64);
}

async function loadAgentMcpToolDefs(
  supabase: ReturnType<typeof createClient>,
  serverIds: string[]
): Promise<AgentMcpToolDef[]> {
  if (!serverIds.length) return [];

  const { data: tools, error } = await supabase
    .from("mcp_tools")
    .select("id, server_id, name, description, input_schema")
    .in("server_id", serverIds)
    .eq("is_enabled", true)
    .order("name");

  if (error || !tools?.length) {
    if (error) console.warn("loadAgentMcpToolDefs:", error.message);
    return [];
  }

  const { data: servers } = await supabase
    .from("mcp_servers")
    .select("id, name")
    .in("id", serverIds);

  const serverNames = new Map(
    (servers ?? []).map((s: { id: string; name: string }) => [s.id, s.name])
  );

  const usedNames = new Set<string>();
  const defs: AgentMcpToolDef[] = [];

  for (const tool of tools) {
    const serverName = serverNames.get(tool.server_id) ?? "server";
    let functionName = makeFunctionName(serverName, tool.name);
    let suffix = 2;
    while (usedNames.has(functionName)) {
      functionName = `${makeFunctionName(serverName, tool.name).slice(0, 58)}_${suffix}`;
      suffix++;
    }
    usedNames.add(functionName);

    const schema = (tool.input_schema as Record<string, unknown>) ?? {};

    defs.push({
      tool_id: tool.id,
      server_id: tool.server_id,
      tool_name: tool.name,
      function_name: functionName,
      description: tool.description || tool.name,
      parameters: stripHttpConfig(schema),
    });
  }

  return defs;
}

async function executeMcpToolViaEdgeFunction(
  supabaseUrl: string,
  serviceKey: string,
  params: {
    tool_id: string;
    input_parameters: Record<string, unknown>;
    user_id: string;
    agent_id?: string;
    conversation_id?: string;
  }
): Promise<string> {
  const response = await fetch(`${supabaseUrl}/functions/v1/execute-mcp-tool`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tool_id: params.tool_id,
      input_parameters: params.input_parameters,
      user_id: params.user_id,
      agent_id: params.agent_id,
      conversation_id: params.conversation_id,
    }),
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body.error || `MCP tool execution failed (${response.status})`);
  }

  if (body.success === false) {
    throw new Error(body.error || "MCP tool execution failed");
  }

  const output = body.output ?? body;
  return typeof output === "string" ? output : JSON.stringify(output, null, 2);
}

interface RestHttpConfig {
  method: string;
  path: string;
  headers?: Record<string, string>;
}

function buildRestAuthHeaders(
  authConfig: Record<string, unknown> = {},
  authType = "none"
): Record<string, string> {
  const headers: Record<string, string> = {};
  if (authConfig.authorization_header) {
    headers.Authorization = String(authConfig.authorization_header);
  } else if (authType === "api_key" && authConfig.api_key) {
    headers["X-API-Key"] = String(authConfig.api_key);
  } else if (authType === "bearer" && authConfig.bearer_token) {
    headers.Authorization = `Bearer ${authConfig.bearer_token}`;
  } else if (authType === "basic" && authConfig.username) {
    const credentials = btoa(`${authConfig.username}:${authConfig.password || ""}`);
    headers.Authorization = `Basic ${credentials}`;
  }
  return headers;
}

async function executeRestToolDirect(
  server: { server_url: string; auth_type?: string; auth_config?: Record<string, unknown> },
  toolSchema: Record<string, unknown>,
  parameters: Record<string, unknown>
): Promise<unknown> {
  const httpConfig = toolSchema[MCP_HTTP_CONFIG_KEY] as RestHttpConfig | undefined;
  if (!httpConfig?.path) {
    throw new Error("REST tool is missing endpoint configuration");
  }

  const authConfig = (server.auth_config as Record<string, unknown>) ?? {};
  const authType = server.auth_type ?? "none";

  let url = httpConfig.path;
  if (!url.startsWith("http")) {
    const baseUrl = server.server_url.replace(/\/$/, "");
    const path = httpConfig.path.startsWith("/") ? httpConfig.path : `/${httpConfig.path}`;
    url = `${baseUrl}${path}`;
  }

  const method = (httpConfig.method || "POST").toUpperCase();
  const headers: Record<string, string> = {
    ...buildRestAuthHeaders(authConfig, authType),
    ...(httpConfig.headers || {}),
  };

  if (!headers["Content-Type"] && !headers["content-type"]) {
    headers["Content-Type"] = "application/json";
  }

  const fetchOptions: RequestInit = { method, headers };

  if (["POST", "PUT", "PATCH"].includes(method)) {
    fetchOptions.body = JSON.stringify(parameters);
  } else if (method === "GET" && Object.keys(parameters).length > 0) {
    const query = new URLSearchParams(
      Object.entries(parameters).map(([k, v]) => [k, String(v)])
    ).toString();
    url = `${url}${url.includes("?") ? "&" : "?"}${query}`;
  }

  const response = await fetch(url, fetchOptions);
  const text = await response.text();

  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { text };
  }

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status}: ${typeof parsed === "object" ? JSON.stringify(parsed) : text}`
    );
  }

  return parsed;
}

async function executeAgentMcpToolDirect(
  supabase: ReturnType<typeof createClient>,
  toolId: string,
  args: Record<string, unknown>,
  userId: string,
  agentId: string,
  conversationId: string
): Promise<string> {
  const { data: tool, error } = await supabase
    .from("mcp_tools")
    .select("input_schema, server_id, mcp_servers(server_url, auth_type, auth_config, transport_type)")
    .eq("id", toolId)
    .single();

  if (error || !tool) {
    throw new Error(`Tool not found: ${error?.message ?? toolId}`);
  }

  const server = tool.mcp_servers as {
    server_url: string;
    auth_type?: string;
    auth_config?: Record<string, unknown>;
    transport_type?: string;
  } | null;

  if (!server) {
    throw new Error("MCP server configuration not found for tool");
  }

  const schema = tool.input_schema as Record<string, unknown>;
  const coercedArgs = coerceToolParameters(schema, args);

  if (server.transport_type === "rest" || isRestConfiguredTool(schema)) {
    const result = await executeRestToolDirect(server, schema, coercedArgs);
    return typeof result === "string" ? result : JSON.stringify(result, null, 2);
  }

  const baseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return executeMcpToolViaEdgeFunction(baseUrl, serviceKey, {
    tool_id: toolId,
    input_parameters: coercedArgs,
    user_id: userId,
    agent_id: agentId,
    conversation_id: conversationId,
  });
}

function coerceToolParameters(
  schema: Record<string, unknown>,
  parameters: Record<string, unknown>
): Record<string, unknown> {
  const properties = (schema.properties as Record<string, { type?: string }>) ?? {};
  const coerced: Record<string, unknown> = { ...parameters };

  for (const [key, value] of Object.entries(coerced)) {
    const propType = properties[key]?.type;
    if ((propType === "integer" || propType === "number") && typeof value === "string" && value.trim() !== "") {
      const num = Number(value);
      if (!Number.isNaN(num)) coerced[key] = num;
    }
  }

  return coerced;
}

const AC_PM_BASE_URL = "https://pm.sjinnovation.us";

function parseAcTasks(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  if (Array.isArray(record.tasks)) return record.tasks as Record<string, unknown>[];
  if (Array.isArray(record.data)) return record.data as Record<string, unknown>[];
  if (record.data && typeof record.data === "object") {
    const inner = record.data as Record<string, unknown>;
    if (Array.isArray(inner.tasks)) return inner.tasks as Record<string, unknown>[];
  }
  return [];
}

function normalizeAcDisplayStatus(raw: unknown, isCompleted?: boolean): string {
  if (isCompleted) return "Completed";
  const s = String(raw ?? "").toUpperCase().trim();
  if (!s || s === "NOT SET" || s === "NEW") return "Open";
  if (["ASSIGNED", "IN PROGRESS", "PM REVIEW", "ACTIVE"].includes(s)) return "In Progress";
  if (s === "ON HOLD") return "On Hold";
  if (["LOG", "COMPLETED", "DONE", "CLOSED"].includes(s)) return "Completed";
  return s.charAt(0) + s.slice(1).toLowerCase();
}

function isOpenOrInProgressAcStatus(raw: unknown, isCompleted?: boolean): boolean {
  if (isCompleted) return false;
  const s = String(raw ?? "").toUpperCase().trim();
  if (["LOG", "COMPLETED", "DONE", "CLOSED"].includes(s)) return false;
  if (s === "ON HOLD") return false;
  return true;
}

function assigneeNamesMatch(assignee: string, filter: string): boolean {
  const normalize = (v: string) =>
    v.toLowerCase().replace(/\./g, " ").split(/\s+/).filter(Boolean);
  const a = normalize(assignee);
  const f = normalize(filter);
  if (!f.length) return true;
  if (!a.length) return false;
  return f.every((ft) =>
    a.some((at) => at.startsWith(ft) || ft.startsWith(at) || at.includes(ft))
  );
}

function extractAssigneeFilter(message: string): string | null {
  const patterns = [
    /\b(?:for|assigned to|assignee)\s+([A-Za-z][A-Za-z.\s'-]{1,48}?)(?:\s+format|\s+with\s+columns|[.,]|$)/i,
    /\btasks?\s+for\s+([A-Za-z][A-Za-z.\s'-]{1,48}?)(?:\s+format|\s+with|[.,]|$)/i,
  ];
  for (const pattern of patterns) {
    const m = message.match(pattern);
    if (m?.[1]) return m[1].trim().replace(/\s+/g, " ");
  }
  return null;
}

function extractProjectIdFromMessage(
  message: string,
  tasks: Record<string, unknown>[]
): number | null {
  const m =
    message.match(/project[_\s-]*id\s*[=:]?\s*(\d+)/i) ??
    message.match(/\bproject\s+(\d+)\b/i);
  if (m) return Number(m[1]);
  const fromTask = tasks[0]?.project_id;
  return typeof fromTask === "number" ? fromTask : Number(fromTask) || null;
}

function getTaskAssigneeLabel(task: Record<string, unknown>): string {
  const candidates = [
    task.assignee_name,
    task.assignee,
    task.assignee_display_name,
    task.assignee_full_name,
    task.user_name,
    task.assigned_to_name,
    task.assigned_to,
    task.responsible,
    task.responsible_name,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return "";
}

function hasHumanAssigneeLabel(assignee: string): boolean {
  return Boolean(assignee) && !assignee.startsWith("user_id:");
}

function acTaskDedupeKey(task: {
  id?: unknown;
  name?: unknown;
  assignee?: string;
  assignee_id?: unknown;
  project_id?: unknown;
}): string {
  const id = task.id;
  if (id != null && id !== "") return `id:${id}`;
  const name = String(task.name ?? "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
  const assignee = String(task.assignee_id ?? task.assignee ?? "")
    .toLowerCase()
    .trim();
  const projectId = String(task.project_id ?? "");
  return `fallback:${projectId}|${name}|${assignee}`;
}

function dedupeAcTaskRecords(
  tasks: Record<string, unknown>[]
): Record<string, unknown>[] {
  const seen = new Set<string>();
  const result: Record<string, unknown>[] = [];
  for (const task of tasks) {
    const id = task.id ?? task.task_id;
    const key = acTaskDedupeKey({
      id,
      name: task.name ?? task.title ?? task.task_name,
      assignee: getTaskAssigneeLabel(task),
      assignee_id: task.assignee_id,
      project_id: task.project_id,
    });
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(task);
  }
  return result;
}

function dedupeEnrichedAcTasks<T extends {
  id?: unknown;
  name?: unknown;
  assignee?: string;
  assignee_id?: unknown;
  project_id?: unknown;
}>(tasks: T[], seenAcrossCalls?: Set<string>): T[] {
  const seen = seenAcrossCalls ?? new Set<string>();
  const result: T[] = [];
  for (const task of tasks) {
    const key = acTaskDedupeKey(task);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(task);
  }
  return result;
}

interface EnrichedAcTaskRow {
  id: unknown;
  name: unknown;
  raw_status: unknown;
  display_status: string;
  assignee: string;
  assignee_id: unknown;
  due_on: unknown;
  project_id: unknown;
  url: string | null;
  duplicate_count?: number;
  related_task_ids?: unknown[];
}

function normalizeAcTaskTitle(name: unknown): string {
  return String(name ?? "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function collapseSameTitleAcTasks(tasks: EnrichedAcTaskRow[]): EnrichedAcTaskRow[] {
  const groups = new Map<string, EnrichedAcTaskRow[]>();

  for (const task of tasks) {
    const key = [
      String(task.project_id ?? ""),
      normalizeAcTaskTitle(task.name),
      String(task.assignee ?? "").toLowerCase().trim(),
    ].join("|");
    const bucket = groups.get(key) ?? [];
    bucket.push(task);
    groups.set(key, bucket);
  }

  const collapsed: EnrichedAcTaskRow[] = [];

  for (const group of groups.values()) {
    if (group.length === 1) {
      collapsed.push(group[0]);
      continue;
    }

    const sorted = [...group].sort((a, b) => {
      const aHasDue = a.due_on != null && a.due_on !== "" && a.due_on !== "-";
      const bHasDue = b.due_on != null && b.due_on !== "" && b.due_on !== "-";
      if (aHasDue !== bHasDue) return aHasDue ? -1 : 1;
      return Number(b.id) - Number(a.id);
    });

    const primary = sorted[0];
    const related = sorted.slice(1);
    const baseName = String(primary.name ?? "").trim();
    collapsed.push({
      ...primary,
      name: `${baseName} (×${group.length})`,
      duplicate_count: group.length,
      related_task_ids: related.map((t) => t.id),
    });
  }

  return collapsed;
}

function enrichActiveCollabToolResult(
  toolName: string,
  raw: string,
  userMessage: string,
  seenTaskKeys?: Set<string>
): string {
  const isTaskTool =
    toolName.includes("get-all-tasks") || toolName.includes("get_all_tasks");
  const isUserTool =
    toolName.includes("get-user") || toolName.includes("get_user");

  if (!isTaskTool && !isUserTool) return raw;

  try {
    const parsed = JSON.parse(raw);

    if (isUserTool) {
      return JSON.stringify(
        {
          ...((typeof parsed === "object" && parsed) || {}),
          hint: "Match assignee using partial names (e.g. Omkar Shinde matches omkar s.)",
        },
        null,
        2
      );
    }

    const tasks = dedupeAcTaskRecords(parseAcTasks(parsed));
    if (!tasks.length) return raw;

    const projectId = extractProjectIdFromMessage(userMessage, tasks);
    const assigneeFilter = extractAssigneeFilter(userMessage);
    const wantsOpenInProgress =
      /\bopen\b/i.test(userMessage) ||
      /\bin[- ]?progress\b/i.test(userMessage) ||
      /\bactive\b/i.test(userMessage);

    const enriched = tasks.map((t) => {
      const id = t.id ?? t.task_id;
      const pid = (t.project_id as number) ?? projectId;
      const rawStatus = t.status ?? t.task_status ?? t.label ?? t.state ?? "";
      const isCompleted = Boolean(t.is_completed) ||
        ["LOG", "COMPLETED", "DONE", "CLOSED"].includes(
          String(rawStatus).toUpperCase()
        );
      const assignee = getTaskAssigneeLabel(t);
      return {
        id,
        name: t.name ?? t.title ?? t.task_name,
        raw_status: rawStatus,
        display_status: normalizeAcDisplayStatus(rawStatus, isCompleted),
        assignee: assignee || (t.assignee_id != null ? `user_id:${t.assignee_id}` : ""),
        assignee_id: t.assignee_id ?? null,
        due_on: t.due_on ?? t.due_date ?? null,
        project_id: pid,
        url:
          pid && id ? `${AC_PM_BASE_URL}/projects/${pid}/tasks/${id}` : null,
      };
    });

    let filtered = enriched.filter(
      (t) => normalizeAcDisplayStatus(t.raw_status) !== "Completed"
    );
    if (wantsOpenInProgress) {
      filtered = filtered.filter((t) =>
        isOpenOrInProgressAcStatus(t.raw_status)
      );
    }
    if (assigneeFilter) {
      const withNames = filtered.filter((t) => hasHumanAssigneeLabel(t.assignee));
      if (withNames.length > 0) {
        const byName = withNames.filter((t) =>
          assigneeNamesMatch(t.assignee, assigneeFilter)
        );
        filtered = byName.length > 0 ? byName : [];
      }
    }

    const uniqueFiltered = dedupeEnrichedAcTasks(filtered, seenTaskKeys);
    const idDuplicatesRemoved = filtered.length - uniqueFiltered.length;
    const collapsedTasks = collapseSameTitleAcTasks(uniqueFiltered);
    const titleDuplicatesCollapsed = uniqueFiltered.length - collapsedTasks.length;

    return JSON.stringify(
      {
        summary: {
          total_from_api: tasks.length,
          matching_tasks: collapsedTasks.length,
          id_duplicates_removed: idDuplicatesRemoved,
          same_title_collapsed: titleDuplicatesCollapsed,
          project_id: projectId,
          assignee_filter: assigneeFilter,
          status_filter: wantsOpenInProgress ? "open_and_in_progress" : "all_non_completed",
          status_mapping:
            "ASSIGNED/NOT SET/NEW → Open; ASSIGNED/PM REVIEW → In Progress; ON HOLD excluded unless asked",
        },
        tasks: collapsedTasks,
        hint:
          collapsedTasks.length === 0 && tasks.length > 0
            ? "API returned tasks but filters removed all rows. ASSIGNED and NOT SET count as open/in-progress. Match assignee with partial names."
            : "Use the tasks array for your table — one row per task. When duplicate_count > 1, show ONE row for that title; append (×N) to the task name and link to the primary task id only.",
      },
      null,
      2
    );
  } catch {
    return raw;
  }
}

async function chatWithMcpToolsOpenAI(
  apiKey: string,
  model: string,
  messages: McpChatMessage[],
  toolDefs: AgentMcpToolDef[],
  executeTool: (toolId: string, args: Record<string, unknown>) => Promise<string>,
  options?: {
    max_tokens?: number;
    temperature?: number;
    max_rounds?: number;
    require_tool_use?: boolean;
    user_query?: string;
  }
): Promise<{
  content: string;
  input_tokens: number;
  output_tokens: number;
  model: string;
  tools_called: string[];
  last_tool_error: string | null;
}> {
  const openaiTools = toolDefs.map((t) => ({
    type: "function" as const,
    function: {
      name: t.function_name,
      description: t.description,
      parameters: t.parameters,
    },
  }));

  const workingMessages = [...messages];
  let inputTokens = 0;
  let outputTokens = 0;
  const maxRounds = options?.max_rounds ?? 5;
  const toolsCalled: string[] = [];
  let lastToolError: string | null = null;
  const seenAcTaskKeys = new Set<string>();

  for (let round = 0; round < maxRounds; round++) {
    const toolChoice =
      options?.require_tool_use && round === 0
        ? "required"
        : "auto";

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: workingMessages,
        tools: openaiTools,
        tool_choice: toolChoice,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.max_tokens ?? 2000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API error: ${errText}`);
    }

    const data = await response.json();
    inputTokens += data.usage?.prompt_tokens ?? 0;
    outputTokens += data.usage?.completion_tokens ?? 0;

    const assistantMessage = data.choices?.[0]?.message;
    if (!assistantMessage) {
      throw new Error("No response from AI model");
    }

    const toolCalls = assistantMessage.tool_calls;
    if (!toolCalls?.length) {
      return {
        content: assistantMessage.content || "",
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        model: data.model || model,
        tools_called: toolsCalled,
        last_tool_error: lastToolError,
      };
    }

    workingMessages.push(assistantMessage);

    for (const toolCall of toolCalls) {
      const fnName = toolCall.function?.name;
      const def = toolDefs.find((d) => d.function_name === fnName);
      let toolResult: string;

      try {
        const args = JSON.parse(toolCall.function?.arguments || "{}");
        if (!def) {
          toolResult = `Error: Unknown tool ${fnName}`;
          lastToolError = toolResult;
        } else {
          toolsCalled.push(def.tool_name);
          toolResult = await executeTool(def.tool_id, args);
          if (options?.user_query) {
            toolResult = enrichActiveCollabToolResult(
              def.tool_name,
              toolResult,
              options.user_query,
              seenAcTaskKeys
            );
          }
          if (toolResult.startsWith("Error:")) {
            lastToolError = toolResult;
          }
        }
      } catch (err: unknown) {
        toolResult = `Error: ${err instanceof Error ? err.message : "Tool execution failed"}`;
        lastToolError = toolResult;
      }

      workingMessages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: toolResult,
      });
    }
  }

  return {
    content: "I reached the maximum number of tool calls for this request. Please try a simpler question.",
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    model,
    tools_called: toolsCalled,
    last_tool_error: lastToolError,
  };
}

// --- End agent MCP tools ---

interface ConversationChatRequest {
  conversation_id: string
  agent_id: string
  message: string
  user_id: string
  model_id?: string
  include_rag?: boolean
  max_history?: number
  memory_context?: string
}

function isIntegrationTaskQuery(message: string): boolean {
  const normalized = message.toLowerCase()
  const mentionsTask = /\btasks?\b/.test(normalized)
  const mentionsIntegration = /\b(clickup|click up|activecollab|active collab)\b/.test(normalized)
  return mentionsTask && mentionsIntegration
}

interface GraphContextNode {
  entity_type?: string
  display_name?: string
}

function normalizeEntityType(type?: string): string {
  return (type ?? '').toLowerCase()
}

function isMeetingEntity(type?: string): boolean {
  return normalizeEntityType(type) === 'meeting'
}

function isContactLikeEntity(type?: string): boolean {
  const t = normalizeEntityType(type)
  return t === 'customer' || t === 'contact' || t === 'client' || t === 'user'
}

function formatAgentGraphContext(nodes: GraphContextNode[]): string {
  if (!nodes.length) return ''
  const meetings = nodes.filter((n) => isMeetingEntity(n.entity_type) && n.display_name)
  const others = nodes.filter((n) => !isMeetingEntity(n.entity_type) && n.display_name)
  const lines: string[] = []
  if (meetings.length > 0) {
    lines.push('Meetings (authoritative — use ONLY these exact titles):')
    for (const m of meetings) {
      lines.push(`- ${m.display_name}`)
    }
  }
  for (const o of others) {
    lines.push(`- ${o.entity_type}: ${o.display_name}`)
  }
  return `[Graph Context]\n${lines.join('\n')}`
}

/** When graph has entities, build the answer in code so the LLM cannot hallucinate titles. */
function buildAnswerFromGraphNodes(nodes: GraphContextNode[], query: string): string | null {
  const meetings = nodes.filter((n) => isMeetingEntity(n.entity_type) && n.display_name)
  const related = nodes.filter((n) => isContactLikeEntity(n.entity_type) && n.display_name)
  if (meetings.length === 0 && related.length === 0) return null

  const q = query.toLowerCase()
  const wantsMeetings = /\bmeeting/.test(q)
  const wantsPeople = /\b(who is|contact|customer|connected|relationship|summarize)\b/.test(q)
  if (!wantsMeetings && !wantsPeople) return null

  const parts: string[] = []
  if (meetings.length > 0 && (wantsMeetings || wantsPeople)) {
    parts.push('### Meetings', ...meetings.map((m) => `- **${m.display_name}**`))
  }
  if (related.length > 0 && wantsPeople) {
    parts.push(
      '### Relationships',
      ...related.map((r) => `- **${r.display_name}** (${r.entity_type})`)
    )
  }
  if (parts.length === 0) return null
  parts.push('', '_Sourced from Graphify knowledge graph._')
  return parts.join('\n')
}

const GRAPH_PRIORITY_NOTE =
  '\n\nGRAPH RETRIEVAL RULE: The [Graph Context] block is authoritative for entity names (meetings, clients, contacts). List those exact display names. Never invent meeting titles or client names not listed in [Graph Context].\n'

const DEFAULT_GRAPH_TENANT_ID = '00000000-0000-0000-0000-000000000001'

async function isGraphifyOrgEnabled(supabaseClient: SupabaseClient): Promise<boolean> {
  const { data: flag } = await supabaseClient
    .from('app_config')
    .select('value')
    .eq('key', 'features.enableGraphify')
    .maybeSingle()
  const flagOn =
    flag?.value === true ||
    (typeof flag?.value === 'string' && ['true', '1', 'yes'].includes(flag.value.toLowerCase()))
  if (!flagOn) return false
  const { data: cfg } = await supabaseClient
    .from('graphify_config')
    .select('enabled')
    .eq('tenant_id', DEFAULT_GRAPH_TENANT_ID)
    .maybeSingle()
  return cfg?.enabled === true
}

async function fetchGraphContextDirect(
  supabaseClient: SupabaseClient,
  userId: string,
  query: string,
  tenantId: string = DEFAULT_GRAPH_TENANT_ID
): Promise<{ block: string; nodeCount: number; meetingCount: number; nodes: GraphContextNode[] }> {
  const rpcArgs = {
    p_tenant_id: tenantId,
    p_query: query,
    p_entity_types: null,
    p_limit: 10,
    p_caller_user_id: userId,
  }
  let matched: unknown[] | null = null
  let matchError: { message: string } | null = null
  {
    const res = await supabaseClient.rpc('graphify_match_entities', rpcArgs)
    matched = res.data as unknown[] | null
    matchError = res.error
  }
  if (matchError?.message?.includes('p_caller_user_id')) {
    const res = await supabaseClient.rpc('graphify_match_entities', {
      p_tenant_id: tenantId,
      p_query: query,
      p_entity_types: null,
      p_limit: 10,
    })
    matched = res.data as unknown[] | null
    matchError = res.error
  }
  if (matchError) {
    console.error('graphify_match_entities RPC error:', matchError.message)
    return { block: '', nodeCount: 0, meetingCount: 0, nodes: [] }
  }
  const seeds = (matched ?? []) as Array<{ id: string }>
  if (!seeds.length) {
    console.log('graphify_match_entities: 0 seed entities')
    return { block: '', nodeCount: 0, meetingCount: 0, nodes: [] }
  }

  const traverseArgs = {
    p_tenant_id: tenantId,
    p_seed_entity_ids: seeds.map((s) => s.id),
    p_max_depth: 2,
    p_relationship_types: null,
    p_max_nodes: 50,
    p_caller_user_id: userId,
  }
  let traversed: unknown[] | null = null
  let traverseError: { message: string } | null = null
  {
    const res = await supabaseClient.rpc('graphify_traverse', traverseArgs)
    traversed = res.data as unknown[] | null
    traverseError = res.error
  }
  if (traverseError?.message?.includes('p_caller_user_id')) {
    const res = await supabaseClient.rpc('graphify_traverse', {
      p_tenant_id: tenantId,
      p_seed_entity_ids: seeds.map((s) => s.id),
      p_max_depth: 2,
      p_relationship_types: null,
      p_max_nodes: 50,
    })
    traversed = res.data as unknown[] | null
    traverseError = res.error
  }
  if (traverseError) {
    console.error('graphify_traverse RPC error:', traverseError.message)
  }

  const nodes = (traversed ?? []) as GraphContextNode[]
  const seen = new Set<string>()
  const deduped = nodes.filter((n) => {
    const key = `${n.entity_type ?? ''}:${n.display_name ?? ''}`
    if (!n.display_name || seen.has(key)) return false
    seen.add(key)
    return true
  })
  const meetingCount = deduped.filter((n) => isMeetingEntity(n.entity_type)).length
  const formatted = formatAgentGraphContext(deduped)
  return {
    block: formatted ? `\n\n${formatted}\n` : '',
    nodeCount: deduped.length,
    meetingCount,
    nodes: deduped,
  }
}

async function fetchGraphContextForAgent(
  baseUrl: string,
  anonKey: string,
  authHeader: string,
  query: string
): Promise<{ block: string; nodeCount: number; meetingCount: number; nodes: GraphContextNode[] }> {
  const graphRes = await fetch(`${baseUrl}/functions/v1/graphify-query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
      ...(anonKey ? { apikey: anonKey } : {}),
    },
    body: JSON.stringify({ query, limit: 10 }),
  })
  if (!graphRes.ok) {
    const errText = await graphRes.text().catch(() => '')
    console.warn('graphify-query returned non-OK:', graphRes.status, errText.slice(0, 200))
    return { block: '', nodeCount: 0, meetingCount: 0, nodes: [] }
  }
  const graphBody = await graphRes.json()
  const nodes = [
    ...(Array.isArray(graphBody.context_nodes) ? graphBody.context_nodes : []),
    ...(Array.isArray(graphBody.entities) ? graphBody.entities : []),
  ] as GraphContextNode[]
  const seen = new Set<string>()
  const deduped = nodes.filter((n) => {
    const key = `${n.entity_type ?? ''}:${n.display_name ?? ''}`
    if (!n.display_name || seen.has(key)) return false
    seen.add(key)
    return true
  })
  const meetingCount = deduped.filter((n) => isMeetingEntity(n.entity_type)).length
  const formatted = formatAgentGraphContext(deduped)
  return {
    block: formatted ? `\n\n${formatted}\n` : '',
    nodeCount: deduped.length,
    meetingCount,
    nodes: deduped,
  }
}

function graphQueryFromMessage(message: string): string {
  const forMatch = message.match(/\bfor\s+(.+?)\s*\??\s*$/i)
  if (forMatch?.[1]?.trim()) return forMatch[1].trim()
  const aboutMatch = message.match(/\babout\s+(.+?)\s*\??\s*$/i)
  if (aboutMatch?.[1]?.trim()) return aboutMatch[1].trim()
  const whoMatch = message.match(/\bwho is\s+(.+?)\s*\??\s*$/i)
  if (whoMatch?.[1]?.trim()) return whoMatch[1].trim()
  return message
}

function shouldRequireMcpToolUse(message: string): boolean {
  if (isIntegrationTaskQuery(message)) return true
  const normalized = message.toLowerCase()
  const dataIntent = /\b(list|show|get|fetch|find|retrieve|give me)\b/.test(normalized)
  const taskOrProject =
    /\b(tasks?|project\s*id|project_id)\b/.test(normalized) ||
    /\bproject\s+\d+/.test(normalized)
  return dataIntent && taskOrProject
}

async function resolveOpenAiCredentials(
  supabaseClient: SupabaseClient,
  effectiveModelId?: string
): Promise<{ apiKey: string; modelId: string } | null> {
  let apiKey = await getApiKey(supabaseClient, "OPENAI_API_KEY");
  let modelId = "gpt-4o-mini";

  const model = await getModel(supabaseClient, effectiveModelId, "chat");
  if (model?.ai_providers?.slug === "openai") {
    const providerKey = await getApiKey(supabaseClient, model.ai_providers.api_key_secret_name);
    if (providerKey) apiKey = providerKey;
    modelId = model.model_id || modelId;
  }

  return apiKey ? { apiKey, modelId } : null;
}

function buildMcpToolSystemPrompt(toolDefs: AgentMcpToolDef[]): string {
  const toolLines = toolDefs
    .map((t) => {
      const props = (t.parameters.properties as Record<string, unknown>) ?? {};
      const required = Array.isArray(t.parameters.required) ? t.parameters.required.join(", ") : "";
      return `- ${t.tool_name}: ${t.description}${required ? ` (required: ${required})` : ""}`;
    })
    .join("\n");

  return [
    "MCP TOOLS — you MUST use these when the user asks for live ActiveCollab or API data:",
    toolLines,
    "Call the matching tool with parameters from the user message (project_id must be a number).",
    "For ac-get-all-tasks always pass limit: 100 (or higher) so assignee filters are not missed on large projects.",
    "For ac-get-user, pass emp_name with the person's name (partial match OK, e.g. \"Omkar\" or \"Omkar Shinde\").",
    "Tool results include a pre-filtered tasks array and summary — use those counts and rows for your table.",
    "",
    "ACTIVECOLLAB STATUS MAPPING (this instance — NOT literal open/in-progress):",
    "- Open: NOT SET, NEW",
    "- In Progress: ASSIGNED, PM REVIEW, IN PROGRESS",
    "- On Hold: ON HOLD (exclude unless user asks for on-hold)",
    "- Completed: LOG, COMPLETED, DONE",
    "- When user asks for open/in-progress, include ASSIGNED and NOT SET tasks — NOT only rows labeled open",
    "- Assignee match is partial/case-insensitive: \"Omkar Shinde\" matches \"omkar s.\"",
    "",
    "OUTPUT FORMAT (required for task list responses):",
    "1. Start with one summary line: Found {N} tasks for project {id} (filtered by {criteria}). N = matching_tasks from tool summary (already collapsed).",
    "2. Then a markdown table with columns: | Task | Status | Assignee | Due date |",
    "3. Task column MUST use markdown links: [Task Name](https://pm.sjinnovation.us/projects/{project_id}/tasks/{task_id})",
    "4. When duplicate_count > 1 on a task, show ONE row: [Title (×N)](primary url) — do not list each related_task_id as separate rows.",
    "5. Use display_status from tool results (Open, In Progress, On Hold, Completed).",
    "6. Sort by status (Open first, then In Progress), then by due date.",
    "7. Response = summary line + table only. No tool names, JSON, or extra paragraphs.",
    "Never say you cannot access the service — call the tool first, then format as above.",
    "If a tool returns an error, show the error details and suggest what parameter might be missing.",
  ].join("\n");
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startTime = Date.now()

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const {
      conversation_id,
      agent_id,
      message,
      user_id,
      model_id,
      include_rag = true,
      max_history = 20,
      memory_context = "",
    }: ConversationChatRequest = await req.json()

    // Validate required fields
    if (!conversation_id || !agent_id || !message || !user_id) {
      return new Response(
        JSON.stringify({ error: 'conversation_id, agent_id, message, and user_id are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // 1. Get agent configuration
    const { data: agent, error: agentError } = await supabaseClient
      .from('ai_agents')
      .select('*')
      .eq('id', agent_id)
      .single()

    if (agentError || !agent) {
      return new Response(
        JSON.stringify({ error: 'Agent not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // 2. Get user personalization if exists
    let additionalContext = ''
    const { data: personalization } = await supabaseClient
      .from('user_agent_personalizations')
      .select('additional_prompt, attached_knowledge_files, use_all_knowledge, max_context_files, relevance_threshold')
      .eq('user_id', user_id)
      .eq('agent_id', agent_id)
      .eq('is_enabled', true)
      .single()

    if (personalization?.additional_prompt) {
      additionalContext = personalization.additional_prompt
    }

    const serverIds = await resolveAgentMcpServerIds(
      supabaseClient,
      agent_id,
      Array.isArray(agent.mcp_server_ids) ? (agent.mcp_server_ids as string[]) : []
    )
    const mcpEnabled = serverIds.length > 0
    const liveMcpQuery = shouldRequireMcpToolUse(message)

    // Graph retrieval — runs whenever agent has Graphify on (not gated on RAG or MCP)
    let graphContextBlock = ''
    let graphPriorityNote = ''
    let graphMeetingCount = 0
    let graphPrefilledResponse: string | null = null

    if (agent.graphify_enabled === true && user_id) {
      const baseUrlForGraph = Deno.env.get('SUPABASE_URL')
      const anonKeyForGraph = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
      const incomingAuthForGraph = req.headers.get('Authorization')

      let graph = await fetchGraphContextDirect(
        supabaseClient,
        user_id,
        graphQueryFromMessage(message)
      )
      if (graph.nodeCount === 0 && incomingAuthForGraph && baseUrlForGraph) {
        const httpGraph = await fetchGraphContextForAgent(
          baseUrlForGraph,
          anonKeyForGraph,
          incomingAuthForGraph,
          graphQueryFromMessage(message)
        )
        if (httpGraph.nodeCount > 0) {
          graph = httpGraph
          console.log(`RAG graph (graphify-query fallback): nodes=${httpGraph.nodeCount}`)
        }
      }

      graphContextBlock = graph.block
      graphMeetingCount = graph.meetingCount
      graphPriorityNote = graphContextBlock ? GRAPH_PRIORITY_NOTE : ''
      graphPrefilledResponse = buildAnswerFromGraphNodes(graph.nodes, message)
      console.log(
        `RAG graph: nodes=${graph.nodeCount}, meetings=${graph.meetingCount}, prefilled=${Boolean(graphPrefilledResponse)}, agent.graphify_enabled=${agent.graphify_enabled}`
      )
    } else {
      console.warn(
        `Graphify skipped: agent.graphify_enabled=${agent.graphify_enabled}, user_id=${Boolean(user_id)}`
      )
    }

    // 3. Get RAG context (skip when MCP will fetch live integration data)
    let ragContext = ''
    let ragResultCount = 0
    let hadClickUpTaskSummary = false
    const integrationTaskQuery = isIntegrationTaskQuery(message)
    const shouldDoRag =
      (agent.rag_enabled === true || include_rag || integrationTaskQuery) &&
      !(mcpEnabled && liveMcpQuery)

    if (mcpEnabled && liveMcpQuery) {
      console.log('Skipping RAG — live MCP tool query will fetch authoritative data')
    }

    if (shouldDoRag) {
      try {
        const baseUrl = Deno.env.get('SUPABASE_URL')
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        if (baseUrl && serviceKey) {
          const ragThreshold = personalization?.relevance_threshold ?? 0.5
          const ragCount = personalization?.max_context_files ?? 8
          const normalizedMessage = message.toLowerCase()
          const isClickUpTaskCountQuery =
            /\bclickup\b/.test(normalizedMessage) &&
            /\btasks?\b/.test(normalizedMessage) &&
            /\b(how many|count|number of|total)\b/.test(normalizedMessage)

          // When agent has rag_enabled, search ALL embeddings (org-wide data like ClickUp tasks)
          // Only scope to user when explicitly not using all knowledge AND agent doesn't have rag_enabled
          const searchUserId = (agent.rag_enabled === true || personalization?.use_all_knowledge) ? null : user_id
          const useGraphify = agent.graphify_enabled === true
          console.log(`RAG search: query="${message.substring(0, 80)}", threshold=${ragThreshold}, count=${ragCount}, rag_enabled=${agent.rag_enabled}, graphify=${useGraphify}, searchUserId=${searchUserId}`)
          const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
          const incomingAuth = req.headers.get('Authorization')

          const semRes = await fetch(`${baseUrl}/functions/v1/semantic-search`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: incomingAuth ?? `Bearer ${serviceKey}`,
              ...(anonKey ? { apikey: anonKey } : {}),
            },
            body: JSON.stringify({
              query: message,
              match_threshold: ragThreshold,
              match_count: ragCount,
              entity_type: integrationTaskQuery ? 'task' : null,
              user_id: searchUserId,
              acting_user_id: user_id,
              // Graph context loaded via graphify-query (user JWT); vector-only here
              use_graphify: useGraphify && !graphContextBlock,
            }),
          })
          if (semRes.ok) {
            const semBody = await semRes.json()
            const rawDocs = semBody.results ?? []
            if (!graphContextBlock && semBody.graph_context) {
              graphContextBlock = `\n\n${semBody.graph_context}\n`
              graphPriorityNote = GRAPH_PRIORITY_NOTE
              const graphEntityCount = Array.isArray(semBody.graph_entities)
                ? semBody.graph_entities.length
                : 0
              console.log(
                `RAG graph (semantic-search fallback): entities=${graphEntityCount}, context_chars=${graphContextBlock.length}`
              )
            }
            let relevantDocs = integrationTaskQuery
              ? rawDocs.filter((doc: { metadata?: { source?: string } }) => {
                  const source = doc.metadata?.source?.toLowerCase()
                  return source === 'clickup' || source === 'activecollab'
                })
              : rawDocs

            // When graph lists meetings, vector snippets often cause title hallucinations — trust graph names
            const isGraphEntityQuestion =
              graphMeetingCount > 0 &&
              /\b(meeting|client|contact|customer|who is|connected|relationship|richardson)\b/i.test(message)
            if (isGraphEntityQuestion) {
              console.log('RAG: omitting vector docs — graph has authoritative meeting entities')
              relevantDocs = []
            }

            ragResultCount = relevantDocs.length
            console.log(`RAG search returned ${relevantDocs.length} results`)

            let ragSummary = ''
            if (isClickUpTaskCountQuery) {
              const { count: clickUpTaskEmbeddingCount, error: clickUpCountError } = await supabaseClient
                .from('embeddings')
                .select('id', { count: 'exact', head: true })
                .eq('entity_type', 'task')
                .contains('metadata', { source: 'clickup' })

              if (clickUpCountError) {
                console.error('ClickUp task embedding count error:', clickUpCountError)
              } else if (typeof clickUpTaskEmbeddingCount === 'number') {
                hadClickUpTaskSummary = true
                ragSummary = [
                  'RETRIEVED DATA SUMMARY:',
                  `- Total ClickUp task embeddings currently available: ${clickUpTaskEmbeddingCount}`,
                  '- If the user asks how many ClickUp tasks exist, use this exact total in the answer.',
                ].join('\n')
              }
            }

            if (relevantDocs.length > 0 || ragSummary) {
              ragContext = graphContextBlock
                + graphPriorityNote
                + '\n\nRELEVANT CONTEXT (from knowledge base):\nYou MUST answer from the retrieved context below when it is relevant. Treat the retrieved records and summaries as authoritative. If a summary includes an exact total, use that total directly in your answer. Only say the context is insufficient when there is truly no relevant context.\n\n'
                + (ragSummary ? `${ragSummary}\n\n` : '')
                + relevantDocs
                  .map((doc: { content?: string; entity_type?: string; similarity?: number; metadata?: { source?: string } }, i: number) => {
                    const source = doc.metadata?.source ?? doc.entity_type ?? 'unknown'
                    return `[${i + 1}] (${source}, relevance: ${(doc.similarity ?? 0).toFixed(2)})\n${doc.content ?? ''}`
                  })
                  .join('\n\n')
            } else if (graphContextBlock) {
              ragContext = graphContextBlock
                + graphPriorityNote
                + '\n\nINSTRUCTIONS: Answer using the [Graph Context] entities above. List meeting, client, and contact names exactly as shown. Do not invent entities that are not in the graph context.\n'
            }
          } else {
            console.warn('RAG semantic search returned non-OK:', semRes.status)
            if (graphContextBlock) {
              ragContext = graphContextBlock
                + graphPriorityNote
                + '\n\nINSTRUCTIONS: Answer using the [Graph Context] entities above. List meeting, client, and contact names exactly as shown. Do not invent entities that are not in the graph context.\n'
            }
          }
        }
      } catch (ragError) {
        console.error('RAG search error:', ragError)
      }
    }

    // 4. Get conversation history
    const { data: history } = await supabaseClient
      .from('agent_messages')
      .select('role, content')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: true })
      .limit(max_history)

    // 5. Build messages array
    const systemPrompt = [
      agent.system_prompt,
      additionalContext,
      memory_context,
      ragContext,
    ].filter(Boolean).join('\n\n')

    const messages: { role: 'user' | 'assistant' | 'system'; content: string }[] = [
      { role: 'system', content: systemPrompt }
    ]

    // Add conversation history (user message was already inserted by the client)
    if (history && history.length > 0) {
      messages.push(
        ...history
          .filter((h: { role: string }) => h.role !== 'system')
          .map((h: { role: string; content: string }) => ({
            role: h.role as 'user' | 'assistant',
            content: h.content,
          }))
      )
    }

    const lastMessage = history?.[history.length - 1]
    const userMessageAlreadyInHistory =
      lastMessage?.role === 'user' && lastMessage?.content === message

    if (!userMessageAlreadyInHistory) {
      messages.push({ role: 'user', content: message })
    }

    // 6. Get provider config from agent or use defaults
    const providerConfig = agent.provider_config || {}
    const temperature = providerConfig.temperature ?? 0.7
    const maxTokens = providerConfig.max_tokens ?? 2000

    const effectiveModelId = await resolveEffectiveModelId(supabaseClient, model_id)

    let mcpToolsUsed = 0
    let mcpPathUsed = false
    let mcpToolError: string | null = null
    let mcpToolsCalled: string[] = []
    let response: Awaited<ReturnType<typeof chatCompletion>>

    if (graphPrefilledResponse) {
      console.log('Returning deterministic Graphify answer (bypassing LLM/MCP)')
      response = {
        content: graphPrefilledResponse,
        input_tokens: 0,
        output_tokens: 0,
        model: 'graphify-direct',
      }
    } else if (mcpEnabled) {
      const toolDefs = await loadAgentMcpToolDefs(supabaseClient, serverIds)
      mcpToolsUsed = toolDefs.length
      const openaiCreds = await resolveOpenAiCredentials(supabaseClient, effectiveModelId)

      if (toolDefs.length > 0 && openaiCreds) {
        mcpPathUsed = true
        const mcpMessages: McpChatMessage[] = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }))

        if (mcpMessages[0]?.role === "system") {
          mcpMessages[0].content = `${mcpMessages[0].content}\n\n${buildMcpToolSystemPrompt(toolDefs)}`
        }

        try {
          const mcpResponse = await chatWithMcpToolsOpenAI(
            openaiCreds.apiKey,
            openaiCreds.modelId,
            mcpMessages,
            toolDefs,
            (toolId, args) =>
              executeAgentMcpToolDirect(supabaseClient, toolId, args, user_id, agent_id, conversation_id),
            {
              max_tokens: maxTokens,
              temperature,
              require_tool_use: shouldRequireMcpToolUse(message),
              user_query: message,
            }
          )

          mcpToolsCalled = mcpResponse.tools_called
          if (mcpResponse.last_tool_error) {
            mcpToolError = mcpResponse.last_tool_error
          }

          response = {
            content: mcpResponse.content,
            input_tokens: mcpResponse.input_tokens,
            output_tokens: mcpResponse.output_tokens,
            model: mcpResponse.model,
          }
        } catch (mcpErr: unknown) {
          mcpToolError = mcpErr instanceof Error ? mcpErr.message : "MCP tool execution failed";
          console.error("MCP chat error:", mcpToolError);
          response = await chatCompletion(
            supabaseClient,
            { messages, max_tokens: maxTokens, temperature },
            effectiveModelId,
            user_id,
          );
        }
      } else {
        if (toolDefs.length > 0) {
          const toolSummary = toolDefs
            .map((t) => `- ${t.tool_name}: ${t.description}`)
            .join('\n')
          messages[0].content += `\n\nATTACHED MCP TOOLS:\n${toolSummary}\nOpenAI API key is required in Supabase secrets (OPENAI_API_KEY) for automatic tool execution.`
          mcpToolError = openaiCreds ? "No tools loaded" : "OPENAI_API_KEY not configured for MCP tool calling"
        } else {
          mcpToolError = "No enabled tools found on attached MCP servers"
        }
        response = await chatCompletion(
          supabaseClient,
          { messages, max_tokens: maxTokens, temperature },
          effectiveModelId,
          user_id,
        )
      }
    } else {
      response = await chatCompletion(
        supabaseClient,
        {
          messages,
          max_tokens: maxTokens,
          temperature,
        },
        effectiveModelId,
        user_id,
      )
    }

    const latency = Date.now() - startTime

    // 8. Get the model for cost calculation and logging
    const model = await getModel(supabaseClient, effectiveModelId, 'chat')
    if (!model) {
      throw new Error('Model not found')
    }

    // 9. Calculate cost
    const cost = calculateCost(model, response.input_tokens, response.output_tokens, 0)

    // 10. Log usage
    await logUsage(
      supabaseClient,
      user_id,
      model.id,
      'agent-conversation-chat',
      response.input_tokens,
      response.output_tokens,
      0,
      cost,
      { agent_id, conversation_id }
    )

    // 11. Update agent usage count
    await supabaseClient
      .from('ai_agents')
      .update({ usage_count: (agent.usage_count || 0) + 1 })
      .eq('id', agent_id)

    return new Response(
      JSON.stringify({
        response: response.content,
        model_used: response.model,
        provider_used: model.ai_providers?.slug || 'unknown',
        tokens_input: response.input_tokens,
        tokens_output: response.output_tokens,
        latency_ms: latency,
        estimated_cost: cost,
        citations: [], // TODO: Extract citations from RAG context
        metadata: {
          conversation_id,
          agent_id,
          had_rag_context: ragContext.length > 0,
          rag_result_count: ragResultCount,
          had_clickup_task_summary: hadClickUpTaskSummary,
          history_count: history?.length || 0,
          mcp_enabled: mcpEnabled,
          mcp_tools_available: mcpToolsUsed,
          mcp_path_used: mcpPathUsed,
          mcp_tool_error: mcpToolError,
          mcp_tools_called: mcpToolsCalled,
          mcp_server_ids: serverIds,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    console.error('Agent conversation chat error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
