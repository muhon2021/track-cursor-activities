/**
 * Microsoft Graph Webhook Service
 * 
 * Manages Graph API change notification subscriptions for:
 * - Online meetings (/me/onlineMeetings)
 * - Calendar events (/me/events)
 * - And other supported resources
 */

import { supabase } from '@/integrations/supabase/client';
import { acquireTokenSilently } from './azureAuth';

export interface GraphWebhookSubscription {
  id: string;
  subscription_id: string;
  resource: string;
  change_types: string[];
  expiration_datetime: string;
  is_active: boolean;
  created_at: string;
  last_notification_at: string | null;
  error_count: number;
}

export interface CreateSubscriptionParams {
  resource: string;
  changeTypes?: ('created' | 'updated' | 'deleted')[];
}

export interface SubscriptionResult {
  success: boolean;
  subscription?: {
    id: string;
    subscriptionId: string;
    resource: string;
    expirationDateTime: string;
  };
  error?: string;
  details?: string;
}

/**
 * Common Graph API resources for webhooks
 */
export const GRAPH_WEBHOOK_RESOURCES = {
  ONLINE_MEETINGS: '/me/onlineMeetings',
  CALENDAR_EVENTS: '/me/events',
  MESSAGES: '/me/messages',
  CONTACTS: '/me/contacts',
} as const;

/**
 * Get Microsoft access token for Graph API calls
 */
async function getMicrosoftAccessToken(): Promise<string> {
  const authResult = await acquireTokenSilently();
  if (!authResult?.accessToken) {
    throw new Error('Failed to acquire Microsoft access token. Please sign in again.');
  }
  return authResult.accessToken;
}

/**
 * Create a new Graph webhook subscription
 */
export async function createGraphSubscription(
  params: CreateSubscriptionParams
): Promise<SubscriptionResult> {
  try {
    const accessToken = await getMicrosoftAccessToken();

    const { data, error } = await supabase.functions.invoke('microsoft-graph-subscribe', {
      body: {
        action: 'create',
        resource: params.resource,
        changeTypes: params.changeTypes || ['created', 'updated', 'deleted'],
        accessToken,
      },
    });

    if (error) {
      console.error('[GraphWebhooks] Create subscription error:', error);
      return {
        success: false,
        error: 'Failed to create subscription',
        details: error.message,
      };
    }

    if (data?.error) {
      return {
        success: false,
        error: data.error,
        details: data.details,
      };
    }

    return {
      success: true,
      subscription: data.subscription,
    };
  } catch (error) {
    console.error('[GraphWebhooks] Create subscription exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Renew an existing Graph webhook subscription
 */
export async function renewGraphSubscription(
  subscriptionId: string
): Promise<{ success: boolean; expirationDateTime?: string; error?: string }> {
  try {
    const accessToken = await getMicrosoftAccessToken();

    const { data, error } = await supabase.functions.invoke('microsoft-graph-subscribe', {
      body: {
        action: 'renew',
        subscriptionId,
        accessToken,
      },
    });

    if (error) {
      console.error('[GraphWebhooks] Renew subscription error:', error);
      return { success: false, error: error.message };
    }

    if (data?.error) {
      return { success: false, error: data.error };
    }

    return {
      success: true,
      expirationDateTime: data.expirationDateTime,
    };
  } catch (error) {
    console.error('[GraphWebhooks] Renew subscription exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Delete a Graph webhook subscription
 */
export async function deleteGraphSubscription(
  subscriptionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const accessToken = await getMicrosoftAccessToken();

    const { data, error } = await supabase.functions.invoke('microsoft-graph-subscribe', {
      body: {
        action: 'delete',
        subscriptionId,
        accessToken,
      },
    });

    if (error) {
      console.error('[GraphWebhooks] Delete subscription error:', error);
      return { success: false, error: error.message };
    }

    if (data?.error) {
      return { success: false, error: data.error };
    }

    return { success: true };
  } catch (error) {
    console.error('[GraphWebhooks] Delete subscription exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * List all Graph webhook subscriptions for the current user
 */
export async function listGraphSubscriptions(): Promise<{
  success: boolean;
  subscriptions?: GraphWebhookSubscription[];
  error?: string;
}> {
  try {
    const accessToken = await getMicrosoftAccessToken();

    const { data, error } = await supabase.functions.invoke('microsoft-graph-subscribe', {
      body: {
        action: 'list',
        accessToken,
      },
    });

    if (error) {
      console.error('[GraphWebhooks] List subscriptions error:', error);
      return { success: false, error: error.message };
    }

    if (data?.error) {
      return { success: false, error: data.error };
    }

    return {
      success: true,
      subscriptions: data.subscriptions,
    };
  } catch (error) {
    console.error('[GraphWebhooks] List subscriptions exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check if a subscription is expiring soon (within 24 hours)
 */
export function isSubscriptionExpiringSoon(expirationDateTime: string): boolean {
  const expiration = new Date(expirationDateTime);
  const now = new Date();
  const hoursUntilExpiration = (expiration.getTime() - now.getTime()) / (1000 * 60 * 60);
  return hoursUntilExpiration <= 24;
}

/**
 * Get human-readable resource name
 */
export function getResourceDisplayName(resource: string): string {
  switch (resource) {
    case GRAPH_WEBHOOK_RESOURCES.ONLINE_MEETINGS:
      return 'Online Meetings';
    case GRAPH_WEBHOOK_RESOURCES.CALENDAR_EVENTS:
      return 'Calendar Events';
    case GRAPH_WEBHOOK_RESOURCES.MESSAGES:
      return 'Messages';
    case GRAPH_WEBHOOK_RESOURCES.CONTACTS:
      return 'Contacts';
    default:
      return resource;
  }
}
