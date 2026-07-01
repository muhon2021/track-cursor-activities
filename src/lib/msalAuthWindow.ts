/**
 * Microsoft Authentication via New Window with PKCE
 * Opens a new window for MSAL authentication using Authorization Code + PKCE flow
 */

import { graphScopesForPKCE } from './msalConfig';

// Key for storing auth window state
const AUTH_WINDOW_KEY = 'msal_auth_window_pending';
const CODE_VERIFIER_KEY = 'msal_code_verifier';
const AUTH_RESULT_KEY = 'msal_auth_result';
const POLLING_INTERVAL = 300; // ms to check for auth result
const POLLING_TIMEOUT = 120000; // 2 minutes timeout

interface MSALAuthResult {
  accessToken: string;
  account: {
    username?: string;
    name?: string;
    localAccountId?: string;
  };
  idToken?: string;
}

interface MSALAuthMessage {
  type: 'MSAL_AUTH_SUCCESS' | 'MSAL_AUTH_ERROR' | 'MSAL_AUTH_CODE';
  accessToken?: string;
  account?: MSALAuthResult['account'];
  idToken?: string;
  code?: string;
  state?: string;
  error?: string;
}

/**
 * Generate a cryptographically random code verifier for PKCE
 */
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

/**
 * Generate code challenge from verifier using SHA-256
 */
async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

/**
 * Base64 URL encode (no padding, URL-safe characters)
 */
function base64UrlEncode(buffer: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Exchange authorization code for tokens
 */
async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<MSALAuthResult> {
  const clientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID || '';
  const tokenEndpoint = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
  
  const params = new URLSearchParams({
    client_id: clientId,
    scope: graphScopesForPKCE.join(' '),
    code: code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    code_verifier: codeVerifier,
  });

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error_description || errorData.error || 'Token exchange failed');
  }

  const tokenResponse = await response.json();
  
  // Parse the ID token to get account info
  let account: MSALAuthResult['account'] = {};
  if (tokenResponse.id_token) {
    try {
      const payload = tokenResponse.id_token.split('.')[1];
      const decoded = JSON.parse(atob(payload));
      account = {
        username: decoded.preferred_username || decoded.email,
        name: decoded.name,
        localAccountId: decoded.oid || decoded.sub,
      };
    } catch (e) {
      console.warn('Failed to parse ID token:', e);
    }
  }

  return {
    accessToken: tokenResponse.access_token,
    idToken: tokenResponse.id_token,
    account,
  };
}

/**
 * Check for pending auth result on page load (from callback redirect)
 * Call this on app initialization to complete cross-origin auth flows
 */
export function checkPendingAuthResult(): MSALAuthMessage | null {
  try {
    const resultStr = sessionStorage.getItem(AUTH_RESULT_KEY);
    if (resultStr) {
      sessionStorage.removeItem(AUTH_RESULT_KEY);
      const result = JSON.parse(resultStr);
      // Only use if recent (within 60 seconds)
      if (result.timestamp && Date.now() - result.timestamp < 60000) {
        return result;
      }
    }
  } catch (e) {
    console.warn('Error checking pending auth result:', e);
  }
  return null;
}

/**
 * Store auth result for pickup by the main app
 */
export function storeAuthResult(data: MSALAuthMessage): void {
  try {
    sessionStorage.setItem(AUTH_RESULT_KEY, JSON.stringify({
      ...data,
      timestamp: Date.now()
    }));
  } catch (e) {
    console.warn('Failed to store auth result:', e);
  }
}

/**
 * Open Microsoft login in a new window using PKCE flow
 * Returns a promise that resolves when authentication completes.
 * Pass preOpenedWindow when the popup was already opened synchronously (e.g. on user click) to avoid popup blockers.
 */
export async function openMicrosoftAuthWindow(preOpenedWindow?: Window | null): Promise<MSALAuthResult> {
  // Generate PKCE values
  const codeVerifier = generateCodeVerifier();
  sessionStorage.setItem(CODE_VERIFIER_KEY, codeVerifier);
  sessionStorage.removeItem(AUTH_RESULT_KEY);

  const codeChallenge = await generateCodeChallenge(codeVerifier);

  // Calculate window position (center of screen)
  const width = 500;
  const height = 700;
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;

  const clientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID || '';
  const redirectUri = window.location.origin + '/auth-callback';
  const scopes = graphScopesForPKCE.join(' ');
  const state = crypto.randomUUID();
  sessionStorage.setItem('msal_state', state);

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: scopes,
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    response_mode: 'query',
  });
  const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
  console.log('Opening Microsoft auth with redirect URI:', redirectUri);

  let authWindow: Window | null;
  if (preOpenedWindow && !preOpenedWindow.closed) {
    authWindow = preOpenedWindow;
    authWindow.location.href = authUrl;
  } else {
    authWindow = window.open(
      authUrl,
      'microsoft-auth',
      `width=${width},height=${height},left=${left},top=${top},popup=yes`
    );
  }

  if (!authWindow || authWindow.closed) {
    sessionStorage.removeItem(CODE_VERIFIER_KEY);
    throw new Error('Failed to open authentication window. Please allow popups for this site.');
  }

  sessionStorage.setItem(AUTH_WINDOW_KEY, 'true');

  return new Promise((resolve, reject) => {
    
    const startTime = Date.now();
    let resolved = false;
    
    // Process auth result (from either postMessage or localStorage polling)
    const processAuthResult = async (data: MSALAuthMessage) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      sessionStorage.removeItem(AUTH_WINDOW_KEY);
      
      if (data.type === 'MSAL_AUTH_CODE') {
        const storedVerifier = sessionStorage.getItem(CODE_VERIFIER_KEY);
        sessionStorage.removeItem(CODE_VERIFIER_KEY);
        
        if (!storedVerifier) {
          reject(new Error('Code verifier not found'));
          return;
        }
        
        try {
          const result = await exchangeCodeForTokens(
            data.code!,
            storedVerifier,
            redirectUri
          );
          resolve(result);
        } catch (error) {
          reject(error);
        }
      } else if (data.type === 'MSAL_AUTH_SUCCESS') {
        sessionStorage.removeItem(CODE_VERIFIER_KEY);
        resolve({
          accessToken: data.accessToken!,
          account: data.account || {},
          idToken: data.idToken,
        });
      } else if (data.type === 'MSAL_AUTH_ERROR') {
        sessionStorage.removeItem(CODE_VERIFIER_KEY);
        reject(new Error(data.error || 'Authentication failed'));
      }
    };
    
    // Handle message from auth window (same-origin postMessage)
    const handleMessage = async (event: MessageEvent<MSALAuthMessage>) => {
      if (event.origin !== window.location.origin) return;
      if (!event.data?.type?.startsWith('MSAL_AUTH')) return;
      
      console.log('Received postMessage:', event.data.type);
      await processAuthResult(event.data);
    };
    
    // Cleanup function
    let pollTimeoutId: number | undefined;
    
    const cleanup = () => {
      window.removeEventListener('message', handleMessage);
      if (pollTimeoutId) {
        clearTimeout(pollTimeoutId);
        pollTimeoutId = undefined;
      }
    };
    
    // Poll sessionStorage for auth result using recursive setTimeout (safer than setInterval with async)
    const pollForResult = async () => {
      // If already resolved, stop polling
      if (resolved) return;
      
      // Check timeout
      if (Date.now() - startTime > POLLING_TIMEOUT) {
        if (!resolved) {
          resolved = true;
          cleanup();
          sessionStorage.removeItem(AUTH_WINDOW_KEY);
          sessionStorage.removeItem(CODE_VERIFIER_KEY);
          reject(new Error('Authentication timed out'));
        }
        return;
      }
      
      // Check for stored result (set by callback page)
      const storedResult = sessionStorage.getItem(AUTH_RESULT_KEY);
      if (storedResult && !resolved) {
        sessionStorage.removeItem(AUTH_RESULT_KEY);
        try {
          const data = JSON.parse(storedResult) as MSALAuthMessage & { timestamp?: number };
          // Only process if recent (within 60 seconds)
          if (data.timestamp && Date.now() - data.timestamp < 60000) {
            console.log('Found stored auth result:', data.type);
            await processAuthResult(data);
            return; // Stop polling after processing
          }
        } catch (e) {
          console.warn('Failed to parse stored auth result:', e);
        }
      }
      
      // Check if window was closed without result
      if (authWindow.closed && !resolved) {
        // Give a grace period for the result to be stored
        await new Promise(r => setTimeout(r, 2000));
        
        // Check one more time for stored result
        if (resolved) return; // May have been resolved during grace period
        
        const finalResult = sessionStorage.getItem(AUTH_RESULT_KEY);
        if (finalResult) {
          sessionStorage.removeItem(AUTH_RESULT_KEY);
          try {
            const data = JSON.parse(finalResult) as MSALAuthMessage;
            console.log('Found stored auth result after window close:', data.type);
            await processAuthResult(data);
            return;
          } catch (e) {
            // Fall through to error
          }
        }
        
        if (!resolved) {
          resolved = true;
          cleanup();
          sessionStorage.removeItem(AUTH_WINDOW_KEY);
          sessionStorage.removeItem(CODE_VERIFIER_KEY);
          reject(new Error('Authentication window was closed'));
        }
        return;
      }
      
      // Schedule next poll
      if (!resolved) {
        pollTimeoutId = window.setTimeout(pollForResult, POLLING_INTERVAL);
      }
    };
    
    // Start polling
    pollTimeoutId = window.setTimeout(pollForResult, POLLING_INTERVAL);
    
    window.addEventListener('message', handleMessage);
  });
}

/**
 * Check if an auth window is currently pending
 */
export function isAuthWindowPending(): boolean {
  return sessionStorage.getItem(AUTH_WINDOW_KEY) === 'true';
}

/**
 * Clear pending auth window state
 */
export function clearAuthWindowState(): void {
  sessionStorage.removeItem(AUTH_WINDOW_KEY);
  sessionStorage.removeItem('msal_state');
  sessionStorage.removeItem(CODE_VERIFIER_KEY);
}

/**
 * Get stored code verifier for token exchange
 */
export function getStoredCodeVerifier(): string | null {
  return sessionStorage.getItem(CODE_VERIFIER_KEY);
}

/**
 * Clear stored code verifier
 */
export function clearStoredCodeVerifier(): void {
  sessionStorage.removeItem(CODE_VERIFIER_KEY);
}
