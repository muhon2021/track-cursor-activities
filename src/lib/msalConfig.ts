/**
 * Microsoft Authentication Library (MSAL) Configuration
 * Handles Azure AD SSO authentication setup
 */

import { PublicClientApplication, Configuration, LogLevel, AccountInfo } from '@azure/msal-browser';

// MSAL Configuration
export const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_MICROSOFT_CLIENT_ID || '',
    // Use 'common' for multi-tenant + personal Microsoft accounts
    authority: 'https://login.microsoftonline.com/common',
    redirectUri: import.meta.env.VITE_MICROSOFT_REDIRECT_URI || window.location.origin,
    postLogoutRedirectUri: import.meta.env.VITE_MICROSOFT_LOGOUT_URI || window.location.origin,
  },
  cache: {
    cacheLocation: 'sessionStorage', // This configures where your cache will be stored
    storeAuthStateInCookie: false, // Set this to "true" if you are having issues on IE11 or Edge
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) {
          return;
        }
        switch (level) {
          case LogLevel.Error:
            console.error(message);
            return;
          case LogLevel.Info:
            console.info(message);
            return;
          case LogLevel.Verbose:
            console.debug(message);
            return;
          case LogLevel.Warning:
            console.warn(message);
            return;
        }
      },
    },
  },
};

// Add scopes here for ID token to be used at Microsoft identity platform endpoints.
export const loginRequest = {
  scopes: [
    'User.Read',
    'Team.ReadBasic.All',
    'Channel.ReadBasic.All',
    'ChannelMessage.Read.All', // For reading channel messages
    'ChannelMessage.Send',
    'OnlineMeetings.ReadWrite',
    'Calendars.Read', // For reading calendar events with Teams meetings
    'Calendars.ReadWrite', // For creating calendar events with Teams meetings
    'openid',
    'profile',
    'email',
  ],
};

/** Graph resource URL - token with this audience is accepted by Microsoft Graph */
const GRAPH_RESOURCE = 'https://graph.microsoft.com';

/**
 * Scopes for PKCE/authorization_code flow using full Graph URLs so the issued token has aud = graph.microsoft.com.
 * Use this in msalAuthWindow (authorize + token exchange) to avoid "Error authenticating with resource".
 */
export const graphScopesForPKCE = [
  'openid',
  'profile',
  'email',
  `${GRAPH_RESOURCE}/User.Read`,
  `${GRAPH_RESOURCE}/Team.ReadBasic.All`,
  `${GRAPH_RESOURCE}/Channel.ReadBasic.All`,
  `${GRAPH_RESOURCE}/ChannelMessage.Read.All`,
  `${GRAPH_RESOURCE}/ChannelMessage.Send`,
  `${GRAPH_RESOURCE}/OnlineMeetings.ReadWrite`,
  `${GRAPH_RESOURCE}/Calendars.Read`,
  `${GRAPH_RESOURCE}/Calendars.ReadWrite`,
];

// Create MSAL instance
let msalInstance: PublicClientApplication | null = null;
let initializationPromise: Promise<void> | null = null;

/**
 * Initialize MSAL instance (async)
 */
export async function initializeMSAL(): Promise<PublicClientApplication> {
  if (!msalInstance) {
    msalInstance = new PublicClientApplication(msalConfig);
    initializationPromise = msalInstance.initialize();
  }
  
  // Always await initialization before returning
  if (initializationPromise) {
    await initializationPromise;
  }
  
  return msalInstance;
}

/**
 * Get MSAL instance (initializes if needed) - async
 */
export async function getMSALInstance(): Promise<PublicClientApplication> {
  if (!msalInstance) {
    return initializeMSAL();
  }
  
  // Ensure initialization is complete
  if (initializationPromise) {
    await initializationPromise;
  }
  
  return msalInstance;
}

/**
 * Get active account from MSAL cache
 */
export async function getActiveAccount(): Promise<AccountInfo | null> {
  const instance = await getMSALInstance();
  const accounts = instance.getAllAccounts();
  return accounts.length > 0 ? accounts[0] : null;
}

/**
 * Validate MSAL configuration
 */
export function validateMSALConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!import.meta.env.VITE_MICROSOFT_CLIENT_ID) {
    errors.push('VITE_MICROSOFT_CLIENT_ID is not set');
  }

  if (!import.meta.env.VITE_MICROSOFT_DIRECTORY_ID) {
    errors.push('VITE_MICROSOFT_DIRECTORY_ID is not set');
  }

  if (!import.meta.env.VITE_MICROSOFT_REDIRECT_URI) {
    errors.push('VITE_MICROSOFT_REDIRECT_URI is not set');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

