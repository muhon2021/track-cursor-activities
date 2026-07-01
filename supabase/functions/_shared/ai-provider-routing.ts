import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { normalizeAIModelPolicy } from './ai-model-policy.ts'

export interface AIModel {
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

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface ChatCompletionRequest {
  messages: ChatMessage[]
  model?: string
  max_tokens?: number
  temperature?: number
  stream?: boolean
}

export interface ChatCompletionResponse {
  content: string
  input_tokens: number
  output_tokens: number
  model: string
}

export interface EmbeddingRequest {
  input: string
  model?: string
}

export interface EmbeddingResponse {
  embedding: number[]
  tokens: number
  model: string
}

// Get API key from environment or app_config
async function getApiKey(
  supabase: SupabaseClient,
  secretName: string
): Promise<string | null> {
  // First try environment variable
  const envKey = Deno.env.get(secretName)
  if (envKey) return envKey

  // Fallback to app_config
  const { data, error } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', `integrations.${secretName.toLowerCase()}`)
    .single()

  if (error || !data) return null
  return data.value
}

// Get model by ID or get default model for category
export async function getModel(
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

      if (!policyError && policyModel) {
        return policyModel as AIModel
      }
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

// Chat completion with OpenAI
async function chatOpenAI(
  apiKey: string,
  request: ChatCompletionRequest
): Promise<ChatCompletionResponse> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: request.model || 'gpt-4o-mini',
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.max_tokens ?? 1000,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI API error: ${error}`)
  }

  const data = await response.json()
  return {
    content: data.choices[0].message.content,
    input_tokens: data.usage.prompt_tokens,
    output_tokens: data.usage.completion_tokens,
    model: data.model,
  }
}

// Chat completion with Anthropic Claude
async function chatAnthropic(
  apiKey: string,
  request: ChatCompletionRequest
): Promise<ChatCompletionResponse> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: request.model || 'claude-sonnet-4-20250514',
      messages: request.messages.filter((m) => m.role !== 'system'),
      system: request.messages.find((m) => m.role === 'system')?.content,
      max_tokens: request.max_tokens ?? 1000,
      temperature: request.temperature ?? 0.7,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Anthropic API error: ${error}`)
  }

  const data = await response.json()
  return {
    content: data.content[0].text,
    input_tokens: data.usage.input_tokens,
    output_tokens: data.usage.output_tokens,
    model: data.model,
  }
}

// Chat completion with Google Gemini
async function chatGoogle(
  apiKey: string,
  request: ChatCompletionRequest
): Promise<ChatCompletionResponse> {
  const model = request.model || 'gemini-2.5-flash'
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: request.messages
          .filter((m) => m.role !== 'system')
          .map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
          })),
        generationConfig: {
          temperature: request.temperature ?? 0.7,
          maxOutputTokens: request.max_tokens ?? 1000,
        },
      }),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Google AI API error: ${error}`)
  }

  const data = await response.json()
  const content = data.candidates[0].content.parts[0].text

  // Google doesn't always return token counts, estimate them
  const inputTokens = data.usageMetadata?.promptTokenCount || Math.ceil(JSON.stringify(request.messages).length / 4)
  const outputTokens = data.usageMetadata?.candidatesTokenCount || Math.ceil(content.length / 4)

  return {
    content,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    model: model,
  }
}

// Chat completion with Perplexity
async function chatPerplexity(
  apiKey: string,
  request: ChatCompletionRequest
): Promise<ChatCompletionResponse> {
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: request.model || 'sonar',
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.max_tokens ?? 1000,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Perplexity API error: ${error}`)
  }

  const data = await response.json()
  return {
    content: data.choices[0].message.content,
    input_tokens: data.usage.prompt_tokens,
    output_tokens: data.usage.completion_tokens,
    model: data.model,
  }
}

// Route chat completion to appropriate provider
export async function chatCompletion(
  supabase: SupabaseClient,
  request: ChatCompletionRequest,
  modelId?: string
): Promise<ChatCompletionResponse> {
  // Get the model — try default first, then any enabled chat model
  let model = await getModel(supabase, modelId, 'chat')

  // Fallback: if no default model, pick the first enabled chat model
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

  // Final fallback: use Lovable AI gateway if available
  if (!model || !model.ai_providers) {
    const lovableKey = Deno.env.get('LOVABLE_API_KEY')
    if (lovableKey) {
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: request.messages,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.max_tokens ?? 1000,
        }),
      })
      if (!response.ok) {
        const err = await response.text()
        throw new Error(`Lovable AI error: ${err}`)
      }
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

  // Get API key
  const apiKey = await getApiKey(supabase, model.ai_providers.api_key_secret_name)
  if (!apiKey) {
    throw new Error(`API key not configured for ${model.ai_providers.name}`)
  }

  // Route to appropriate provider
  const provider = model.ai_providers.slug
  const requestWithModel = { ...request, model: model.model_id }

  let response: ChatCompletionResponse
  switch (provider) {
    case 'openai':
      response = await chatOpenAI(apiKey, requestWithModel)
      break
    case 'anthropic':
      response = await chatAnthropic(apiKey, requestWithModel)
      break
    case 'google':
      response = await chatGoogle(apiKey, requestWithModel)
      break
    case 'perplexity':
      response = await chatPerplexity(apiKey, requestWithModel)
      break
    default:
      throw new Error(`Unsupported provider: ${provider}`)
  }

  return response
}

// Embedding with OpenAI
async function embeddingOpenAI(
  apiKey: string,
  request: EmbeddingRequest
): Promise<EmbeddingResponse> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: request.model || 'text-embedding-3-small',
      input: request.input,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI API error: ${error}`)
  }

  const data = await response.json()
  return {
    embedding: data.data[0].embedding,
    tokens: data.usage.total_tokens,
    model: data.model,
  }
}

// Embedding with Google
async function embeddingGoogle(
  apiKey: string,
  request: EmbeddingRequest
): Promise<EmbeddingResponse> {
  const model = request.model || 'text-embedding-004'
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/${model}:embedContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: {
          parts: [{ text: request.input }],
        },
      }),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Google AI API error: ${error}`)
  }

  const data = await response.json()

  // Estimate tokens for Google (they don't return token count)
  const tokens = Math.ceil(request.input.length / 4)

  return {
    embedding: data.embedding.values,
    tokens,
    model: model,
  }
}

// Route embedding to appropriate provider
export async function generateEmbedding(
  supabase: SupabaseClient,
  input: string,
  modelId?: string
): Promise<EmbeddingResponse> {
  // Get the model
  const model = await getModel(supabase, modelId, 'embedding')
  if (!model || !model.ai_providers) {
    throw new Error('No valid embedding model found')
  }

  // Get API key
  const apiKey = await getApiKey(supabase, model.ai_providers.api_key_secret_name)
  if (!apiKey) {
    throw new Error(`API key not configured for ${model.ai_providers.name}`)
  }

  // Route to appropriate provider
  const provider = model.ai_providers.slug
  const request: EmbeddingRequest = { input, model: model.model_id }

  let response: EmbeddingResponse
  switch (provider) {
    case 'openai':
      response = await embeddingOpenAI(apiKey, request)
      break
    case 'google':
      response = await embeddingGoogle(apiKey, request)
      break
    default:
      throw new Error(`Unsupported embedding provider: ${provider}`)
  }

  return response
}

// Log AI usage
export async function logUsage(
  supabase: SupabaseClient,
  userId: string | null,
  modelId: string | null,
  functionName: string,
  inputTokens: number,
  outputTokens: number,
  embeddingTokens: number,
  estimatedCost: number
): Promise<void> {
  const { error } = await supabase.from('ai_usage_logs').insert({
    user_id: userId,
    model_id: modelId,
    function_name: functionName,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    embedding_tokens: embeddingTokens,
    estimated_cost: estimatedCost,
  })

  if (error) {
    console.error('Failed to log AI usage:', error)
  }
}

// Calculate cost based on model and tokens
export function calculateCost(
  model: AIModel,
  inputTokens: number,
  outputTokens: number,
  embeddingTokens: number
): number {
  const inputCost = (inputTokens / 1000) * model.input_cost_per_1k
  const outputCost = (outputTokens / 1000) * model.output_cost_per_1k
  const embeddingCost = (embeddingTokens / 1000) * model.embedding_cost_per_1k
  return inputCost + outputCost + embeddingCost
}
