// =====================================================
// API Middleware - Scope-Based Access Control
// =====================================================
// Reusable middleware for validating API keys with
// scope-based access control and rate limiting
// =====================================================

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

export interface ApiKeyValidationResult {
  valid: boolean;
  api_key_id?: string;
  user_id?: string;
  key_name?: string;
  scopes?: string[];
  control_tower_name?: string;
  rate_limit?: {
    allowed: boolean;
    limit: number;
    remaining: number;
    reset_at: string;
    current_count: number;
  };
  error?: string;
  message?: string;
  required_scope?: string;
  available_scopes?: string[];
}

export interface ApiRequestMetadata {
  endpoint: string;
  method: string;
  ip_address: string;
  user_agent: string;
  request_start: number;
}

export interface ApiMiddlewareOptions {
  requiredScope?: string;
  logUsage?: boolean;
}

/**
 * Extract API key from request headers
 * Supports both Authorization: Bearer <key> and x-api-key: <key>
 */
export function extractApiKey(req: Request): string | null {
  const authHeader = req.headers.get('Authorization');
  const apiKeyHeader = req.headers.get('x-api-key');

  if (authHeader) {
    if (authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    return authHeader;
  }

  return apiKeyHeader;
}

/**
 * Extract request metadata for logging
 */
export function extractRequestMetadata(req: Request): ApiRequestMetadata {
  const url = new URL(req.url);
  const ipAddress = req.headers.get('x-forwarded-for') ||
                    req.headers.get('x-real-ip') ||
                    'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';

  return {
    endpoint: url.pathname,
    method: req.method,
    ip_address: ipAddress,
    user_agent: userAgent,
    request_start: Date.now(),
  };
}

/**
 * Validate API key with scope checking
 */
export async function validateApiKeyWithScope(
  supabase: SupabaseClient,
  apiKey: string,
  requiredScope: string | null,
  ipAddress: string
): Promise<ApiKeyValidationResult> {
  const { data: validationResult, error: validateError } = await supabase
    .rpc('validate_api_key_with_scope', {
      p_api_key: apiKey,
      p_required_scope: requiredScope,
      p_ip_address: ipAddress,
    });

  if (validateError) {
    console.error('API key validation error:', validateError);
    return {
      valid: false,
      error: 'validation_error',
      message: 'Failed to validate API key',
    };
  }

  return validationResult as ApiKeyValidationResult;
}

/**
 * Log API usage to database
 */
export async function logApiUsage(
  supabase: SupabaseClient,
  apiKeyId: string,
  metadata: ApiRequestMetadata,
  statusCode: number,
  scopeRequired: string | null = null,
  errorMessage: string | null = null
): Promise<void> {
  const responseTimeMs = Date.now() - metadata.request_start;

  try {
    await supabase.rpc('log_api_usage', {
      p_api_key_id: apiKeyId,
      p_endpoint: metadata.endpoint,
      p_method: metadata.method,
      p_scope_required: scopeRequired,
      p_status_code: statusCode,
      p_response_time_ms: responseTimeMs,
      p_ip_address: metadata.ip_address,
      p_user_agent: metadata.user_agent,
      p_error_message: errorMessage,
    });
  } catch (error) {
    console.error('Failed to log API usage:', error);
    // Don't throw - logging failure shouldn't break the request
  }
}

/**
 * Build error response with proper status codes and headers
 */
export function buildErrorResponse(
  validationResult: ApiKeyValidationResult,
  corsHeaders: Record<string, string>
): Response {
  const errorCode = validationResult.error || 'invalid_key';
  const errorMessage = validationResult.message || 'Invalid API key';

  // Determine appropriate HTTP status code
  let statusCode = 401;
  if (errorCode === 'rate_limit_exceeded') {
    statusCode = 429; // Too Many Requests
  } else if (errorCode === 'insufficient_scope') {
    statusCode = 403; // Forbidden
  } else if (errorCode === 'ip_not_allowed') {
    statusCode = 403; // Forbidden
  } else if (errorCode === 'validation_error') {
    statusCode = 500; // Internal Server Error
  }

  // Build error response body
  const errorResponse: Record<string, unknown> = {
    status: 'error',
    error: errorCode,
    message: errorMessage,
  };

  // Include additional details for specific errors
  if (errorCode === 'insufficient_scope') {
    errorResponse.required_scope = validationResult.required_scope;
    errorResponse.available_scopes = validationResult.available_scopes;
  } else if (errorCode === 'rate_limit_exceeded') {
    errorResponse.rate_limit = validationResult.rate_limit;
  }

  // Build headers
  const headers: Record<string, string> = {
    ...corsHeaders,
    'Content-Type': 'application/json',
  };

  // Add rate limit headers if available
  if (validationResult.rate_limit) {
    headers['X-RateLimit-Limit'] = String(validationResult.rate_limit.limit);
    headers['X-RateLimit-Remaining'] = String(validationResult.rate_limit.remaining);
    headers['X-RateLimit-Reset'] = validationResult.rate_limit.reset_at;
  }

  return new Response(JSON.stringify(errorResponse), {
    status: statusCode,
    headers,
  });
}

/**
 * Build success response with rate limit headers
 */
export function buildSuccessResponse(
  data: unknown,
  validationResult: ApiKeyValidationResult,
  corsHeaders: Record<string, string>
): Response {
  const headers: Record<string, string> = {
    ...corsHeaders,
    'Content-Type': 'application/json',
  };

  // Add rate limit headers
  if (validationResult.rate_limit) {
    headers['X-RateLimit-Limit'] = String(validationResult.rate_limit.limit);
    headers['X-RateLimit-Remaining'] = String(validationResult.rate_limit.remaining);
    headers['X-RateLimit-Reset'] = validationResult.rate_limit.reset_at;
  }

  return new Response(
    JSON.stringify({
      status: 'success',
      data,
    }),
    {
      status: 200,
      headers,
    }
  );
}

/**
 * Main middleware function - validates API key and returns validation result
 * Use this in your edge functions for scope-based access control
 */
export async function validateApiRequest(
  req: Request,
  options: ApiMiddlewareOptions = {}
): Promise<{
  validationResult: ApiKeyValidationResult | null;
  supabase: SupabaseClient;
  metadata: ApiRequestMetadata;
  corsHeaders: Record<string, string>;
  errorResponse?: Response;
}> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  };

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return {
      validationResult: null,
      supabase: null as any,
      metadata: null as any,
      corsHeaders,
      errorResponse: new Response(null, { headers: corsHeaders }),
    };
  }

  // Initialize Supabase client
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Extract metadata
  const metadata = extractRequestMetadata(req);

  // Extract API key
  const apiKey = extractApiKey(req);

  if (!apiKey) {
    const errorResult: ApiKeyValidationResult = {
      valid: false,
      error: 'missing_api_key',
      message: 'No API key provided. Include in Authorization header or x-api-key header.',
    };

    // Log the failed attempt
    if (options.logUsage) {
      await supabase.rpc('log_audit_event', {
        p_user_id: null,
        p_action: 'api_request_failed',
        p_entity_type: 'api_endpoint',
        p_entity_id: metadata.endpoint,
        p_metadata: { error: 'missing_api_key', method: metadata.method },
        p_ip_address: metadata.ip_address,
        p_user_agent: metadata.user_agent,
        p_status: 'failure',
        p_error_message: 'Missing API key',
      });
    }

    return {
      validationResult: errorResult,
      supabase,
      metadata,
      corsHeaders,
      errorResponse: buildErrorResponse(errorResult, corsHeaders),
    };
  }

  // Validate API key with scope
  const validationResult = await validateApiKeyWithScope(
    supabase,
    apiKey,
    options.requiredScope || null,
    metadata.ip_address
  );

  // If validation failed, build error response
  if (!validationResult.valid) {
    // Log the failed request
    if (options.logUsage) {
      await supabase.rpc('log_audit_event', {
        p_user_id: null,
        p_action: 'api_request_failed',
        p_entity_type: 'api_endpoint',
        p_entity_id: metadata.endpoint,
        p_metadata: {
          error: validationResult.error,
          method: metadata.method,
          scope: options.requiredScope,
        },
        p_ip_address: metadata.ip_address,
        p_user_agent: metadata.user_agent,
        p_status: 'failure',
        p_error_message: validationResult.message,
      });
    }

    return {
      validationResult,
      supabase,
      metadata,
      corsHeaders,
      errorResponse: buildErrorResponse(validationResult, corsHeaders),
    };
  }

  // Validation successful
  return {
    validationResult,
    supabase,
    metadata,
    corsHeaders,
  };
}

/**
 * Helper to finalize API request with logging
 */
export async function finalizeApiRequest(
  supabase: SupabaseClient,
  validationResult: ApiKeyValidationResult,
  metadata: ApiRequestMetadata,
  statusCode: number,
  scopeRequired: string | null = null,
  errorMessage: string | null = null
): Promise<void> {
  if (validationResult.api_key_id) {
    await logApiUsage(
      supabase,
      validationResult.api_key_id,
      metadata,
      statusCode,
      scopeRequired,
      errorMessage
    );
  }
}
