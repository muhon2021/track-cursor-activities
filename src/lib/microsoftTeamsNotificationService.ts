/**
 * Microsoft Teams Channel Notification Service
 * Handles sending messages to Teams channels with retry and error handling
 */

import { callGraphAPI, ForbiddenError, NotFoundError, NetworkError, ServiceError } from './microsoftGraphClient';

// ============================================================================
// Types
// ============================================================================

export interface SendChannelMessageRequest {
  teamId: string;
  channelId: string;
  content: string;
  contentType?: 'text' | 'html';
}

export interface ChannelMessageResponse {
  id: string;
  createdDateTime: string;
  webUrl: string;
  body: {
    content: string;
    contentType: string;
  };
}

export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  webUrl?: string;
  error?: string;
  errorType?: 'permission' | 'not_found' | 'rate_limit' | 'network' | 'unknown';
}

// ============================================================================
// Constants
// ============================================================================

const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 1000;
const BACKOFF_MULTIPLIER = 2;
const MAX_MESSAGE_LENGTH = 28000; // ~28KB limit for Graph API

// ============================================================================
// Utilities
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if an error is a rate limit error (429)
 */
function isRateLimitError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    'statusCode' in error &&
    (error as { statusCode: number }).statusCode === 429
  );
}

/**
 * Extract Retry-After value from error (in seconds)
 */
function getRetryAfterSeconds(error: unknown): number {
  if (error && typeof error === 'object' && 'headers' in error) {
    const headers = (error as { headers?: Record<string, string | number> }).headers;
    const retryAfter = headers?.['retry-after'];
    if (typeof retryAfter === 'number') return retryAfter;
    if (typeof retryAfter === 'string') {
      const parsed = parseInt(retryAfter, 10);
      if (!isNaN(parsed)) return parsed;
    }
  }
  return 5; // Default to 5 seconds
}

// ============================================================================
// Retry Logic
// ============================================================================

/**
 * Execute a function with retry logic for transient failures
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  context: string
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const delay = INITIAL_DELAY_MS * Math.pow(BACKOFF_MULTIPLIER, attempt - 1);
        console.log(`[TeamsNotify] Retry ${attempt}/${MAX_RETRIES} for ${context} after ${delay}ms`);
        await sleep(delay);
      }
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Handle rate limiting (429) - use Retry-After header
      if (isRateLimitError(error)) {
        const retryAfter = getRetryAfterSeconds(error);
        console.warn(`[TeamsNotify] Rate limited. Waiting ${retryAfter}s...`);
        await sleep(retryAfter * 1000);
        continue;
      }
      
      // Don't retry permission or not-found errors
      if (error instanceof ForbiddenError || error instanceof NotFoundError) {
        throw error;
      }
      
      // Retry on network/service errors
      if (error instanceof NetworkError || error instanceof ServiceError) {
        console.warn(`[TeamsNotify] Transient error on ${context}:`, error.message);
        continue;
      }
      
      throw error;
    }
  }
  
  throw lastError || new Error(`${context} failed after ${MAX_RETRIES} retries`);
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Send a message to a Microsoft Teams channel
 * 
 * @param request - The message request with teamId, channelId, and content
 * @returns Result object with success status and message details or error info
 */
export async function sendChannelMessage(
  request: SendChannelMessageRequest
): Promise<SendMessageResult> {
  const { teamId, channelId, content, contentType = 'text' } = request;
  
  // Validate inputs
  if (!teamId || typeof teamId !== 'string' || teamId.trim() === '') {
    return {
      success: false,
      error: 'Team ID is required',
      errorType: 'unknown',
    };
  }
  
  if (!channelId || typeof channelId !== 'string' || channelId.trim() === '') {
    return {
      success: false,
      error: 'Channel ID is required',
      errorType: 'unknown',
    };
  }
  
  if (!content || typeof content !== 'string' || content.trim() === '') {
    return {
      success: false,
      error: 'Message content is required',
      errorType: 'unknown',
    };
  }
  
  if (content.length > MAX_MESSAGE_LENGTH) {
    return {
      success: false,
      error: `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters`,
      errorType: 'unknown',
    };
  }
  
  console.log(`[TeamsNotify] Sending message to team=${teamId}, channel=${channelId}`);
  
  try {
    const response = await withRetry(
      () => callGraphAPI<ChannelMessageResponse>(
        `/teams/${teamId}/channels/${channelId}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({
            body: {
              content: content.trim(),
              contentType: contentType,
            },
          }),
        }
      ),
      'sendChannelMessage'
    );
    
    console.log(`[TeamsNotify] Message sent successfully. ID: ${response.id}`);
    
    return {
      success: true,
      messageId: response.id,
      webUrl: response.webUrl,
    };
  } catch (error) {
    console.error('[TeamsNotify] Failed to send message:', error);
    
    // Handle permission errors (403)
    if (error instanceof ForbiddenError) {
      const message = error.message.toLowerCase();
      
      if (message.includes('channelmessage.send') || message.includes('scope')) {
        return {
          success: false,
          error: 'Missing permission to send channel messages. Please disconnect and reconnect your Microsoft account.',
          errorType: 'permission',
        };
      }
      
      if (message.includes('not a member') || message.includes('membership')) {
        return {
          success: false,
          error: 'You are not a member of this Team or channel.',
          errorType: 'permission',
        };
      }
      
      return {
        success: false,
        error: 'You do not have permission to post to this channel. It may be read-only or moderated.',
        errorType: 'permission',
      };
    }
    
    // Handle not found errors (404)
    if (error instanceof NotFoundError) {
      return {
        success: false,
        error: 'Team or channel not found. It may have been deleted or you no longer have access.',
        errorType: 'not_found',
      };
    }
    
    // Handle rate limiting (shouldn't reach here due to retry logic, but just in case)
    if (isRateLimitError(error)) {
      const retryAfter = getRetryAfterSeconds(error);
      return {
        success: false,
        error: `Too many messages sent. Please wait ${retryAfter} seconds and try again.`,
        errorType: 'rate_limit',
      };
    }
    
    // Handle network errors
    if (error instanceof NetworkError) {
      return {
        success: false,
        error: 'Network error. Please check your connection and try again.',
        errorType: 'network',
      };
    }
    
    // Unknown errors
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred',
      errorType: 'unknown',
    };
  }
}
