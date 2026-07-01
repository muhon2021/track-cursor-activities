import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

interface CreateSubscriptionRequest {
  action: 'create' | 'renew' | 'delete' | 'list';
  resource?: string;
  changeTypes?: string[];
  subscriptionId?: string;
  accessToken: string;
}

interface GraphSubscriptionResponse {
  id: string;
  resource: string;
  changeType: string;
  clientState: string;
  notificationUrl: string;
  expirationDateTime: string;
}

/**
 * Generate a cryptographically secure clientState
 */
function generateClientState(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Encrypt clientState for storage (simple XOR with base64 - use SecureEncryption in production)
 */
function encryptClientState(clientState: string, key: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(clientState);
  const keyData = encoder.encode(key);
  const encrypted = new Uint8Array(data.length);
  
  for (let i = 0; i < data.length; i++) {
    encrypted[i] = data[i] ^ keyData[i % keyData.length];
  }
  
  return btoa(String.fromCharCode(...encrypted));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Get the user from the Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Parse and validate request body
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const { action, resource, changeTypes, subscriptionId, accessToken }: CreateSubscriptionRequest = requestBody;

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: 'Microsoft access token required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const notificationUrl = `${supabaseUrl}/functions/v1/webhook-handler?provider=microsoft`;
    const encryptionKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? 'default-key';

    switch (action) {
      case 'create': {
        if (!resource) {
          return new Response(
            JSON.stringify({ error: 'Resource is required for subscription creation' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        // Check for existing active subscription for this resource
        const { data: existing } = await supabaseClient
          .from('graph_webhook_subscriptions')
          .select('id, subscription_id')
          .eq('user_id', user.id)
          .eq('resource', resource)
          .eq('is_active', true)
          .single();

        if (existing) {
          return new Response(
            JSON.stringify({ 
              error: 'Active subscription already exists for this resource',
              existingSubscriptionId: existing.subscription_id 
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 }
          );
        }

        // Generate secure clientState
        const clientState = generateClientState();
        
        // Calculate expiration (max 3 days for most resources, 4230 minutes for online meetings)
        const expirationDateTime = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

        // Create subscription via Graph API
        const graphResponse = await fetch('https://graph.microsoft.com/v1.0/subscriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            changeType: (changeTypes || ['created', 'updated', 'deleted']).join(','),
            notificationUrl,
            resource,
            expirationDateTime,
            clientState,
          }),
        });

        if (!graphResponse.ok) {
          const errorData = await graphResponse.json().catch(() => ({}));
          console.error('[GraphSubscribe] Failed to create subscription:', errorData);
          
          return new Response(
            JSON.stringify({ 
              error: 'Failed to create Graph subscription',
              details: errorData.error?.message || 'Unknown error',
              code: errorData.error?.code,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: graphResponse.status }
          );
        }

        const subscription: GraphSubscriptionResponse = await graphResponse.json();

        // Store subscription with encrypted clientState
        const encryptedClientState = encryptClientState(clientState, encryptionKey);
        
        const { data: dbSubscription, error: dbError } = await supabaseClient
          .from('graph_webhook_subscriptions')
          .insert({
            subscription_id: subscription.id,
            resource,
            change_types: changeTypes || ['created', 'updated', 'deleted'],
            notification_url: notificationUrl,
            client_state: encryptedClientState,
            expiration_datetime: subscription.expirationDateTime,
            user_id: user.id,
            is_active: true,
          })
          .select()
          .single();

        if (dbError) {
          console.error('[GraphSubscribe] Failed to store subscription:', dbError);
          // Try to delete the Graph subscription since we couldn't store it
          await fetch(`https://graph.microsoft.com/v1.0/subscriptions/${subscription.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${accessToken}` },
          });
          
          return new Response(
            JSON.stringify({ error: 'Failed to store subscription' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          );
        }

        console.log('[GraphSubscribe] Created subscription:', subscription.id);

        return new Response(
          JSON.stringify({
            success: true,
            subscription: {
              id: dbSubscription.id,
              subscriptionId: subscription.id,
              resource,
              expirationDateTime: subscription.expirationDateTime,
            },
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 }
        );
      }

      case 'renew': {
        if (!subscriptionId) {
          return new Response(
            JSON.stringify({ error: 'Subscription ID is required for renewal' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        // Get the subscription from database
        const { data: dbSub, error: fetchError } = await supabaseClient
          .from('graph_webhook_subscriptions')
          .select('*')
          .eq('subscription_id', subscriptionId)
          .eq('user_id', user.id)
          .single();

        if (fetchError || !dbSub) {
          return new Response(
            JSON.stringify({ error: 'Subscription not found' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
          );
        }

        // New expiration (3 days from now)
        const newExpiration = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

        // Renew via Graph API
        const graphResponse = await fetch(`https://graph.microsoft.com/v1.0/subscriptions/${subscriptionId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ expirationDateTime: newExpiration }),
        });

        if (!graphResponse.ok) {
          const errorData = await graphResponse.json().catch(() => ({}));
          console.error('[GraphSubscribe] Failed to renew subscription:', errorData);
          
          // Mark as inactive if subscription no longer exists
          if (graphResponse.status === 404) {
            await supabaseClient
              .from('graph_webhook_subscriptions')
              .update({ is_active: false })
              .eq('id', dbSub.id);
          }
          
          return new Response(
            JSON.stringify({ 
              error: 'Failed to renew subscription',
              details: errorData.error?.message || 'Unknown error',
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: graphResponse.status }
          );
        }

        // Update database
        await supabaseClient
          .from('graph_webhook_subscriptions')
          .update({ 
            expiration_datetime: newExpiration,
            error_count: 0,
          })
          .eq('id', dbSub.id);

        console.log('[GraphSubscribe] Renewed subscription:', subscriptionId);

        return new Response(
          JSON.stringify({
            success: true,
            expirationDateTime: newExpiration,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'delete': {
        if (!subscriptionId) {
          return new Response(
            JSON.stringify({ error: 'Subscription ID is required for deletion' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        // Get the subscription from database
        const { data: dbSub, error: fetchError } = await supabaseClient
          .from('graph_webhook_subscriptions')
          .select('*')
          .eq('subscription_id', subscriptionId)
          .eq('user_id', user.id)
          .single();

        if (fetchError || !dbSub) {
          return new Response(
            JSON.stringify({ error: 'Subscription not found' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
          );
        }

        // Delete from Graph API
        const graphResponse = await fetch(`https://graph.microsoft.com/v1.0/subscriptions/${subscriptionId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });

        // Even if Graph deletion fails (404), delete from our database
        if (!graphResponse.ok && graphResponse.status !== 404) {
          console.warn('[GraphSubscribe] Graph deletion returned:', graphResponse.status);
        }

        // Delete from database
        await supabaseClient
          .from('graph_webhook_subscriptions')
          .delete()
          .eq('id', dbSub.id);

        console.log('[GraphSubscribe] Deleted subscription:', subscriptionId);

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      case 'list': {
        const { data: subscriptions, error: listError } = await supabaseClient
          .from('graph_webhook_subscriptions')
          .select('id, subscription_id, resource, change_types, expiration_datetime, is_active, created_at, last_notification_at, error_count')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (listError) {
          return new Response(
            JSON.stringify({ error: 'Failed to list subscriptions' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          );
        }

        return new Response(
          JSON.stringify({ subscriptions }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action. Use: create, renew, delete, or list' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
    }
  } catch (error: unknown) {
    console.error('[GraphSubscribe] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
