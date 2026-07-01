/**
 * Azure AD Authentication Helper Functions
 * Handles MSAL-based authentication flow via new window (works in iframes)
 */

import { 
  AuthenticationResult,
  InteractionRequiredAuthError,
} from '@azure/msal-browser';
import { getMSALInstance, loginRequest, getActiveAccount } from './msalConfig';
import { supabase } from '@/integrations/supabase/client';
import { logLogin } from './activity-logger';
import { openMicrosoftAuthWindow, clearAuthWindowState } from './msalAuthWindow';

// Key for storing pending redirect state
const MSAL_REDIRECT_KEY = 'msal_redirect_pending';
const MSAL_RESPONSE_KEY = 'msal_auth_response';
/** Graph token from "Connect with Microsoft" (Teams) flow only - never use app sign-in token for Graph */
export const MSAL_GRAPH_RESPONSE_KEY = 'msal_graph_response';

/**
 * Handle the redirect response after returning from Microsoft login
 * This should be called early in app initialization
 */
export async function handleMSALRedirect(): Promise<AuthenticationResult | null> {
  try {
    const msalInstance = await getMSALInstance();
    const response = await msalInstance.handleRedirectPromise();
    
    if (response) {
      console.log('MSAL redirect response received');
      // Store the response for later processing
      sessionStorage.setItem(MSAL_RESPONSE_KEY, JSON.stringify({
        accessToken: response.accessToken,
        account: response.account,
        idToken: response.idToken,
      }));
      // Clear the pending flag
      sessionStorage.removeItem(MSAL_REDIRECT_KEY);
      return response;
    }
    
    return null;
  } catch (error) {
    console.error('Error handling MSAL redirect:', error);
    sessionStorage.removeItem(MSAL_REDIRECT_KEY);
    return null;
  }
}

/**
 * Check if there's a stored MSAL response from a redirect
 */
export function getStoredMSALResponse(): { accessToken: string; account: any; idToken?: string } | null {
  const stored = sessionStorage.getItem(MSAL_RESPONSE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Clear the stored MSAL response
 */
export function clearStoredMSALResponse(): void {
  sessionStorage.removeItem(MSAL_RESPONSE_KEY);
}

/**
 * Get stored token from "Connect with Microsoft" (Graph) flow only.
 * Use this for Graph API calls so we never send app sign-in token to Graph.
 */
export function getStoredGraphResponse(): { accessToken: string; account: any; idToken?: string } | null {
  const stored = sessionStorage.getItem(MSAL_GRAPH_RESPONSE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Clear the stored Graph response (call when user disconnects Teams)
 */
export function clearStoredGraphResponse(): void {
  sessionStorage.removeItem(MSAL_GRAPH_RESPONSE_KEY);
}

/**
 * Check if a redirect is pending (user initiated login but hasn't returned yet)
 */
export function isRedirectPending(): boolean {
  return sessionStorage.getItem(MSAL_REDIRECT_KEY) === 'true';
}

/**
 * Acquire Azure token silently (if user already logged in)
 */
export async function acquireTokenSilently(): Promise<AuthenticationResult | null> {
  try {
    const msalInstance = await getMSALInstance();
    const account = await getActiveAccount();

    if (!account) {
      return null;
    }

    const response = await msalInstance.acquireTokenSilent({
      ...loginRequest,
      account,
    });

    return response;
  } catch (error) {
    // If silent token acquisition fails, return null to trigger interactive login
    if (error instanceof InteractionRequiredAuthError) {
      console.log('Silent token acquisition failed, user interaction required');
      return null;
    }
    console.error('Error acquiring token silently:', error);
    return null;
  }
}

/**
 * Initiate Azure login via new window (works in iframes)
 * Opens a new window for authentication.
 * Pass preOpenedWindow when the popup was opened synchronously on user click (e.g. from meetings/schedule) to avoid popup blockers.
 */
export async function initiateAzureLoginRedirect(preOpenedWindow?: Window | null): Promise<{
  accessToken: string;
  account: any;
  idToken?: string;
} | null> {
  const msalInstance = await getMSALInstance();

  // Check for existing accounts
  const accounts = msalInstance.getAllAccounts();
  
  if (accounts.length > 0) {
    // Try silent token acquisition first
    try {
      const silentResult = await msalInstance.acquireTokenSilent({
        ...loginRequest,
        account: accounts[0],
      });
      
      // If silent acquisition succeeds, store the result and return
      if (silentResult) {
        if (preOpenedWindow && !preOpenedWindow.closed) {
          preOpenedWindow.close();
        }
        const result = {
          accessToken: silentResult.accessToken,
          account: silentResult.account,
          idToken: silentResult.idToken,
        };
        sessionStorage.setItem(MSAL_RESPONSE_KEY, JSON.stringify(result));
        sessionStorage.setItem(MSAL_GRAPH_RESPONSE_KEY, JSON.stringify(result));
        return result;
      }
    } catch (error) {
      // If silent fails, fall back to new window
      if (error instanceof InteractionRequiredAuthError) {
        console.log('Silent token acquisition failed, using new window');
      }
    }
  }

  // Open new window for authentication (or use pre-opened window)
  try {
    const result = await openMicrosoftAuthWindow(preOpenedWindow);
    sessionStorage.setItem(MSAL_RESPONSE_KEY, JSON.stringify(result));
    sessionStorage.setItem(MSAL_GRAPH_RESPONSE_KEY, JSON.stringify(result));
    return result;
  } catch (error) {
    clearAuthWindowState();
    throw error;
  }
}

/**
 * Send Azure token to backend and get application JWT
 * This function acquires a fresh token before sending to ensure it's not expired
 */
export async function handleLoginResponse(azureToken?: string): Promise<{
  user: any;
  profile: any;
  magicLink?: string;
}> {
  // Always try to get a fresh token to avoid expiration issues
  let tokenToUse = azureToken;
  
  if (!tokenToUse) {
    // Try to acquire a fresh token silently
    const freshToken = await acquireTokenSilently();
    if (freshToken?.accessToken) {
      tokenToUse = freshToken.accessToken;
      // Update the stored response with fresh token
      sessionStorage.setItem('msal_auth_response', JSON.stringify({
        accessToken: freshToken.accessToken,
        account: freshToken.account,
        idToken: freshToken.idToken,
      }));
    }
  }
  
  if (!tokenToUse) {
    throw new Error('No valid Azure token available. Please sign in again.');
  }

  // Call backend login endpoint
  const { data, error } = await supabase.functions.invoke('azure-auth-login', {
    body: {
      azureToken: tokenToUse,
    },
  });

  if (error) {
    throw new Error(error.message || 'Failed to authenticate with backend');
  }

  if (!data.success) {
    throw new Error(data.message || 'Authentication failed');
  }

  // Store authentication data
  const isAzureADUser = data.user?.isAzureAD || false;
  
  // Store in localStorage
  localStorage.setItem('isAzureADUser', String(isAzureADUser));
  localStorage.setItem('userEmail', data.user?.email || '');
  localStorage.setItem('userName', data.user?.userName || '');

  // Log login activity
  logLogin('microsoft');

  return {
    user: data.user,
    profile: data.profile,
    magicLink: data.magicLink,
  };
}

/**
 * Complete Azure login flow after redirect
 * Call this when you have a stored MSAL response
 * NOTE: This does NOT clear the stored token - it's needed for Graph API calls
 */
export async function completeAzureLoginFromRedirect(): Promise<{
  user: any;
  profile: any;
  magicLink?: string;
} | null> {
  const storedResponse = getStoredMSALResponse();
  
  if (!storedResponse || !storedResponse.accessToken) {
    return null;
  }
  
  // Try to get a fresh token first to avoid expiration issues
  const freshToken = await acquireTokenSilently();
  const tokenToUse = freshToken?.accessToken || storedResponse.accessToken;
  
  // Update stored response with fresh token if available
  if (freshToken?.accessToken) {
    sessionStorage.setItem('msal_auth_response', JSON.stringify({
      accessToken: freshToken.accessToken,
      account: freshToken.account,
      idToken: freshToken.idToken,
    }));
  }
  
  // Send to backend with fresh token
  return handleLoginResponse(tokenToUse);
}

/**
 * Legacy function - now initiates redirect flow
 * @deprecated Use initiateAzureLoginRedirect instead
 */
export async function completeAzureLogin(): Promise<{
  user: any;
  profile: any;
  magicLink?: string;
}> {
  // Check if we have a stored response from redirect
  const storedResponse = getStoredMSALResponse();
  if (storedResponse && storedResponse.accessToken) {
    // DO NOT clear - needed for Graph API calls
    return handleLoginResponse(storedResponse.accessToken);
  }
  
  // Otherwise initiate redirect - this will throw since page navigates away
  await initiateAzureLoginRedirect();
  
  // This won't be reached due to redirect, but TypeScript needs it
  throw new Error('Redirect initiated - page will navigate to Microsoft login');
}

/**
 * Check if user is already logged in with Azure
 */
export async function checkAzureSession(): Promise<boolean> {
  try {
    const account = await getActiveAccount();
    if (!account) {
      return false;
    }

    // Try to acquire token silently
    const token = await acquireTokenSilently();
    return token !== null;
  } catch (error) {
    return false;
  }
}

