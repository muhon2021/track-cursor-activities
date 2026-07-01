/**
 * Microsoft Graph API Client
 * Production-ready client with token management, error handling, and automatic retry
 */

import { getMSALInstance } from './msalConfig';
import { getStoredMSALResponse, getStoredGraphResponse, acquireTokenSilently } from './azureAuth';

// ============================================================================
// Types
// ============================================================================

export interface GraphUser {
  id: string;
  displayName: string;
  mail: string | null;
  userPrincipalName: string;
  givenName?: string;
  surname?: string;
  jobTitle?: string;
  officeLocation?: string;
}

export interface TokenMetadata {
  audience: string;
  issuer: string;
  scopes: string[];
  expiresAt: Date;
  isExpired: boolean;
  expiresInMinutes: number;
}

// ============================================================================
// Error Classes
// ============================================================================

export class GraphError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public errorCode?: string,
    public requestId?: string
  ) {
    super(message);
    this.name = 'GraphError';
  }
}

export class UnauthorizedError extends GraphError {
  constructor(message: string = 'Access token is invalid or expired') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends GraphError {
  constructor(message: string = 'Insufficient permissions for this operation') {
    super(message, 403, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends GraphError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ServiceError extends GraphError {
  constructor(message: string = 'Microsoft Graph service error') {
    super(message, 500, 'SERVICE_ERROR');
    this.name = 'ServiceError';
  }
}

export class NetworkError extends GraphError {
  constructor(message: string = 'Network request failed') {
    super(message, 0, 'NETWORK_ERROR');
    this.name = 'NetworkError';
  }
}

export class TokenExpiredError extends GraphError {
  constructor(message: string = 'Session expired. Please reconnect your Microsoft account.') {
    super(message, 401, 'TOKEN_EXPIRED');
    this.name = 'TokenExpiredError';
  }
}

// ============================================================================
// Token Utilities
// ============================================================================

/**
 * Decode a JWT token to extract claims (without verification)
 */
export function decodeToken(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch (error) {
    console.error('Failed to decode token:', error);
    return null;
  }
}

/**
 * Get metadata from a token
 */
export function getTokenMetadata(token: string): TokenMetadata | null {
  const claims = decodeToken(token);
  if (!claims) return null;

  const expiresAt = new Date(claims.exp * 1000);
  const now = new Date();
  const expiresInMinutes = Math.round((expiresAt.getTime() - now.getTime()) / 60000);

  return {
    audience: claims.aud || 'unknown',
    issuer: claims.iss || 'unknown',
    scopes: claims.scp?.split(' ') || [],
    expiresAt,
    isExpired: expiresInMinutes <= 0,
    expiresInMinutes,
  };
}

// ============================================================================
// Token Management
// ============================================================================

/**
 * Get a valid access token, refreshing if necessary
 * @param forceRefresh - Force a token refresh even if current token is valid
 */
export async function getAccessToken(forceRefresh = false): Promise<string> {
  // Prefer Graph-specific token from "Connect with Microsoft" (never use app sign-in token for Graph)
  const graphResponse = getStoredGraphResponse();
  const graphToken = graphResponse?.accessToken?.trim();
  const genericResponse = getStoredMSALResponse();
  const genericToken = genericResponse?.accessToken?.trim();

  if (graphToken && !forceRefresh) {
    const metadata = getTokenMetadata(graphToken);
    if (metadata && metadata.expiresInMinutes > 1) {
      console.log(`[Graph] Using Graph token (expires in ${metadata.expiresInMinutes} min)`);
      return graphToken;
    }
    if (metadata && !metadata.isExpired) {
      console.warn('[Graph] Using Graph token (expiring soon)');
      return graphToken;
    }
  }

  // Try silent token acquisition (MSAL; has Graph scopes)
  try {
    const silentResult = await acquireTokenSilently();
    if (silentResult?.accessToken) {
      const t = silentResult.accessToken.trim();
      if (isTokenForGraph(t)) {
        console.log('[Graph] Got fresh token via silent refresh');
        return t;
      }
    }
  } catch (error) {
    console.warn('[Graph] Silent token acquisition failed:', error);
  }

  // Use Graph-stored token even if expired (API will return 401; we never send app token)
  if (graphToken) {
    console.warn('[Graph] Using stored Graph token (may be expiring or expired)');
    return graphToken;
  }
  if (genericToken && isTokenForGraph(genericToken)) {
    console.warn('[Graph] Using generic-stored Graph token');
    return genericToken;
  }

  throw new TokenExpiredError(
    'No Microsoft token found for Teams. Click "Connect with Microsoft" on this page (or disconnect then connect again), then try creating the meeting.'
  );
}

// ============================================================================
// API Caller
// ============================================================================

const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';

/** Microsoft Graph token audience values */
const GRAPH_AUDIENCE_IDS = [
  'https://graph.microsoft.com',
  '00000003-0000-0000-c000-000000000000',
];

/** Graph scope prefixes we request in Connect flow; token with any of these is for Graph */
const GRAPH_SCOPE_INDICATORS = ['User.Read', 'OnlineMeetings.', 'Team.Read', 'Channel.', 'Calendars.', 'Mail.', 'openid', 'profile'];

function isTokenForGraph(token: string): boolean {
  const claims = decodeToken(token);
  if (!claims) return false;
  const aud = claims.aud != null
    ? String(Array.isArray(claims.aud) ? claims.aud[0] : claims.aud).trim()
    : '';
  if (aud && GRAPH_AUDIENCE_IDS.includes(aud)) return true;
  const scp = (claims.scp ?? claims.roles ?? '') as string | string[];
  const scopeStr = typeof scp === 'string' ? scp : (Array.isArray(scp) ? scp.join(' ') : '');
  return GRAPH_SCOPE_INDICATORS.some((ind) => scopeStr.includes(ind));
}

interface CallOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
  skipRetry?: boolean;
}

/**
 * Make an authenticated call to Microsoft Graph API
 * Automatically handles token refresh and retries on 401
 */
export async function callGraphAPI<T>(
  endpoint: string,
  options: CallOptions = {}
): Promise<T> {
  const { skipRetry = false, headers: customHeaders = {}, ...fetchOptions } = options;
  
  // Get access token (trimmed; must be for Graph)
  let accessToken: string;
  try {
    accessToken = (await getAccessToken()).trim();
  } catch (error) {
    throw error;
  }

  // Build request URL
  const url = endpoint.startsWith('http') ? endpoint : `${GRAPH_BASE_URL}${endpoint}`;

  // Build headers (token already trimmed)
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    ...customHeaders,
  };

  console.log(`[Graph] ${fetchOptions.method || 'GET'} ${endpoint}`);

  const doFetch = () =>
    fetch(url, {
      ...fetchOptions,
      headers,
    });

  let response: Response;
  try {
    response = await doFetch();
  } catch (error) {
    console.error('[Graph] Network error:', error);
    throw new NetworkError('Failed to connect to Microsoft Graph. Please check your network connection.');
  }

  // Handle 401 - try refresh and retry once
  if (response.status === 401 && !skipRetry) {
    console.log('[Graph] Got 401, attempting token refresh and retry...');
    try {
      const freshToken = (await getAccessToken(true)).trim();
      headers['Authorization'] = `Bearer ${freshToken}`;
      response = await doFetch();
      if (response.status === 401) {
        throw new UnauthorizedError('Token refresh failed. Please sign in again.');
      }
    } catch (error) {
      if (error instanceof GraphError) throw error;
      throw new UnauthorizedError('Failed to refresh token. Please sign in again.');
    }
  }

  // Parse response
  const contentType = response.headers.get('content-type');
  let data: any;

  if (contentType?.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  // Handle 400 AuthenticationError - token may be wrong resource; retry once with force refresh
  if (response.status === 400 && !skipRetry && data?.error?.code === 'AuthenticationError') {
    const authErrMsg = data?.error?.message || '';
    console.warn('[Graph] 400 AuthenticationError, retrying with force token refresh:', authErrMsg);
    try {
      const freshToken = (await getAccessToken(true)).trim();
      headers['Authorization'] = `Bearer ${freshToken}`;
      response = await fetch(url, { ...fetchOptions, headers });
      const retryContentType = response.headers.get('content-type');
      data = retryContentType?.includes('application/json') ? await response.json() : await response.text();
    } catch (retryErr) {
      // Fall through to error handling with original response
    }
  }

  // Handle error responses
  if (!response.ok) {
    const errorMessage = data?.error?.message || data?.message || `Request failed with status ${response.status}`;
    const errorCode = data?.error?.code;
    const requestId = response.headers.get('request-id') || undefined;

    console.error(`[Graph] Error ${response.status}:`, errorMessage);

    if (response.status === 400 && errorCode === 'AuthenticationError') {
      throw new UnauthorizedError(
        'Error authenticating with Microsoft Graph. Please disconnect and reconnect your Microsoft account (Connect with Microsoft), then try again.'
      );
    }

    switch (response.status) {
      case 401:
        throw new UnauthorizedError(errorMessage);
      case 403:
        throw new ForbiddenError(errorMessage);
      case 404:
        throw new NotFoundError(errorMessage);
      case 500:
      case 502:
      case 503:
      case 504:
        throw new ServiceError(errorMessage);
      default:
        throw new GraphError(errorMessage, response.status, errorCode, requestId);
    }
  }

  console.log('[Graph] Request successful');
  return data as T;
}

// ============================================================================
// Microsoft Teams Types
// ============================================================================

export interface MicrosoftTeam {
  id: string;
  displayName: string;
  description?: string;
  visibility?: 'private' | 'public';
  webUrl?: string;
  isArchived?: boolean;
}

export interface TeamsListResponse {
  '@odata.context': string;
  '@odata.count'?: number;
  value: MicrosoftTeam[];
}

// ============================================================================
// Convenience Methods
// ============================================================================

/**
 * Get the current user's profile (GET /me)
 */
export async function getMyProfile(): Promise<GraphUser> {
  return callGraphAPI<GraphUser>('/me');
}

/**
 * Get the teams the current user has joined (GET /me/joinedTeams)
 * Requires Team.ReadBasic.All scope
 */
export async function getMyJoinedTeams(): Promise<MicrosoftTeam[]> {
  try {
    const response = await callGraphAPI<TeamsListResponse>('/me/joinedTeams');
    return response.value || [];
  } catch (error) {
    if (error instanceof ForbiddenError) {
      throw new ForbiddenError(
        'Missing Team.ReadBasic.All permission. Please reconnect your Microsoft account.'
      );
    }
    throw error;
  }
}

/**
 * Test Graph API connection and return detailed result
 */
export async function testGraphConnection(): Promise<{
  success: boolean;
  user?: GraphUser;
  tokenMetadata?: TokenMetadata;
  error?: string;
  errorType?: string;
}> {
  try {
    const token = await getAccessToken();
    const tokenMetadata = getTokenMetadata(token) || undefined;
    const user = await getMyProfile();
    
    return {
      success: true,
      user,
      tokenMetadata,
    };
  } catch (error) {
    console.error('[Graph] Connection test failed:', error);
    
    if (error instanceof GraphError) {
      return {
        success: false,
        error: error.message,
        errorType: error.name,
      };
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      errorType: 'UnknownError',
    };
  }
}
