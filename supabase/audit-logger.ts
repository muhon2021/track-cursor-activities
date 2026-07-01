/**
 * Integration Audit Logging Utility
 *
 * Provides comprehensive audit logging for all integration operations
 * including configuration changes, API calls, tests, and health monitoring.
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

export type IntegrationType = 'ai' | 'email' | 'webhook' | 'calendar';
export type LogStatus = 'success' | 'error' | 'pending';

export interface AuditLogOptions {
  // Core fields
  integration_type: IntegrationType;
  integration_id?: string;
  action: string; // e.g., 'config_create', 'config_update', 'test_connection', 'api_call'
  status: LogStatus;

  // Audit trail
  performed_by?: string; // user ID
  before_state?: any;
  after_state?: any;

  // Request/Response
  request_data?: any;
  response_data?: any;
  error_message?: string;

  // Performance & compliance
  execution_time_ms?: number;
  ip_address?: string;
  user_agent?: string;

  // Additional context
  metadata?: Record<string, any>;
}

export interface BatchAuditLogOptions {
  logs: AuditLogOptions[];
}

/**
 * Sanitize sensitive data from objects before logging
 */
function sanitizeSensitiveData(data: any): any {
  if (!data) return data;

  const sensitiveKeys = [
    'password',
    'api_key',
    'apiKey',
    'api_secret',
    'apiSecret',
    'access_token',
    'accessToken',
    'refresh_token',
    'refreshToken',
    'client_secret',
    'clientSecret',
    'private_key',
    'privateKey',
    'secret',
    'token',
    'authorization',
    'credentials',
    'bearer'
  ];

  if (typeof data === 'string') {
    // Check if it's a JWT or Bearer token
    if (data.match(/^(Bearer\s+)?[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*$/)) {
      return '[REDACTED_TOKEN]';
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeSensitiveData(item));
  }

  if (typeof data === 'object' && data !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = sensitiveKeys.some(sk => lowerKey.includes(sk));

      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeSensitiveData(value);
      }
    }
    return sanitized;
  }

  return data;
}

/**
 * Extract IP address from request headers
 */
export function extractIpAddress(request: Request): string | undefined {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  return undefined;
}

/**
 * Extract user agent from request headers
 */
export function extractUserAgent(request: Request): string | undefined {
  return request.headers.get('user-agent') || undefined;
}

/**
 * Log a single audit event
 *
 * @param supabase - Supabase client (should use service role for writes)
 * @param options - Audit log options
 * @returns The created log entry or null if logging failed
 */
export async function logAuditEvent(
  supabase: SupabaseClient,
  options: AuditLogOptions
): Promise<any | null> {
  try {
    // Sanitize sensitive data
    const sanitized = {
      integration_type: options.integration_type,
      integration_id: options.integration_id,
      action: options.action,
      status: options.status,
      performed_by: options.performed_by,
      before_state: options.before_state ? sanitizeSensitiveData(options.before_state) : null,
      after_state: options.after_state ? sanitizeSensitiveData(options.after_state) : null,
      request_data: options.request_data ? sanitizeSensitiveData(options.request_data) : null,
      response_data: options.response_data ? sanitizeSensitiveData(options.response_data) : null,
      error_message: options.error_message,
      execution_time_ms: options.execution_time_ms,
      ip_address: options.ip_address,
      user_agent: options.user_agent,
      metadata: options.metadata || {}
    };

    const { data, error } = await supabase
      .from('integration_logs')
      .insert(sanitized)
      .select()
      .single();

    if (error) {
      console.error('Failed to log audit event:', error);
      return null;
    }

    return data;
  } catch (error) {
    // Never throw - logging failures should not break main operations
    console.error('Exception while logging audit event:', error);
    return null;
  }
}

/**
 * Log multiple audit events in a batch
 *
 * @param supabase - Supabase client
 * @param options - Batch audit log options
 * @returns Array of created log entries (may include nulls for failures)
 */
export async function logAuditEventBatch(
  supabase: SupabaseClient,
  options: BatchAuditLogOptions
): Promise<(any | null)[]> {
  try {
    const sanitized = options.logs.map(log => ({
      integration_type: log.integration_type,
      integration_id: log.integration_id,
      action: log.action,
      status: log.status,
      performed_by: log.performed_by,
      before_state: log.before_state ? sanitizeSensitiveData(log.before_state) : null,
      after_state: log.after_state ? sanitizeSensitiveData(log.after_state) : null,
      request_data: log.request_data ? sanitizeSensitiveData(log.request_data) : null,
      response_data: log.response_data ? sanitizeSensitiveData(log.response_data) : null,
      error_message: log.error_message,
      execution_time_ms: log.execution_time_ms,
      ip_address: log.ip_address,
      user_agent: log.user_agent,
      metadata: log.metadata || {}
    }));

    const { data, error } = await supabase
      .from('integration_logs')
      .insert(sanitized)
      .select();

    if (error) {
      console.error('Failed to log batch audit events:', error);
      return options.logs.map(() => null);
    }

    return data || [];
  } catch (error) {
    console.error('Exception while logging batch audit events:', error);
    return options.logs.map(() => null);
  }
}

/**
 * Helper to wrap an async operation with automatic audit logging
 *
 * @param supabase - Supabase client
 * @param options - Base audit log options (status will be set automatically)
 * @param operation - The async operation to execute and log
 * @returns The result of the operation
 */
export async function withAuditLog<T>(
  supabase: SupabaseClient,
  options: Omit<AuditLogOptions, 'status' | 'execution_time_ms' | 'error_message'>,
  operation: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();

  try {
    const result = await operation();
    const executionTime = Date.now() - startTime;

    // Log success
    await logAuditEvent(supabase, {
      ...options,
      status: 'success',
      execution_time_ms: executionTime,
      response_data: options.response_data || result
    });

    return result;
  } catch (error) {
    const executionTime = Date.now() - startTime;

    // Log failure
    await logAuditEvent(supabase, {
      ...options,
      status: 'error',
      execution_time_ms: executionTime,
      error_message: error instanceof Error ? error.message : String(error)
    });

    throw error;
  }
}

/**
 * Create a logger instance bound to specific integration context
 */
export function createIntegrationLogger(
  supabase: SupabaseClient,
  integration_type: IntegrationType,
  integration_id?: string,
  performed_by?: string
) {
  return {
    log: (options: Omit<AuditLogOptions, 'integration_type' | 'integration_id' | 'performed_by'>) =>
      logAuditEvent(supabase, {
        integration_type,
        integration_id,
        performed_by,
        ...options
      }),

    logSuccess: (action: string, additionalData?: Partial<AuditLogOptions>) =>
      logAuditEvent(supabase, {
        integration_type,
        integration_id,
        performed_by,
        action,
        status: 'success',
        ...additionalData
      }),

    logError: (action: string, error: Error | string, additionalData?: Partial<AuditLogOptions>) =>
      logAuditEvent(supabase, {
        integration_type,
        integration_id,
        performed_by,
        action,
        status: 'error',
        error_message: error instanceof Error ? error.message : error,
        ...additionalData
      }),

    withLog: <T>(
      action: string,
      operation: () => Promise<T>,
      additionalData?: Partial<AuditLogOptions>
    ) =>
      withAuditLog(
        supabase,
        {
          integration_type,
          integration_id,
          performed_by,
          action,
          ...additionalData
        },
        operation
      )
  };
}

/**
 * Query audit logs with filtering
 */
export interface AuditLogQuery {
  integration_type?: IntegrationType;
  integration_id?: string;
  action?: string;
  status?: LogStatus;
  performed_by?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

export async function queryAuditLogs(
  supabase: SupabaseClient,
  query: AuditLogQuery = {}
) {
  let queryBuilder = supabase
    .from('integration_logs')
    .select('*, performed_by_profile:performed_by(id, email, full_name)', { count: 'exact' });

  if (query.integration_type) {
    queryBuilder = queryBuilder.eq('integration_type', query.integration_type);
  }

  if (query.integration_id) {
    queryBuilder = queryBuilder.eq('integration_id', query.integration_id);
  }

  if (query.action) {
    queryBuilder = queryBuilder.eq('action', query.action);
  }

  if (query.status) {
    queryBuilder = queryBuilder.eq('status', query.status);
  }

  if (query.performed_by) {
    queryBuilder = queryBuilder.eq('performed_by', query.performed_by);
  }

  if (query.date_from) {
    queryBuilder = queryBuilder.gte('created_at', query.date_from);
  }

  if (query.date_to) {
    queryBuilder = queryBuilder.lte('created_at', query.date_to);
  }

  queryBuilder = queryBuilder.order('created_at', { ascending: false });

  if (query.limit) {
    queryBuilder = queryBuilder.limit(query.limit);
  }

  if (query.offset) {
    queryBuilder = queryBuilder.range(query.offset, query.offset + (query.limit || 50) - 1);
  }

  return queryBuilder;
}
