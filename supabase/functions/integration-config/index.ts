/**
 * Integration Config API — encrypt on save, mask on read, decrypt for internal callers.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const ENCRYPTED_VALUE_PREFIX = 'v1:';
const CONFIGURED_PLACEHOLDER = '__CONFIGURED__';

const SENSITIVE_KEY_PATTERNS = [
  /api[_-]?key$/i,
  /client[_-]?secret$/i,
  /[_-]secret$/i,
  /[_-]token$/i,
  /password$/i,
  /private[_-]?key$/i,
];

class SecureEncryption {
  private static readonly VERSION = 'v1';
  private static readonly ALGORITHM = 'AES-GCM';
  private static readonly IV_LENGTH = 12;
  private static readonly TAG_LENGTH = 16;

  static async encrypt(plaintext: string, keyString: string): Promise<string> {
    const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));
    const key = await this.deriveKey(keyString);
    const data = new TextEncoder().encode(plaintext);
    const encrypted = await crypto.subtle.encrypt(
      { name: this.ALGORITHM, iv, tagLength: this.TAG_LENGTH * 8 } as AesGcmParams,
      key,
      data,
    );
    return `${this.VERSION}:${this.arrayBufferToBase64(iv)}:${this.arrayBufferToBase64(new Uint8Array(encrypted))}`;
  }

  static async decrypt(ciphertext: string, keyString: string): Promise<string> {
    const parts = ciphertext.split(':');
    if (parts.length !== 3) throw new Error('Invalid ciphertext format');
    const [version, ivBase64, encryptedBase64] = parts;
    if (version !== this.VERSION) throw new Error(`Unsupported version: ${version}`);
    const iv = this.base64ToArrayBuffer(ivBase64);
    const encrypted = this.base64ToArrayBuffer(encryptedBase64);
    const key = await this.deriveKey(keyString);
    const decrypted = await crypto.subtle.decrypt(
      { name: this.ALGORITHM, iv, tagLength: this.TAG_LENGTH * 8 } as AesGcmParams,
      key,
      encrypted as BufferSource,
    );
    return new TextDecoder().decode(decrypted);
  }

  private static async deriveKey(keyString: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const baseKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(keyString),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey'],
    );
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
    );
  }

  private static arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  private static base64ToArrayBuffer(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
}

function getEncryptionKey(): string {
  const key = Deno.env.get('ENCRYPTION_KEY')?.trim();
  if (key && key.length >= 16) return key;
  const fallback = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  if (fallback) {
    console.warn('[integration-config] ENCRYPTION_KEY not set; falling back to service role key');
    return fallback;
  }
  throw new Error('ENCRYPTION_KEY is not configured');
}

function isEncryptedValue(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(ENCRYPTED_VALUE_PREFIX);
}

function isSensitiveFieldKey(fieldKey: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(fieldKey));
}

function resolveSensitiveFieldKeys(fieldKeys: string[], explicitSensitiveKeys?: string[]): Set<string> {
  const keys = new Set<string>();
  for (const key of fieldKeys) {
    if (isSensitiveFieldKey(key)) keys.add(key);
  }
  for (const key of explicitSensitiveKeys ?? []) keys.add(key);
  return keys;
}

async function encryptValueIfNeeded(value: string): Promise<string> {
  if (!value || isEncryptedValue(value)) return value;
  return await SecureEncryption.encrypt(value, getEncryptionKey());
}

async function decryptValueIfNeeded(value: string): Promise<string> {
  if (!value) return value;
  if (!isEncryptedValue(value)) return value;
  return await SecureEncryption.decrypt(value, getEncryptionKey());
}

async function encryptIntegrationConfig(
  incoming: Record<string, unknown>,
  sensitiveKeys: Set<string>,
  existing?: Record<string, unknown> | null,
): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = { ...existing, ...incoming };
  for (const [fieldKey, rawValue] of Object.entries(incoming)) {
    if (!sensitiveKeys.has(fieldKey) || typeof rawValue !== 'string') continue;
    const trimmed = rawValue.trim();
    if (!trimmed || trimmed === CONFIGURED_PLACEHOLDER || trimmed.startsWith('•')) {
      const previous = existing?.[fieldKey];
      if (typeof previous === 'string' && previous.length > 0) result[fieldKey] = previous;
      else delete result[fieldKey];
      continue;
    }
    if (isEncryptedValue(trimmed)) {
      result[fieldKey] = trimmed;
      continue;
    }
    result[fieldKey] = await encryptValueIfNeeded(trimmed);
  }
  return result;
}

async function decryptIntegrationConfig(
  config: Record<string, unknown>,
  sensitiveKeys?: Set<string>,
): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = { ...config };
  const keysToDecrypt =
    sensitiveKeys ??
    new Set(
      Object.keys(config).filter((key) => isSensitiveFieldKey(key) || isEncryptedValue(config[key])),
    );
  for (const fieldKey of keysToDecrypt) {
    const rawValue = config[fieldKey];
    if (typeof rawValue !== 'string') continue;
    result[fieldKey] = await decryptValueIfNeeded(rawValue);
  }
  return result;
}

function maskIntegrationConfigForClient(
  config: Record<string, unknown>,
  sensitiveKeys: Set<string>,
): { config: Record<string, string>; configured_sensitive_fields: string[] } {
  const masked: Record<string, string> = {};
  const configured: string[] = [];
  for (const [fieldKey, rawValue] of Object.entries(config)) {
    if (typeof rawValue !== 'string') {
      if (rawValue != null) masked[fieldKey] = String(rawValue);
      continue;
    }
    if (sensitiveKeys.has(fieldKey) && rawValue.length > 0) {
      masked[fieldKey] = CONFIGURED_PLACEHOLDER;
      configured.push(fieldKey);
      continue;
    }
    masked[fieldKey] = rawValue;
  }
  return { config: masked, configured_sensitive_fields: configured };
}

interface OrganizationIntegrationRow {
  id: string;
  user_id: string | null;
  provider_id: string;
  enabled: boolean | null;
  config: Record<string, unknown> | null;
  connection_status: string | null;
}

async function getSensitiveFieldKeysForProvider(
  supabase: SupabaseClient,
  providerId: string,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('integration_fields')
    .select('field_key, is_sensitive')
    .eq('provider_id', providerId);
  if (error) throw error;
  const fieldKeys = (data ?? []).map((row) => row.field_key as string);
  const explicit = (data ?? [])
    .filter((row) => row.is_sensitive === true)
    .map((row) => row.field_key as string);
  return resolveSensitiveFieldKeys(fieldKeys, explicit);
}

async function fetchOrganizationIntegrationRow(
  supabase: SupabaseClient,
  providerId: string,
  userId?: string | null,
): Promise<OrganizationIntegrationRow | null> {
  if (userId) {
    const { data, error } = await supabase
      .from('organization_integrations')
      .select('id, user_id, provider_id, enabled, config, connection_status')
      .eq('provider_id', providerId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    if (data) return data as OrganizationIntegrationRow;
  }
  const { data: orgWide, error: orgError } = await supabase
    .from('organization_integrations')
    .select('id, user_id, provider_id, enabled, config, connection_status')
    .eq('provider_id', providerId)
    .is('user_id', null)
    .maybeSingle();
  if (orgError) throw orgError;
  return (orgWide as OrganizationIntegrationRow | null) ?? null;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function hasRole(
  supabase: SupabaseClient,
  userId: string,
  role: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', role)
    .maybeSingle();
  return !!data;
}

function isServiceRoleRequest(token: string, serviceKey: string): boolean {
  return token === serviceKey;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'missing_auth', message: 'Authorization required' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    let body: Record<string, unknown> = {};
    if (req.method !== 'GET') {
      try {
        body = await req.json();
      } catch {
        body = {};
      }
    }

    const url = new URL(req.url);
    const action = String(body.action ?? url.searchParams.get('action') ?? 'save');

    // Internal decrypt for other edge functions (service role only)
    if (action === 'decrypt_internal') {
      if (!isServiceRoleRequest(token, serviceKey)) {
        return jsonResponse({ error: 'forbidden', message: 'Service role required' }, 403);
      }
      const providerId = String(body.provider_id ?? '');
      const rawConfig = (body.config ?? {}) as Record<string, unknown>;
      if (!providerId || !rawConfig || typeof rawConfig !== 'object') {
        return jsonResponse({ error: 'invalid_request', message: 'provider_id and config required' }, 400);
      }
      const sensitiveKeys = await getSensitiveFieldKeysForProvider(supabaseAdmin, providerId);
      const config = await decryptIntegrationConfig(rawConfig, sensitiveKeys);
      return jsonResponse({ config });
    }

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser(token);

    if (userError || !user) {
      return jsonResponse({ error: 'invalid_token', message: 'Invalid or expired token' }, 401);
    }

    const isAdmin = await hasRole(supabaseAdmin, user.id, 'admin');
    if (!isAdmin) {
      return jsonResponse(
        { error: 'forbidden', message: 'Only administrators can manage integration credentials' },
        403,
      );
    }

    if (req.method === 'GET' || req.method === 'POST' || req.method === 'PUT') {
      const providerId = String(body.provider_id ?? url.searchParams.get('provider_id') ?? '');
      if (!providerId) {
        return jsonResponse({ error: 'invalid_request', message: 'provider_id is required' }, 400);
      }

      if (action === 'get') {
        const existing = await fetchOrganizationIntegrationRow(supabaseAdmin, providerId, user.id);
        const sensitiveKeys = await getSensitiveFieldKeysForProvider(supabaseAdmin, providerId);
        const config = (existing?.config ?? {}) as Record<string, unknown>;
        const masked = maskIntegrationConfigForClient(config, sensitiveKeys);
        return jsonResponse({
          integration: existing ? { ...existing, config: masked.config } : null,
          configured_sensitive_fields: masked.configured_sensitive_fields,
        });
      }

      const config = (body.config ?? {}) as Record<string, unknown>;
      const enabled = body.enabled !== false;
      const sensitiveKeys = await getSensitiveFieldKeysForProvider(supabaseAdmin, providerId);
      const existing = await fetchOrganizationIntegrationRow(supabaseAdmin, providerId, user.id);
      const encryptedConfig = await encryptIntegrationConfig(
        config,
        sensitiveKeys,
        (existing?.config ?? null) as Record<string, unknown> | null,
      );

      const now = new Date().toISOString();
      const { data, error } = await supabaseAdmin
        .from('organization_integrations')
        .upsert(
          {
            user_id: user.id,
            provider_id: providerId,
            config: encryptedConfig,
            enabled,
            connection_status: 'connected',
            last_tested_at: now,
          },
          { onConflict: 'user_id,provider_id' },
        )
        .select(
          'id, user_id, provider_id, enabled, config, connection_status, connection_message, last_tested_at, last_sync_at, created_at, updated_at',
        )
        .single();

      if (error) throw error;

      const masked = maskIntegrationConfigForClient(
        (data.config ?? {}) as Record<string, unknown>,
        sensitiveKeys,
      );

      return jsonResponse({
        integration: { ...data, config: masked.config },
        configured_sensitive_fields: masked.configured_sensitive_fields,
      });
    }

    return jsonResponse({ error: 'method_not_allowed', message: 'Method not allowed' }, 405);
  } catch (error) {
    console.error('[integration-config] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return jsonResponse({ error: 'server_error', message }, 500);
  }
});
