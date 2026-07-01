// validate-api-key — supports: openai, sendgrid, zoom, anthropic, google_ai, perplexity, openrouter, salesforce, hubspot, mailgun, postmark, amazon_ses, jira, asana, monday, clickup, workamajig, float, fellow, confluence, sharepoint, outlook, zoho-crm
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const CONFIGURED_PLACEHOLDER = '__CONFIGURED__'
const ENCRYPTED_VALUE_PREFIX = 'v1:'

const SENSITIVE_KEY_PATTERNS = [
  /api[_-]?key$/i,
  /client[_-]?secret$/i,
  /[_-]secret$/i,
  /[_-]token$/i,
  /password$/i,
  /private[_-]?key$/i,
]

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

function isEncryptedConfigValue(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(ENCRYPTED_VALUE_PREFIX)
}

function isSensitiveIntegrationFieldKey(fieldKey: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(fieldKey))
}

function isMaskedCredential(value: string): boolean {
  const trimmed = value.trim()
  return !trimmed || trimmed === CONFIGURED_PLACEHOLDER || trimmed.startsWith('•')
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

async function mergeIntegrationHubCredentials(
  authHeader: string,
  providerId: string,
  incoming: Record<string, string>,
): Promise<Record<string, string>> {
  const needsStored = Object.values(incoming).some(
    (value) => typeof value === 'string' && isMaskedCredential(value),
  )
  if (!needsStored) return incoming

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

  const supabaseAdmin = createClient(supabaseUrl, serviceKey)
  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const token = authHeader.replace('Bearer ', '')
  const {
    data: { user },
    error: userError,
  } = await supabaseUser.auth.getUser(token)

  if (userError || !user) {
    throw new Error('Authentication required to test saved credentials')
  }

  const { data: adminRole } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle()

  if (!adminRole) {
    throw new Error('Only administrators can test saved integration credentials')
  }

  const { data: integration, error: integrationError } = await supabaseAdmin
    .from('organization_integrations')
    .select('config')
    .eq('provider_id', providerId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (integrationError) throw integrationError

  const storedConfig = (integration?.config ?? {}) as Record<string, unknown>
  if (Object.keys(storedConfig).length === 0) {
    throw new Error('No saved credentials found. Enter your API key and save before testing.')
  }

  const sensitiveKeys = await getSensitiveFieldKeysForProvider(supabaseAdmin, providerId)
  const decrypted = await decryptStoredIntegrationConfig(storedConfig, sensitiveKeys)

  const merged: Record<string, string> = { ...incoming }
  for (const [key, value] of Object.entries(incoming)) {
    if (typeof value !== 'string' || !isMaskedCredential(value)) continue
    const stored = decrypted[key]
    if (typeof stored === 'string' && stored.trim()) {
      merged[key] = stored
    }
  }

  return merged
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // GET = health check (no body), return 200 so deployment checks pass
  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({ valid: true, message: 'ok' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  }

  try {
    // Parse request body (POST may have empty body for health check)
    let requestBody: Record<string, unknown> = {};
    try {
      const parsed = await req.json();
      requestBody = parsed != null && typeof parsed === 'object' ? parsed : {};
    } catch {
      // Empty or invalid JSON body - treat as health check
      return new Response(
        JSON.stringify({ valid: true, message: 'ok' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Support both formats:
    // 1. { apiKey: "xxx", service: "sendgrid" } - direct format
    // 2. { provider: "sendgrid", credentials: { api_key: "xxx" } } - frontend format
    let apiKey = requestBody.apiKey as string | undefined;
    let service = requestBody.service as string | undefined;
    const ping = requestBody.ping as boolean | undefined;
    
    // Handle frontend format with provider/credentials
    const provider = requestBody.provider as string | undefined;
    let credentials = requestBody.credentials as Record<string, string> | undefined;
    const providerId = requestBody.provider_id as string | undefined;
    const authHeader = req.headers.get('Authorization');

    // Integration Hub: replace __CONFIGURED__ placeholders with decrypted stored values
    if (provider && credentials && providerId && authHeader?.startsWith('Bearer ')) {
      try {
        credentials = await mergeIntegrationHubCredentials(authHeader, providerId, credentials);
      } catch (mergeError: unknown) {
        const message = mergeError instanceof Error ? mergeError.message : 'Failed to load saved credentials';
        return new Response(
          JSON.stringify({ valid: false, message, details: {} }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
        );
      }
    }

    // Health check / deployment test - no external calls (ping or empty body)
    if (ping === true || (requestBody && Object.keys(requestBody).length === 0)) {
      return new Response(
        JSON.stringify({ valid: true, message: 'ok' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Jira: integration hub sends jira_host, jira_email, jira_api_token (not a single apiKey)
    if (provider === 'jira' && credentials) {
      const jiraHost = String(credentials.jira_host || credentials.jiraHost || '').trim()
      const jiraEmail = String(credentials.jira_email || credentials.jiraEmail || '').trim()
      const jiraToken = String(credentials.jira_api_token || credentials.jiraApiToken || '').trim()
      if (jiraHost && jiraEmail && jiraToken) {
        const jiraResult = await validateJiraFromFields(jiraHost, jiraEmail, jiraToken)
        return new Response(
          JSON.stringify(jiraResult),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }
      // Hub form uses jira_* keys — do not fall through to legacy colon parser (would treat URL as apiKey).
      const hubUsesTriplet =
        'jira_host' in credentials ||
        'jiraHost' in credentials ||
        'jira_email' in credentials ||
        'jiraEmail' in credentials ||
        'jira_api_token' in credentials ||
        'jiraApiToken' in credentials
      if (hubUsesTriplet) {
        return new Response(
          JSON.stringify({
            valid: false,
            message:
              'Jira requires all three: site URL, Atlassian email, and API token. Fill every field (token is often not sent until you tab out or save), then test again.',
            details: {},
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }
    }

    if (provider === 'fellow' && credentials) {
      const rawSub = String(credentials.subdomain || credentials.fellow_subdomain || credentials.fellowSubdomain || '').trim()
      const fellowKey = String(credentials.api_key || credentials.apiKey || credentials.fellow_api_key || credentials.fellowApiKey || '').trim()
      const fellowResult = await validateFellow(rawSub, fellowKey)
      return new Response(
        JSON.stringify(fellowResult),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    if (provider === 'confluence' && credentials) {
      const confluenceResult = await validateConfluence(credentials as Record<string, string>)
      return new Response(
        JSON.stringify(confluenceResult),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    if (provider === 'sharepoint' && credentials) {
      const sharepointResult = await validateSharePoint(credentials as Record<string, string>)
      return new Response(
        JSON.stringify(sharepointResult),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    if (provider === 'outlook' && credentials) {
      const outlookResult = await validateOutlook(credentials as Record<string, string>)
      return new Response(
        JSON.stringify(outlookResult),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    if (provider === 'zoho-crm' && credentials) {
      const zohoResult = await validateZohoCrm(credentials as Record<string, string>)
      return new Response(
        JSON.stringify(zohoResult),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    if (provider && credentials) {
      service = provider;
      if (service === 'google-gemini') {
        service = 'google_ai';
      }
      // Extract API key from credentials - common field names
      // Skip first-value fallback for Jira / Confluence / SharePoint / Outlook (multi-field auth)
      if (provider !== 'jira' && provider !== 'confluence' && provider !== 'sharepoint' && provider !== 'outlook') {
        apiKey = credentials.float_api_key || credentials.floatApiKey ||
          credentials.api_key || credentials.apiKey || credentials.access_token ||
          credentials.secret_key || credentials.token || Object.values(credentials)[0];
      } else {
        apiKey = credentials.api_key || credentials.apiKey || credentials.access_token ||
          credentials.secret_key || credentials.token;
      }
    }

    if (!apiKey || !service) {
      return new Response(
        JSON.stringify({ valid: false, error: 'API key and service are required. Expected { apiKey, service } or { provider, credentials }' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    let validationResult = { valid: false, message: '', details: {} }

    // Validate based on service type
    switch (service) {
      case 'openai':
        validationResult = await validateOpenAI(apiKey)
        break
      case 'sendgrid':
        validationResult = await validateSendGrid(apiKey)
        break
      case 'zoom':
        validationResult = await validateZoom(apiKey)
        break
      case 'anthropic':
        validationResult = await validateAnthropic(apiKey)
        break
      case 'google_ai':
        validationResult = await validateGoogleAI(apiKey)
        break
      case 'perplexity':
        validationResult = await validatePerplexity(apiKey)
        break
      case 'openrouter':
        validationResult = await validateOpenRouter(apiKey)
        break
      case 'salesforce':
        validationResult = await validateSalesforce(apiKey)
        break
      case 'hubspot':
        validationResult = await validateHubSpot(apiKey)
        break
      case 'mailgun':
        validationResult = await validateMailgun(apiKey)
        break
      case 'postmark':
        validationResult = await validatePostmark(apiKey)
        break
      case 'amazon_ses':
        validationResult = await validateAmazonSES(apiKey)
        break
      case 'jira':
        validationResult = await validateJira(apiKey)
        break
      case 'asana':
        validationResult = await validateAsana(apiKey)
        break
      case 'monday':
        validationResult = await validateMonday(apiKey)
        break
      case 'clickup':
        validationResult = await validateClickUp(apiKey)
        break
      case 'float':
        validationResult = await validateFloat(apiKey, credentials)
        break
      case 'workamajig':
        validationResult = await validateWorkamajig(apiKey, credentials)
        break
      case 'confluence':
        validationResult = await validateConfluence((credentials || { api_key: apiKey }) as Record<string, string>)
        break
      case 'sharepoint':
        validationResult = await validateSharePoint((credentials || {}) as Record<string, string>)
        break
      case 'zoho-crm':
        validationResult = await validateZohoCrm((credentials || {}) as Record<string, string>)
        break
      default:
        return new Response(
          JSON.stringify({ valid: false, error: `Unknown service: ${service}` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }

    return new Response(
      JSON.stringify(validationResult),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ valid: false, error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

// Validate OpenAI API key
async function validateOpenAI(apiKey: string) {
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (response.ok) {
      const data = await response.json()
      return {
        valid: true,
        message: 'OpenAI API key is valid',
        details: {
          models_count: data.data?.length || 0,
        },
      }
    } else {
      const errorData = await response.json()
      return {
        valid: false,
        message: errorData.error?.message || 'Invalid OpenAI API key',
        details: { status: response.status },
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      valid: false,
      message: `OpenAI validation error: ${message}`,
      details: {},
    }
  }
}

// Validate SendGrid API key
async function validateSendGrid(apiKey: string) {
  try {
    const response = await fetch('https://api.sendgrid.com/v3/scopes', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (response.ok) {
      const data = await response.json()
      return {
        valid: true,
        message: 'SendGrid API key is valid',
        details: {
          scopes_count: data.scopes?.length || 0,
        },
      }
    } else {
      const errorData = await response.json()
      return {
        valid: false,
        message: errorData.errors?.[0]?.message || 'Invalid SendGrid API key',
        details: { status: response.status },
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      valid: false,
      message: `SendGrid validation error: ${message}`,
      details: {},
    }
  }
}

// Validate Zoom credentials (OAuth requires account_id, client_id, client_secret)
async function validateZoom(credentials: string) {
  try {
    // Expect credentials in format: account_id:client_id:client_secret
    const [accountId, clientId, clientSecret] = credentials.split(':')

    if (!accountId || !clientId || !clientSecret) {
      return {
        valid: false,
        message: 'Zoom credentials must be in format: account_id:client_id:client_secret',
        details: {},
      }
    }

    // Test Zoom OAuth token endpoint
    const authString = btoa(`${clientId}:${clientSecret}`)
    const response = await fetch(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    )

    if (response.ok) {
      const data = await response.json()
      return {
        valid: true,
        message: 'Zoom credentials are valid',
        details: {
          token_type: data.token_type,
          expires_in: data.expires_in,
        },
      }
    } else {
      const errorData = await response.json()
      return {
        valid: false,
        message: errorData.reason || 'Invalid Zoom credentials',
        details: { status: response.status },
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      valid: false,
      message: `Zoom validation error: ${message}`,
      details: {},
    }
  }
}

// Validate Anthropic API key
async function validateAnthropic(apiKey: string) {
  try {
    // Test a simple API call to list available models
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }],
      }),
    })

    if (response.ok || response.status === 400) {
      // 400 is acceptable as it means the API key is valid but the request format might be intentionally minimal
      return {
        valid: true,
        message: 'Anthropic API key is valid',
        details: { status: response.status },
      }
    } else if (response.status === 401) {
      return {
        valid: false,
        message: 'Invalid Anthropic API key',
        details: { status: response.status },
      }
    } else {
      const errorData = await response.json().catch(() => ({}))
      return {
        valid: false,
        message: errorData.error?.message || 'Invalid Anthropic API key',
        details: { status: response.status },
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      valid: false,
      message: `Anthropic validation error: ${message}`,
      details: {},
    }
  }
}

// Validate Google AI (Gemini) API key
async function validateGoogleAI(apiKey: string) {
  try {
    // Test the models endpoint
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )

    if (response.ok) {
      const data = await response.json()
      return {
        valid: true,
        message: 'Google AI API key is valid',
        details: {
          models_count: data.models?.length || 0,
        },
      }
    } else {
      const errorData = await response.json().catch(() => ({}))
      return {
        valid: false,
        message: errorData.error?.message || 'Invalid Google AI API key',
        details: { status: response.status },
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      valid: false,
      message: `Google AI validation error: ${message}`,
      details: {},
    }
  }
}

// Validate OpenRouter API key (inline — validate-api-key deploy bundle does not include _shared/)
async function validateOpenRouter(apiKey: string) {
  const trimmed = apiKey.trim()
  if (!trimmed) {
    return {
      valid: false,
      message: 'OpenRouter API key is required',
      details: {},
    }
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${trimmed}`,
        'Content-Type': 'application/json',
      },
    })

    if (response.ok) {
      const data = await response.json()
      return {
        valid: true,
        message: 'OpenRouter API key is valid',
        details: {
          models_count: Array.isArray(data?.data) ? data.data.length : 0,
        },
      }
    }

    const errorData = await response.json().catch(() => ({}))
    const apiMessage =
      (errorData as { error?: { message?: string } })?.error?.message ||
      (errorData as { message?: string })?.message

    if (response.status === 401 || response.status === 403) {
      return {
        valid: false,
        message: apiMessage || 'Invalid OpenRouter API key',
        details: { status: response.status },
      }
    }

    return {
      valid: false,
      message: apiMessage || `OpenRouter validation failed (${response.status})`,
      details: { status: response.status },
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      valid: false,
      message: `OpenRouter validation error: ${message}`,
      details: {},
    }
  }
}

// Validate Perplexity API key
async function validatePerplexity(apiKey: string) {
  try {
    // Test a simple chat completion request
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1,
      }),
    })

    if (response.ok || response.status === 400) {
      // 400 is acceptable as it means the API key is valid
      return {
        valid: true,
        message: 'Perplexity API key is valid',
        details: { status: response.status },
      }
    } else if (response.status === 401) {
      return {
        valid: false,
        message: 'Invalid Perplexity API key',
        details: { status: response.status },
      }
    } else {
      const errorData = await response.json().catch(() => ({}))
      return {
        valid: false,
        message: errorData.error?.message || 'Invalid Perplexity API key',
        details: { status: response.status },
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      valid: false,
      message: `Perplexity validation error: ${message}`,
      details: {},
    }
  }
}

// Validate Salesforce credentials (expects instance_url:access_token format or just access_token)
async function validateSalesforce(credentials: string) {
  try {
    // Parse credentials - can be either "instance_url:access_token" or just "access_token"
    let instanceUrl = 'https://login.salesforce.com'
    let accessToken = credentials

    if (credentials.includes(':')) {
      const parts = credentials.split(':')
      instanceUrl = parts[0]
      accessToken = parts.slice(1).join(':')
    }

    // Test Salesforce API with a simple query
    const response = await fetch(`${instanceUrl}/services/data/v58.0/limits`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (response.ok) {
      const data = await response.json()
      return {
        valid: true,
        message: 'Salesforce credentials are valid',
        details: {
          instance: instanceUrl,
          api_version: 'v58.0',
        },
      }
    } else if (response.status === 401) {
      return {
        valid: false,
        message: 'Invalid Salesforce access token',
        details: { status: response.status },
      }
    } else {
      const errorData = await response.json().catch(() => ({}))
      return {
        valid: false,
        message: errorData[0]?.message || 'Invalid Salesforce credentials',
        details: { status: response.status },
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      valid: false,
      message: `Salesforce validation error: ${message}`,
      details: {},
    }
  }
}

// Validate HubSpot API key
async function validateHubSpot(apiKey: string) {
  try {
    // Test HubSpot API with account info endpoint
    const response = await fetch(
      `https://api.hubapi.com/account-info/v3/api-usage/daily?hapikey=${apiKey}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )

    if (response.ok) {
      return {
        valid: true,
        message: 'HubSpot API key is valid',
        details: { status: response.status },
      }
    } else if (response.status === 401 || response.status === 403) {
      return {
        valid: false,
        message: 'Invalid HubSpot API key',
        details: { status: response.status },
      }
    } else {
      const errorData = await response.json().catch(() => ({}))
      return {
        valid: false,
        message: errorData.message || 'Invalid HubSpot API key',
        details: { status: response.status },
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      valid: false,
      message: `HubSpot validation error: ${message}`,
      details: {},
    }
  }
}

// Validate Mailgun API key (expects domain:api_key format)
async function validateMailgun(credentials: string) {
  try {
    // Parse credentials - expects "domain:api_key" format
    const [domain, apiKey] = credentials.split(':')

    if (!domain || !apiKey) {
      return {
        valid: false,
        message: 'Mailgun credentials must be in format: domain:api_key',
        details: {},
      }
    }

    // Test Mailgun API
    const authString = btoa(`api:${apiKey}`)
    const response = await fetch(`https://api.mailgun.net/v3/domains/${domain}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${authString}`,
      },
    })

    if (response.ok) {
      const data = await response.json()
      return {
        valid: true,
        message: 'Mailgun API key is valid',
        details: {
          domain: data.domain?.name,
          state: data.domain?.state,
        },
      }
    } else if (response.status === 401) {
      return {
        valid: false,
        message: 'Invalid Mailgun API key',
        details: { status: response.status },
      }
    } else {
      const errorData = await response.json().catch(() => ({}))
      return {
        valid: false,
        message: errorData.message || 'Invalid Mailgun credentials',
        details: { status: response.status },
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      valid: false,
      message: `Mailgun validation error: ${message}`,
      details: {},
    }
  }
}

// Validate Postmark API key (Server Token)
async function validatePostmark(apiKey: string) {
  try {
    // Test Postmark API with server info endpoint
    const response = await fetch('https://api.postmarkapp.com/server', {
      method: 'GET',
      headers: {
        'X-Postmark-Server-Token': apiKey,
        'Accept': 'application/json',
      },
    })

    if (response.ok) {
      const data = await response.json()
      return {
        valid: true,
        message: 'Postmark API key is valid',
        details: {
          server_name: data.Name,
          server_id: data.ID,
        },
      }
    } else if (response.status === 401 || response.status === 422) {
      return {
        valid: false,
        message: 'Invalid Postmark API key',
        details: { status: response.status },
      }
    } else {
      const errorData = await response.json().catch(() => ({}))
      return {
        valid: false,
        message: errorData.Message || 'Invalid Postmark API key',
        details: { status: response.status },
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      valid: false,
      message: `Postmark validation error: ${message}`,
      details: {},
    }
  }
}

// Validate Amazon SES credentials (expects access_key_id:secret_access_key:region format)
async function validateAmazonSES(credentials: string) {
  try {
    // For SES, we can't directly validate without AWS SDK
    // Return a message indicating OAuth/proper setup is needed
    return {
      valid: false,
      message: 'Amazon SES requires OAuth 2.0 or AWS SDK integration. Please use the OAuth flow or configure via AWS console.',
      details: {
        note: 'Direct API key validation not supported for SES',
      },
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      valid: false,
      message: `Amazon SES validation error: ${message}`,
      details: {},
    }
  }
}

// Microsoft Outlook (Integration Hub): Entra app ID + secret (+ optional tenant; default common).
// User mail uses delegated OAuth; this check validates the confidential app and optional Graph app permissions.
async function validateOutlook(credentials: Record<string, string>) {
  const rawTenant = String(credentials.tenant_id || credentials.tenantId || '').trim()
  const tenantId = rawTenant || 'common'
  const clientId = String(credentials.client_id || credentials.clientId || '').trim()
  const clientSecret = String(credentials.client_secret || credentials.clientSecret || '').trim()

  if (!clientId || !clientSecret) {
    return {
      valid: false,
      message: 'Microsoft Outlook requires Application (client) ID and client secret',
      details: {},
    }
  }

  const tokenUrl =
    `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  })

  try {
    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    const tokenJson = (await tokenRes.json().catch(() => ({}))) as {
      error?: string
      error_description?: string
      access_token?: string
    }

    if (tokenRes.ok && tokenJson.access_token) {
      return {
        valid: true,
        message:
          'Microsoft app registration is valid. Graph accepted client credentials (application permissions in Entra, if any).',
        details: {},
      }
    }

    const err = tokenJson.error || ''
    const errDesc = (tokenJson.error_description || '').trim()
    if (err === 'invalid_client' || /invalid_client|AADSTS7000215|7000215/i.test(errDesc)) {
      return {
        valid: false,
        message: `Invalid Application ID or client secret. ${errDesc}`.replace(/\s+/g, ' ').trim(),
        details: { status: tokenRes.status },
      }
    }

    if (
      err === 'unauthorized_client' ||
      /7000218|AADSTS70011|AADSTS70005|not (allowed|permitted) for use with|consent|grant_type/i.test(
        errDesc
      )
    ) {
      return {
        valid: true,
        message:
          'Azure AD did not issue an app-only Graph token; this is normal for apps with only delegated (user) API permissions. ' +
          'If the Application ID and secret are correct, use "Connect Microsoft Outlook" to test sign-in.',
        details: { azure_error: errDesc || err, status: tokenRes.status },
      }
    }

    return {
      valid: false,
      message: errDesc
        ? `Microsoft token request failed: ${errDesc}`
        : `Microsoft token request failed (${tokenRes.status})`,
      details: { error: err, status: tokenRes.status },
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      valid: false,
      message: `Outlook validation error: ${message}`,
      details: {},
    }
  }
}

// SharePoint / Microsoft Graph: app registration (client credentials), optional site path
async function validateSharePoint(credentials: Record<string, string>) {
  try {
    const tenantId = String(credentials.tenant_id || credentials.tenantId || '').trim()
    const clientId = String(credentials.client_id || credentials.clientId || '').trim()
    const clientSecret = String(credentials.client_secret || credentials.clientSecret || '').trim()
    let hostname = String(credentials.sharepoint_hostname || credentials.sharepointHostname || '').trim()
    hostname = hostname.replace(/^https?:\/\//i, '').split('/')[0] ?? ''
    const sitePathRaw = String(
      credentials.sharepoint_site_path || credentials.sharepointSitePath || ''
    ).trim()

    if (!tenantId || !clientId || !clientSecret || !hostname) {
      return {
        valid: false,
        message:
          'SharePoint requires Tenant ID, Client ID, Client Secret, and SharePoint hostname.',
        details: {},
      }
    }

    const tokenUrl =
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    })
    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    const tokenJson = await tokenRes.json().catch(() => ({}))
    if (!tokenRes.ok) {
      const msg =
        (tokenJson as { error_description?: string }).error_description ||
        (tokenJson as { error?: string }).error ||
        `Token request failed (${tokenRes.status})`
      return {
        valid: false,
        message: `Microsoft authentication failed: ${msg}`,
        details: { status: tokenRes.status },
      }
    }
    const accessToken = (tokenJson as { access_token?: string }).access_token
    if (!accessToken) {
      return {
        valid: false,
        message: 'Microsoft token response missing access_token',
        details: {},
      }
    }

    let siteSegment = sitePathRaw
    if (!siteSegment || siteSegment === '/') {
      siteSegment = `${hostname}:/`
    } else {
      const path = siteSegment.startsWith('/') ? siteSegment : `/${siteSegment}`
      siteSegment = `${hostname}:${path}`
    }
    const siteKey = encodeURIComponent(siteSegment)
    const siteRes = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${siteKey}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    if (siteRes.ok) {
      return {
        valid: true,
        message: 'SharePoint credentials are valid and the site is reachable via Microsoft Graph',
        details: { hostname },
      }
    }
    const errText = await siteRes.text().catch(() => '')
    if (siteRes.status === 401 || siteRes.status === 403) {
      return {
        valid: false,
        message:
          'Microsoft Graph denied access to the site. Ensure application permissions Sites.Read.All and Files.Read.All are granted with admin consent.',
        details: { status: siteRes.status },
      }
    }
    return {
      valid: false,
      message: `SharePoint site lookup failed (${siteRes.status}). Check hostname and site path.`,
      details: { status: siteRes.status, body: errText.slice(0, 200) },
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      valid: false,
      message: `SharePoint validation error: ${message}`,
      details: {},
    }
  }
}

// Confluence Cloud: email + API token + domain (integration hub or legacy credentials object)
async function validateConfluence(credentials: Record<string, string>) {
  try {
    const email = String(credentials.confluence_email || credentials.email || '').trim()
    const apiToken = String(
      credentials.confluence_api_token || credentials.api_token || credentials.api_key || credentials.apiKey || ''
    ).trim()
    let domain = String(credentials.confluence_domain || credentials.domain || '').trim()
    domain = domain.replace(/^https?:\/\//i, '').replace(/\/.*$/, '')

    if (!email || !apiToken || !domain) {
      return {
        valid: false,
        message: 'Confluence requires Atlassian email, API token, and domain (e.g. yourcompany.atlassian.net)',
        details: {},
      }
    }

    const authString = btoa(`${email}:${apiToken}`)
    const response = await fetch(`https://${domain}/wiki/api/v2/spaces?limit=1`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Accept': 'application/json',
      },
    })

    if (response.ok) {
      return {
        valid: true,
        message: 'Confluence credentials are valid',
        details: { domain },
      }
    }
    if (response.status === 401 || response.status === 403) {
      return {
        valid: false,
        message: 'Invalid Confluence credentials or insufficient access',
        details: { status: response.status },
      }
    }
    const errorText = await response.text().catch(() => '')
    return {
      valid: false,
      message: `Confluence validation failed (${response.status})`,
      details: { status: response.status, body: errorText.slice(0, 200) },
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      valid: false,
      message: `Confluence validation error: ${message}`,
      details: {},
    }
  }
}

// Validate Jira with site URL + email + API token (integration hub form)
async function validateJiraFromFields(host: string, email: string, apiToken: string) {
  try {
    let base = host.trim().replace(/\/$/, '')
    if (!/^https?:\/\//i.test(base)) {
      base = `https://${base}`
    }
    const authString = btoa(`${email}:${apiToken}`)
    const response = await fetch(`${base}/rest/api/3/myself`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Accept': 'application/json',
      },
    })

    if (response.ok) {
      const data = await response.json()
      return {
        valid: true,
        message: 'Jira credentials are valid',
        details: {
          account_id: data.accountId,
          display_name: data.displayName,
        },
      }
    } else if (response.status === 401) {
      return {
        valid: false,
        message: 'Invalid Jira credentials',
        details: { status: response.status },
      }
    } else {
      const errorData = await response.json().catch(() => ({}))
      return {
        valid: false,
        message: errorData.errorMessages?.[0] || 'Invalid Jira credentials',
        details: { status: response.status },
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      valid: false,
      message: `Jira validation error: ${message}`,
      details: {},
    }
  }
}

// Validate Jira credentials (legacy: email:api_token:domain format)
async function validateJira(credentials: string) {
  try {
    // Parse credentials - expects "email:api_token:domain" format
    const parts = credentials.split(':')

    if (parts.length < 3) {
      return {
        valid: false,
        message: 'Jira credentials must be in format: email:api_token:domain.atlassian.net',
        details: {},
      }
    }

    const email = parts[0]
    const apiToken = parts[1]
    const domain = parts.slice(2).join(':')

    // Test Jira API with myself endpoint
    const authString = btoa(`${email}:${apiToken}`)
    const response = await fetch(`https://${domain}/rest/api/3/myself`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Accept': 'application/json',
      },
    })

    if (response.ok) {
      const data = await response.json()
      return {
        valid: true,
        message: 'Jira credentials are valid',
        details: {
          account_id: data.accountId,
          display_name: data.displayName,
        },
      }
    } else if (response.status === 401) {
      return {
        valid: false,
        message: 'Invalid Jira credentials',
        details: { status: response.status },
      }
    } else {
      const errorData = await response.json().catch(() => ({}))
      return {
        valid: false,
        message: errorData.errorMessages?.[0] || 'Invalid Jira credentials',
        details: { status: response.status },
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      valid: false,
      message: `Jira validation error: ${message}`,
      details: {},
    }
  }
}

// Validate Asana API key (Personal Access Token)
async function validateAsana(apiKey: string) {
  try {
    // Test Asana API with user info endpoint
    const response = await fetch('https://app.asana.com/api/1.0/users/me', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
    })

    if (response.ok) {
      const data = await response.json()
      return {
        valid: true,
        message: 'Asana API key is valid',
        details: {
          user_name: data.data?.name,
          user_email: data.data?.email,
        },
      }
    } else if (response.status === 401) {
      return {
        valid: false,
        message: 'Invalid Asana API key',
        details: { status: response.status },
      }
    } else {
      const errorData = await response.json().catch(() => ({}))
      return {
        valid: false,
        message: errorData.errors?.[0]?.message || 'Invalid Asana API key',
        details: { status: response.status },
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      valid: false,
      message: `Asana validation error: ${message}`,
      details: {},
    }
  }
}

// Validate Monday.com API key
async function validateMonday(apiKey: string) {
  try {
    // Test Monday.com API with GraphQL query
    const response = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: '{ me { name email } }',
      }),
    })

    if (response.ok) {
      const data = await response.json()

      if (data.errors) {
        return {
          valid: false,
          message: data.errors[0]?.message || 'Invalid Monday.com API key',
          details: { status: response.status },
        }
      }

      return {
        valid: true,
        message: 'Monday.com API key is valid',
        details: {
          user_name: data.data?.me?.name,
          user_email: data.data?.me?.email,
        },
      }
    } else if (response.status === 401) {
      return {
        valid: false,
        message: 'Invalid Monday.com API key',
        details: { status: response.status },
      }
    } else {
      const errorData = await response.json().catch(() => ({}))
      return {
        valid: false,
        message: errorData.error_message || 'Invalid Monday.com API key',
        details: { status: response.status },
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      valid: false,
      message: `Monday.com validation error: ${message}`,
      details: {},
    }
  }
}

// Validate ClickUp API key (Personal API Token or OAuth token)
async function validateClickUp(apiKey: string) {
  try {
    const response = await fetch('https://api.clickup.com/api/v2/user', {
      method: 'GET',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
      },
    })

    if (response.ok) {
      const data = await response.json()
      return {
        valid: true,
        message: 'ClickUp API key is valid',
        details: {
          username: data.user?.username || 'unknown',
          email: data.user?.email || 'unknown',
        },
      }
    } else if (response.status === 401) {
      return {
        valid: false,
        message: 'Invalid ClickUp API key or token',
        details: { status: response.status },
      }
    } else {
      const errorData = await response.json().catch(() => ({}))
      return {
        valid: false,
        message: errorData.err || 'Invalid ClickUp API key',
        details: { status: response.status },
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      valid: false,
      message: `ClickUp validation error: ${message}`,
      details: {},
    }
  }
}

// Validate Float API key
function cleanFellowSubdomain(raw: string): string {
  let s = raw.trim()
  s = s.replace(/^https?:\/\//i, '')
  s = (s.split('/')[0] ?? '').trim()
  s = s.replace(/:\d+$/, '')
  s = s.replace(/\.fellow\.app$/i, '')
  s = s.replace(/[^\w.-]/g, '').replace(/^\.+|\.+$/g, '')

  // Fellow workspace slug should be the first label only.
  if (s.includes('.')) {
    s = s.split('.')[0] ?? ''
  }

  return s
}

async function validateFellow(subdomainRaw: string, apiKey: string) {
  const subdomain = cleanFellowSubdomain(subdomainRaw)
  if (!subdomain || !apiKey) {
    return {
      valid: false,
      message: 'Fellow requires workspace subdomain and API key',
      details: {},
    }
  }
  try {
    const baseUrl = `https://${subdomain}.fellow.app/api/v1`
    const probePaths = ['/recordings', '/notes']
    let lastStatus = 0
    let lastBody = ''

    for (const path of probePaths) {
      const response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': apiKey,
        },
        body: JSON.stringify({ limit: 1 }),
      })

      if (response.ok) {
        return {
          valid: true,
          message: 'Fellow API key and subdomain are valid',
          details: { subdomain, endpoint: path },
        }
      }

      if (response.status === 401 || response.status === 403) {
        return {
          valid: false,
          message: 'Invalid Fellow API key or you do not have access to this workspace',
          details: { status: response.status, endpoint: path },
        }
      }

      lastStatus = response.status
      lastBody = await response.text()

      // Keep probing on 404 in case the workspace supports a different list endpoint.
      if (response.status !== 404) {
        break
      }
    }

    if (lastStatus === 404) {
      const looksLikeHtml = /<!doctype html>/i.test(lastBody)
      return {
        valid: false,
        message: looksLikeHtml
          ? 'Fellow workspace subdomain appears invalid. Use only the Fellow workspace slug (e.g. "acme" from https://acme.fellow.app).'
          : 'Fellow API endpoint not found for this workspace',
        details: { status: 404, subdomain },
      }
    }

    return {
      valid: false,
      message: `Fellow validation failed (${lastStatus})`,
      details: { status: lastStatus, body: lastBody.slice(0, 160) },
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      valid: false,
      message: `Fellow validation error: ${message}`,
      details: {},
    }
  }
}

async function validateFloat(apiKey: string, credentials?: Record<string, string>) {
  try {
    const baseUrl = (credentials?.float_base_url || credentials?.floatBaseUrl || 'https://api.float.com/v3')
      .replace(/\/$/, '')
    const response = await fetch(`${baseUrl}/people?page=1&per-page=1`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
    })

    if (response.ok) {
      return {
        valid: true,
        message: 'Float API key is valid',
        details: { base_url: baseUrl },
      }
    } else if (response.status === 401 || response.status === 403) {
      return {
        valid: false,
        message: 'Invalid Float API key',
        details: { status: response.status },
      }
    } else {
      const text = await response.text()
      return {
        valid: false,
        message: `Float validation failed (${response.status})`,
        details: { status: response.status, body: text.slice(0, 140) },
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      valid: false,
      message: `Float validation error: ${message}`,
      details: {},
    }
  }
}

async function validateZohoCrm(credentials: Record<string, string>) {
  const clientId = String(credentials.zoho_client_id || credentials.client_id || '').trim()
  const clientSecret = String(credentials.zoho_client_secret || credentials.client_secret || '').trim()
  const accountsUrlRaw = String(credentials.zoho_accounts_url || credentials.accounts_url || 'https://accounts.zoho.com').trim()
  const accountsUrl = accountsUrlRaw.replace(/\/$/, '')

  if (!clientId || !clientSecret) {
    return {
      valid: false,
      message: 'Zoho CRM requires client ID and client secret',
      details: {},
    }
  }

  if (!/^https:\/\/accounts\.zoho\.[a-z.]+$/i.test(accountsUrl)) {
    return {
      valid: false,
      message: 'Invalid Zoho accounts domain. Example: https://accounts.zoho.com',
      details: { accounts_url: accountsUrl },
    }
  }

  // Zoho CRM uses OAuth authorization code flow, so client credentials
  // are validated at connect time. Here we validate required config shape.
  return {
    valid: true,
    message: 'Zoho CRM credentials look valid. Complete OAuth connect to finish verification.',
    details: { accounts_url: accountsUrl },
  }
}

// Validate Workamajig API credentials (base_url + api_access_token + user_token)
async function validateWorkamajig(apiKey: string, credentials?: Record<string, string>) {
  try {
    const baseUrl = credentials?.base_url
    const accessToken = credentials?.api_access_token || apiKey
    const userToken = credentials?.user_token

    if (!baseUrl) {
      return {
        valid: false,
        message: 'Workamajig base URL is required',
        details: {},
      }
    }

    // Test the Workamajig API with a simple endpoint
    const headers: Record<string, string> = {
      'APIAccessToken': accessToken,
      'Content-Type': 'application/json',
    }
    if (userToken) {
      headers['UserToken'] = userToken
    }

    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/beta1/services`, {
      method: 'GET',
      headers,
    })

    if (response.ok) {
      return {
        valid: true,
        message: 'Workamajig credentials are valid',
        details: { base_url: baseUrl },
      }
    } else if (response.status === 401 || response.status === 403) {
      return {
        valid: false,
        message: 'Invalid Workamajig credentials',
        details: { status: response.status },
      }
    } else {
      return {
        valid: false,
        message: `Workamajig API returned status ${response.status}`,
        details: { status: response.status },
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      valid: false,
      message: `Workamajig validation error: ${message}`,
      details: {},
    }
  }
}
