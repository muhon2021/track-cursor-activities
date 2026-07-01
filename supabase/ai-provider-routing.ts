/**
 * AI Provider Routing Module
 *
 * Multi-provider AI agent execution with automatic fallback chains.
 * Supports: OpenAI, Anthropic (Claude), Google Gemini, Perplexity
 *
 * Features:
 * - Automatic fallback on provider failure
 * - Telemetry tracking for all attempts
 * - Credential management from database + env vars
 * - Normalized response format across providers
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// ============================================================================
// Types
// ============================================================================

export type ProviderName = 'openai' | 'anthropic' | 'gemini' | 'perplexity';

export interface ProviderConfig {
  provider: ProviderName;
  model: string;
  temperature?: number;
  maxOutputTokens?: number;
  reasoning_effort?: 'low' | 'medium' | 'high';  // For O3/O4 reasoning models
  topP?: number;
  reasoningEffort?: 'low' | 'medium' | 'high';
}

export interface AgentProviderConfig {
  primary: ProviderConfig;
  fallbacks?: ProviderConfig[];
  research?: ProviderConfig[];
}

export interface ProviderCredentials {
  openai?: {
    apiKey: string;
    baseUrl?: string;
  };
  anthropic?: {
    apiKey: string;
    baseUrl?: string;
  };
  gemini?: {
    apiKey: string;
  };
  perplexity?: {
    apiKey: string;
  };
}

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ProviderTelemetry {
  provider: ProviderName;
  model: string;
  latencyMs: number;
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  error?: string;
  timestamp: string;
}

export interface ProviderResult {
  content: string;
  telemetry: ProviderTelemetry[];
  provider: ProviderConfig & { purpose: string };
  rawResponse: any;
}

export interface ExecuteOptions {
  supabase: SupabaseClient;
  messages: Message[];
  providerConfig: AgentProviderConfig;
  functionName: string;
}

const DEFAULT_PARAMS = {
  temperature: 0.2,
  maxOutputTokens: 2000,
  topP: 0.95,
  reasoningEffort: 'medium' as const,
};

const LAST_RESORT_PROVIDER: ProviderConfig & { purpose: string } = {
  provider: 'openai',
  model: 'gpt-4o-mini',
  temperature: DEFAULT_PARAMS.temperature,
  maxOutputTokens: DEFAULT_PARAMS.maxOutputTokens,
  purpose: 'last-resort',
};

// ============================================================================
// Configuration Extraction
// ============================================================================

/**
 * Extracts provider configuration from agent config
 */
export function extractProviderConfig(agentConfig: any): AgentProviderConfig {
  const providerRouting = agentConfig?.providerRouting;

  if (!providerRouting || !providerRouting.primary) {
    // Default configuration
    return {
      primary: {
        provider: 'openai',
        model: 'gpt-4o-mini',
        temperature: 0.2,
        maxOutputTokens: 2000,
      },
      fallbacks: [
        {
          provider: 'openai',
          model: 'gpt-4o',
          temperature: 0.2,
        },
      ],
    };
  }

  return {
    primary: providerRouting.primary,
    fallbacks: providerRouting.fallbacks || [],
    research: providerRouting.research || [],
  };
}

function normalizeProviderParams(config: ProviderConfig): ProviderConfig {
  return {
    temperature: DEFAULT_PARAMS.temperature,
    maxOutputTokens: DEFAULT_PARAMS.maxOutputTokens,
    topP: DEFAULT_PARAMS.topP,
    reasoningEffort: DEFAULT_PARAMS.reasoningEffort,
    ...config,
  };
}

function buildProviderChain(config: AgentProviderConfig) {
  const chain: Array<ProviderConfig & { purpose: string }> = [
    { ...normalizeProviderParams(config.primary), purpose: 'primary' },
    ...(config.fallbacks || []).map((fb, i) => ({
      ...normalizeProviderParams(fb),
      purpose: `fallback-${i + 1}`,
    })),
  ];

  const hasLastResort = chain.some(
    (p) => p.provider === LAST_RESORT_PROVIDER.provider && p.model === LAST_RESORT_PROVIDER.model
  );

  if (!hasLastResort) {
    chain.push(LAST_RESORT_PROVIDER);
  }

  return chain;
}

// ============================================================================
// Credential Management
// ============================================================================

/**
 * Loads provider credentials from database with environment variable fallback
 */
export async function hydrateProviderCredentials(
  supabase: SupabaseClient,
  providers: ProviderName[]
): Promise<ProviderCredentials> {
  const credentials: ProviderCredentials = {};

  // Try to load from database first
  try {
    const { data, error } = await supabase
      .from('ai_configurations')
      .select('configuration_data')
      .eq('configuration_type', 'provider_credentials')
      .single();

    if (data && !error) {
      const dbCreds = data.configuration_data;

      // Load requested providers from database
      for (const provider of providers) {
        if (dbCreds[provider]?.apiKey) {
          credentials[provider] = dbCreds[provider];
        }
      }
    }
  } catch (e) {
    console.warn('Failed to load credentials from database:', e);
  }

  // Fallback to environment variables
  for (const provider of providers) {
    if (!credentials[provider]) {
      const envKey = getProviderEnvKey(provider);
      const apiKey = Deno.env.get(envKey);

      if (apiKey) {
        credentials[provider] = { apiKey };

        // Add base URLs if needed
        if (provider === 'openai') {
          credentials[provider]!.baseUrl = 'https://api.openai.com/v1';
        } else if (provider === 'anthropic') {
          credentials[provider]!.baseUrl = 'https://api.anthropic.com';
        }
      }
    }
  }

  return credentials;
}

function getProviderEnvKey(provider: ProviderName): string {
  switch (provider) {
    case 'openai':
      return 'OPENAI_API_KEY';
    case 'anthropic':
      return 'ANTHROPIC_API_KEY';
    case 'gemini':
      return 'GEMINI_API_KEY';
    case 'perplexity':
      return 'PERPLEXITY_API_KEY';
  }
}

// ============================================================================
// Main Execution with Fallbacks
// ============================================================================

/**
 * Executes AI request with automatic fallback chain
 */
export async function executeWithFallbacks(
  options: ExecuteOptions
): Promise<ProviderResult> {
  const { supabase, messages, providerConfig, functionName } = options;
  const telemetry: ProviderTelemetry[] = [];

  // Build provider chain: primary → fallbacks → research → last resort
  const providerChain: Array<ProviderConfig & { purpose: string }> = [
    { ...providerConfig.primary, purpose: 'primary' },
    ...(providerConfig.fallbacks || []).map((fb, i) => ({
      ...fb,
      purpose: `fallback-${i + 1}`,
    })),
    ...(providerConfig.research || []).map((rs, i) => ({
      ...rs,
      purpose: `research-${i + 1}`,
    })),
  ];

  // Add last resort (GPT-4o-mini) if not already in chain
  const hasGpt4oMini = providerChain.some(
    (p) => p.provider === 'openai' && p.model === 'gpt-4o-mini'
  );
  if (!hasGpt4oMini) {
    providerChain.push({
      provider: 'openai',
      model: 'gpt-4o-mini',
      temperature: 0.2,
      purpose: 'last-resort',
    });
  }

  // Get unique providers needed
  const providersNeeded = Array.from(
    new Set(providerChain.map((p) => p.provider))
  );

  // Load credentials for all providers
  const credentials = await hydrateProviderCredentials(
    supabase,
    providersNeeded
  );

  // Capture missing credentials as telemetry and skip them
  const runnableProviders = providerChain.filter((provider) => {
    const credential = credentials[provider.provider as keyof ProviderCredentials];
    if (!credential) {
      telemetry.push({
        provider: provider.provider,
        model: provider.model,
        latencyMs: 0,
        error: `Missing credentials for ${provider.provider}`,
        timestamp: new Date().toISOString(),
      });
    }

    return Boolean(credential);
  });

  const hasLastResortCredential = Boolean(credentials.openai?.apiKey);

  if (!hasLastResortCredential) {
    throw new Error(
      'OpenAI credentials are required to keep the last-resort model available.'
    );
  }

  if (runnableProviders.length === 0) {
    throw new Error('No provider credentials available. Configure at least one API key.');
  }

  // Try each provider in chain
  for (const providerConfig of runnableProviders) {
    const startTime = Date.now();

    try {
      console.log(
        `[${functionName}] Attempting ${providerConfig.provider} (${providerConfig.model}) - ${providerConfig.purpose}`
      );

      const credential = credentials[providerConfig.provider];
      const normalizedConfig = normalizeProviderParams(providerConfig);

      // Call the appropriate provider
      const result = await callProvider(
        messages,
        normalizedConfig,
        credential,
        functionName
      );

      const latency = Date.now() - startTime;

      // Success! Record telemetry and return
      telemetry.push({
        provider: providerConfig.provider,
        model: providerConfig.model,
        latencyMs: latency,
        tokenUsage: result.tokenUsage,
        timestamp: new Date().toISOString(),
      });

      console.log(
        `[${functionName}] ✅ Success with ${providerConfig.provider} (${latency}ms)`
      );

      return {
        content: result.content,
        telemetry,
        provider: providerConfig,
        rawResponse: result.rawResponse,
      };
    } catch (error: any) {
      const latency = Date.now() - startTime;

      // Record failed attempt
      telemetry.push({
        provider: providerConfig.provider,
        model: providerConfig.model,
        latencyMs: latency,
        error: error.message,
        timestamp: new Date().toISOString(),
      });

      console.error(
        `[${functionName}] ❌ Failed with ${providerConfig.provider}: ${error.message}`
      );

      // Continue to next provider in chain
      continue;
    }
  }

  // All providers failed
  const finalError = new Error(
    `All providers failed. Attempts: ${telemetry.length}. Last error: ${
      telemetry[telemetry.length - 1]?.error
    }`
  ) as Error & { telemetry?: ProviderTelemetry[] };

  // Attach telemetry so callers can persist diagnostic details
  finalError.telemetry = telemetry;

  throw finalError;
}

// ============================================================================
// Provider Callers
// ============================================================================

interface ProviderCallResult {
  content: string;
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  rawResponse: any;
}

async function callProvider(
  messages: Message[],
  config: ProviderConfig,
  credential: any,
  functionName: string
): Promise<ProviderCallResult> {
  switch (config.provider) {
    case 'openai':
      return callOpenAIProvider(messages, config, credential, functionName);
    case 'anthropic':
      return callAnthropic(messages, config, credential, functionName);
    case 'gemini':
      return callGemini(messages, config, credential, functionName);
    case 'perplexity':
      return callPerplexity(messages, config, credential, functionName);
    default:
      throw new Error(`Unsupported provider: ${config.provider}`);
  }
}

// ----------------------------------------------------------------------------
// OpenAI
// ----------------------------------------------------------------------------

async function callOpenAIProvider(
  messages: Message[],
  config: ProviderConfig,
  credential: { apiKey: string; baseUrl?: string },
  functionName: string
): Promise<ProviderCallResult> {
  const baseUrl = credential.baseUrl || 'https://api.openai.com/v1';

  // Detect model type for parameter handling
  const isGPT5Family = config.model.startsWith('gpt-5');
  const isReasoningModel = ['o3-mini', 'o4', 'o1', 'o1-mini'].includes(config.model);

  // Build request body based on model type
  const requestBody: any = {
    model: config.model,
    messages: messages,
  };

  // Reasoning models use reasoning_effort instead of temperature
  if (isReasoningModel) {
    requestBody.reasoning_effort = config.reasoning_effort || 'medium';
  } else {
    requestBody.temperature = config.temperature || 0.2;
    requestBody.top_p = config.topP || 0.95;
  }

  // GPT-5 family uses max_completion_tokens, others use max_tokens
  if (isGPT5Family) {
    requestBody.max_completion_tokens = config.maxOutputTokens || 2000;
  } else {
    requestBody.max_tokens = config.maxOutputTokens || 2000;
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${credential.apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `OpenAI API error (${response.status}): ${errorText}`
    );
  }

  const data = await response.json();

  return {
    content: data.choices[0].message.content,
    tokenUsage: {
      promptTokens: data.usage?.prompt_tokens,
      completionTokens: data.usage?.completion_tokens,
      totalTokens: data.usage?.total_tokens,
    },
    rawResponse: data,
  };
}

// ----------------------------------------------------------------------------
// Anthropic (Claude)
// ----------------------------------------------------------------------------

async function callAnthropic(
  messages: Message[],
  config: ProviderConfig,
  credential: { apiKey: string; baseUrl?: string },
  functionName: string
): Promise<ProviderCallResult> {
  const baseUrl = credential.baseUrl || 'https://api.anthropic.com';

  // Convert messages to Anthropic format (separate system message)
  const systemMessage = messages.find((m) => m.role === 'system')?.content || '';
  const conversationMessages = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role,
      content: m.content,
    }));

  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': credential.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.model,
      messages: conversationMessages,
      system: systemMessage,
      temperature: config.temperature ?? DEFAULT_PARAMS.temperature,
      max_tokens: config.maxOutputTokens ?? DEFAULT_PARAMS.maxOutputTokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Anthropic API error (${response.status}): ${errorText}`
    );
  }

  const data = await response.json();

  return {
    content: data.content[0].text,
    tokenUsage: {
      promptTokens: data.usage?.input_tokens,
      completionTokens: data.usage?.output_tokens,
      totalTokens:
        (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
    },
    rawResponse: data,
  };
}

// ----------------------------------------------------------------------------
// Google Gemini
// ----------------------------------------------------------------------------

async function callGemini(
  messages: Message[],
  config: ProviderConfig,
  credential: { apiKey: string },
  functionName: string
): Promise<ProviderCallResult> {
  // Convert messages to Gemini format
  const systemMessage = messages.find((m) => m.role === 'system')?.content || '';
  const conversationMessages = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  // Prepend system message as first user message if present
  if (systemMessage) {
    conversationMessages.unshift({
      role: 'user',
      parts: [{ text: `System Instructions:\n${systemMessage}` }],
    });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${credential.apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: conversationMessages,
      generationConfig: {
        temperature: config.temperature ?? DEFAULT_PARAMS.temperature,
        maxOutputTokens: config.maxOutputTokens ?? DEFAULT_PARAMS.maxOutputTokens,
        topP: config.topP ?? DEFAULT_PARAMS.topP,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Gemini API error (${response.status}): ${errorText}`
    );
  }

  const data = await response.json();

  return {
    content: data.candidates[0].content.parts[0].text,
    tokenUsage: {
      promptTokens: data.usageMetadata?.promptTokenCount,
      completionTokens: data.usageMetadata?.candidatesTokenCount,
      totalTokens: data.usageMetadata?.totalTokenCount,
    },
    rawResponse: data,
  };
}

// ----------------------------------------------------------------------------
// Perplexity
// ----------------------------------------------------------------------------

async function callPerplexity(
  messages: Message[],
  config: ProviderConfig,
  credential: { apiKey: string },
  functionName: string
): Promise<ProviderCallResult> {
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${credential.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: messages,
      temperature: config.temperature ?? DEFAULT_PARAMS.temperature,
      max_tokens: config.maxOutputTokens ?? DEFAULT_PARAMS.maxOutputTokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Perplexity API error (${response.status}): ${errorText}`
    );
  }

  const data = await response.json();

  return {
    content: data.choices[0].message.content,
    tokenUsage: {
      promptTokens: data.usage?.prompt_tokens,
      completionTokens: data.usage?.completion_tokens,
      totalTokens: data.usage?.total_tokens,
    },
    rawResponse: data,
  };
}

// ============================================================================
// Response Normalization
// ============================================================================

export interface AgentFinding {
  title: string;
  detail: string;
  metric?: string;
}

export interface AgentActionItem {
  title: string;
  description: string;
  owner?: string;
  dueDate?: string;
  priority: 'high' | 'medium' | 'low';
}

export interface StructuredAgentResponse {
  summary: string;
  findings: AgentFinding[];
  recommendations: string[];
  actionItems: AgentActionItem[];
  followUpQuestions?: string[];
  telemetry?: ProviderTelemetry[];
  provider?: ProviderConfig & { purpose?: string };
  rawText: string;
  parsingErrors?: string[];
  validationErrors?: string[];
}

/**
 * Normalizes AI response to structured format
 */
export function normalizeAgentResponse(
  rawContent: string,
  metadata?: { telemetry?: ProviderTelemetry[]; provider?: ProviderConfig & { purpose?: string } }
): StructuredAgentResponse {
  const safeRawText = typeof rawContent === 'string' ? rawContent.trim() : '';

  const baseResponse: StructuredAgentResponse = {
    summary: safeRawText || 'No summary provided',
    findings: [],
    recommendations: [],
    actionItems: [],
    followUpQuestions: [],
    telemetry: metadata?.telemetry,
    provider: metadata?.provider,
    rawText: safeRawText,
    parsingErrors: [],
    validationErrors: [],
  };

  try {
    const jsonCandidate = extractJsonCandidate(safeRawText);
    let parsed: any = null;

    if (jsonCandidate) {
      try {
        parsed = JSON.parse(jsonCandidate);
      } catch (jsonError: any) {
        baseResponse.parsingErrors?.push(`JSON parse error: ${jsonError.message}`);
      }
    }

    if (!parsed) {
      baseResponse.validationErrors = baseResponse.parsingErrors;
      return baseResponse;
    }

    const normalized: StructuredAgentResponse = {
      ...baseResponse,
      summary:
        typeof parsed.summary === 'string' && parsed.summary.trim().length > 0
          ? parsed.summary.trim()
          : baseResponse.summary,
      findings: normalizeFindings(parsed.findings),
      recommendations: normalizeStringList(parsed.recommendations),
      actionItems: normalizeActionItems(parsed.actionItems),
      followUpQuestions: normalizeStringList(parsed.followUpQuestions),
      telemetry: Array.isArray(parsed.telemetry)
        ? parsed.telemetry
        : baseResponse.telemetry,
      provider: parsed.provider || baseResponse.provider,
    };

    normalized.validationErrors = normalized.parsingErrors?.length
      ? normalized.parsingErrors
      : undefined;

    return normalized;
  } catch (error: any) {
    const fallback = {
      ...baseResponse,
      parsingErrors: [
        ...(baseResponse.parsingErrors || []),
        `Normalization error: ${error.message}`,
      ],
      validationErrors: [
        ...(baseResponse.validationErrors || []),
        `Normalization error: ${error.message}`,
      ],
    };

    return fallback;
  }
}

function extractJsonCandidate(rawContent: string): string | null {
  if (!rawContent) return null;

  const fencedMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const braceMatch = rawContent.match(/\{[\s\S]*\}/);
  if (braceMatch?.[0]) {
    return braceMatch[0];
  }

  if (rawContent.trim().startsWith('{') && rawContent.trim().endsWith('}')) {
    return rawContent.trim();
  }

  return null;
}

function normalizeStringList(value: any): string[] {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim());
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return [value.trim()];
  }

  return [];
}

function normalizeFindings(value: any): AgentFinding[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item: any) => {
      if (typeof item === 'string') {
        return { title: item, detail: item } as AgentFinding;
      }

      return {
        title: typeof item?.title === 'string' && item.title.trim().length > 0 ? item.title : 'Finding',
        detail:
          typeof item?.detail === 'string' && item.detail.trim().length > 0
            ? item.detail
            : typeof item?.description === 'string'
            ? item.description
            : '',
        metric: typeof item?.metric === 'string' ? item.metric : undefined,
      } as AgentFinding;
    })
    .filter((item: AgentFinding) => item.detail || item.title);
}

function normalizeActionItems(value: any): AgentActionItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item: any) => {
      if (typeof item === 'string') {
        return {
          title: 'Action Item',
          description: item,
          priority: 'medium',
        } as AgentActionItem;
      }

      return {
        title:
          typeof item?.title === 'string' && item.title.trim().length > 0
            ? item.title
            : 'Action Item',
        description:
          typeof item?.description === 'string' && item.description.trim().length > 0
            ? item.description
            : typeof item?.detail === 'string'
            ? item.detail
            : '',
        owner: typeof item?.owner === 'string' ? item.owner : undefined,
        dueDate: typeof item?.dueDate === 'string' ? item.dueDate : undefined,
        priority:
          item?.priority === 'high' || item?.priority === 'low' || item?.priority === 'medium'
            ? item.priority
            : 'medium',
      } as AgentActionItem;
    })
    .filter((item: AgentActionItem) => item.description || item.title);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Extracts total latency from telemetry
 */
export function extractLatency(telemetry: ProviderTelemetry[]): number {
  return telemetry.reduce((sum, t) => sum + t.latencyMs, 0);
}

/**
 * Extracts token metrics from telemetry
 */
export function extractTokenMetrics(telemetry: ProviderTelemetry[]): {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
} {
  const last = telemetry.find((t) => !t.error);
  return {
    promptTokens: last?.tokenUsage?.promptTokens || 0,
    completionTokens: last?.tokenUsage?.completionTokens || 0,
    totalTokens: last?.tokenUsage?.totalTokens || 0,
  };
}

/**
 * Calculates cost in USD based on model and token usage
 * Pricing as of January 2025
 */
export function calculateCost(
  model: string,
  tokenMetrics: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  }
): number {
  const promptTokens = tokenMetrics.promptTokens || 0;
  const completionTokens = tokenMetrics.completionTokens || 0;

  // Pricing per 1K tokens (input / output)
  const pricing: Record<string, { input: number; output: number }> = {
    // GPT-5 family (2025 models)
    'gpt-5': { input: 0.000015, output: 0.00006 },
    'gpt-5-mini': { input: 0.000005, output: 0.00002 },
    'gpt-5-nano': { input: 0.000001, output: 0.000004 },

    // GPT-4 family
    'gpt-4o': { input: 0.0025, output: 0.01 },
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'gpt-4-turbo': { input: 0.01, output: 0.03 },
    'gpt-4': { input: 0.03, output: 0.06 },

    // Reasoning models
    'o3-mini': { input: 0.00001, output: 0.00004 },
    'o4': { input: 0.00002, output: 0.00008 },
    'o1': { input: 0.015, output: 0.06 },
    'o1-mini': { input: 0.003, output: 0.012 },

    // Anthropic Claude
    'claude-3.5-sonnet': { input: 0.003, output: 0.015 },
    'claude-3-opus': { input: 0.015, output: 0.075 },
    'claude-3-sonnet': { input: 0.003, output: 0.015 },
    'claude-3-haiku': { input: 0.00025, output: 0.00125 },

    // Google Gemini (ultra-low cost!)
    'gemini-2.5-flash': { input: 0.000000075, output: 0.0000003 },
    'gemini-2.5-pro': { input: 0.00000125, output: 0.000005 },
    'gemini-1.5-pro': { input: 0.00000125, output: 0.000005 },
    'gemini-1.5-flash': { input: 0.000000075, output: 0.0000003 },

    // Perplexity
    'sonar-pro': { input: 0.001, output: 0.001 },
    'sonar': { input: 0.0001, output: 0.0001 },
  };

  const modelPricing = pricing[model] || { input: 0.00001, output: 0.00003 };

  // Calculate cost per 1K tokens
  const inputCost = (promptTokens / 1000) * modelPricing.input;
  const outputCost = (completionTokens / 1000) * modelPricing.output;

  return inputCost + outputCost;
}

/**
 * Formats cost for display
 */
export function formatCost(costUSD: number): string {
  if (costUSD < 0.01) {
    return `$${(costUSD * 100).toFixed(4)}¢`;
  }
  return `$${costUSD.toFixed(4)}`;
}
