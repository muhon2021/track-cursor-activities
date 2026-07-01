/**
 * Standardized Error Handling for Edge Functions
 * Provides consistent error logging and response formatting
 */

export interface LogContext {
  requestId: string;
  userId?: string;
  function: string;
  timestamp: string;
  ip?: string;
  userAgent?: string;
}

export interface ErrorDetails {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  stack?: string;
}

/**
 * Generate unique request ID
 */
export function generateRequestId(): string {
  return crypto.randomUUID();
}

/**
 * Create log context from request
 */
export function createLogContext(
  req: Request,
  functionName: string,
  userId?: string
): LogContext {
  return {
    requestId: generateRequestId(),
    userId,
    function: functionName,
    timestamp: new Date().toISOString(),
    ip: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || undefined,
    userAgent: req.headers.get('user-agent') || undefined,
  };
}

/**
 * Log error with full context
 */
export function logError(
  context: LogContext,
  error: Error | unknown,
  additionalData?: Record<string, unknown>
): void {
  const errorDetails: ErrorDetails = {
    code: error instanceof Error ? error.name : 'UnknownError',
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    details: additionalData,
  };

  console.error('[ERROR]', {
    ...context,
    error: errorDetails,
  });
}

/**
 * Log warning with context
 */
export function logWarning(
  context: LogContext,
  message: string,
  data?: Record<string, unknown>
): void {
  console.warn('[WARNING]', {
    ...context,
    message,
    ...data,
  });
}

/**
 * Log info with context
 */
export function logInfo(
  context: LogContext,
  message: string,
  data?: Record<string, unknown>
): void {
  console.log('[INFO]', {
    ...context,
    message,
    ...data,
  });
}

/**
 * Format error response
 */
export function errorResponse(
  error: Error | unknown,
  status: number,
  corsHeaders: Record<string, string>,
  includeStack = false
): Response {
  const errorDetails: ErrorDetails = {
    code: error instanceof Error ? error.name : 'InternalError',
    message: error instanceof Error ? error.message : 'An unexpected error occurred',
  };

  if (includeStack && error instanceof Error) {
    errorDetails.stack = error.stack;
  }

  return new Response(
    JSON.stringify({
      status: 'error',
      error: errorDetails,
    }),
    {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Timeout wrapper for promises
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage = 'Operation timed out'
): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
  );

  return Promise.race([promise, timeout]);
}

/**
 * Retry wrapper with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    backoffMultiplier = 2,
  } = options;

  let lastError: Error | unknown;
  let delay = initialDelayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries) {
        console.warn(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay = Math.min(delay * backoffMultiplier, maxDelayMs);
      }
    }
  }

  throw lastError;
}

/**
 * Safe async wrapper that catches and logs errors
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
  context: LogContext,
  defaultValue: T
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    logError(context, error);
    return defaultValue;
  }
}

/**
 * Validation error
 */
export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Not found error
 */
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

/**
 * Forbidden error
 */
export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}
