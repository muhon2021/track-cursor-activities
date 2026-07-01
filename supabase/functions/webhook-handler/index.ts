import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-zm-signature, x-zm-request-timestamp',
}

interface WebhookEvent {
  event: string;
  payload: Record<string, any>;
  event_ts?: number;
}

// Microsoft Graph notification types
interface GraphNotificationItem {
  subscriptionId: string;
  subscriptionExpirationDateTime: string;
  changeType: 'created' | 'updated' | 'deleted';
  resource: string;
  resourceData: {
    '@odata.type': string;
    '@odata.id': string;
    id: string;
    [key: string]: unknown;
  };
  clientState: string;
  tenantId: string;
}

interface GraphNotification {
  value: GraphNotificationItem[];
}

/**
 * Verify Zoom webhook signature using HMAC-SHA256
 * Reference: https://developers.zoom.us/docs/api/rest/webhook-reference/#verify-webhook-events
 */
async function verifyZoomWebhook(
  payload: string,
  signature: string | null,
  timestamp: string | null,
  secretToken: string
): Promise<boolean> {
  if (!signature || !timestamp || !secretToken) return false

  try {
    // Construct the message: v0:{timestamp}:{payload}
    const message = `v0:${timestamp}:${payload}`

    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secretToken),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )

    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(message))
    const hashArray = Array.from(new Uint8Array(signatureBuffer))
    const expectedSignature = 'v0=' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

    // Constant-time comparison to prevent timing attacks
    if (signature.length !== expectedSignature.length) return false

    let result = 0
    for (let i = 0; i < signature.length; i++) {
      result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i)
    }

    return result === 0
  } catch (error) {
    console.error('Zoom signature verification error:', error)
    return false
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const url = new URL(req.url)
    const provider = url.searchParams.get('provider') || 'unknown'

    // CRITICAL: Handle Microsoft Graph validation BEFORE reading body
    // Validation requests have no body and must respond within 10 seconds
    if (provider === 'microsoft') {
      const validationToken = url.searchParams.get('validationToken')
      if (validationToken) {
        console.log('[Webhook] Microsoft Graph validation request received')
        // Return plain text, URL-decoded validation token
        return new Response(decodeURIComponent(validationToken), {
          status: 200,
          headers: {
            'Content-Type': 'text/plain',
            ...corsHeaders,
          },
        })
      }
    }

    const body = await req.text()
    
    // Handle Microsoft Graph notifications (different format)
    if (provider === 'microsoft') {
      let graphNotification: GraphNotification
      try {
        graphNotification = JSON.parse(body)
      } catch {
        return new Response(
          JSON.stringify({ error: 'Invalid JSON payload' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }
      return await handleMicrosoftGraphWebhook(graphNotification, supabaseClient)
    }

    let event: WebhookEvent
    try {
      event = JSON.parse(body)
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON payload' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // SECURITY: Verify signature BEFORE any logging or processing
    if (provider === 'zoom') {
      const ZOOM_WEBHOOK_SECRET = Deno.env.get('ZOOM_WEBHOOK_SECRET')

      // Allow URL validation without signature (Zoom's initial validation request)
      if (event.event !== 'endpoint.url_validation') {
        const signature = req.headers.get('x-zm-signature')
        const timestamp = req.headers.get('x-zm-request-timestamp')

        const isValid = await verifyZoomWebhook(body, signature, timestamp, ZOOM_WEBHOOK_SECRET || '')

        if (!isValid) {
          console.warn('Invalid Zoom webhook signature rejected')
          return new Response(
            JSON.stringify({ error: 'Invalid signature' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
          )
        }
      }
    }

    // Log webhook event AFTER signature verification
    await supabaseClient
      .from('webhook_logs')
      .insert({
        provider,
        event_type: event.event || 'unknown',
        payload: event.payload || event,
        received_at: new Date().toISOString(),
      })
      .select()

    // Handle different providers
    switch (provider) {
      case 'zoom':
        return await handleZoomWebhook(event, req, supabaseClient)
      case 'google':
        return await handleGoogleWebhook(event, supabaseClient)
      default:
        console.log(`Received webhook from unknown provider: ${provider}`, event)
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Webhook received' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    console.error('Webhook handler error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

async function handleZoomWebhook(
  event: WebhookEvent,
  req: Request,
  supabase: any
): Promise<Response> {
  const ZOOM_WEBHOOK_SECRET = Deno.env.get('ZOOM_WEBHOOK_SECRET')

  // Handle Zoom URL validation challenge
  if (event.event === 'endpoint.url_validation') {
    const plainToken = event.payload?.plainToken
    if (plainToken && ZOOM_WEBHOOK_SECRET) {
      const encoder = new TextEncoder()
      const data = encoder.encode(plainToken)
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(ZOOM_WEBHOOK_SECRET),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      )
      const signature = await crypto.subtle.sign('HMAC', key, data)
      const hashArray = Array.from(new Uint8Array(signature))
      const encryptedToken = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

      return new Response(
        JSON.stringify({
          plainToken,
          encryptedToken,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }
  }

  // Handle recording completed event
  if (event.event === 'recording.completed') {
    const payload = event.payload?.object
    if (payload) {
      console.log('Recording completed:', payload.uuid)

      // Queue processing with error handling
      try {
        const { error } = await supabase.functions.invoke('sync-zoom-files', {
          body: { action: 'sync_single', meeting_uuid: payload.uuid }
        })
        if (error) {
          console.error('Failed to invoke sync-zoom-files:', error)
          // Log failure for retry/monitoring
          await supabase.from('webhook_logs').insert({
            provider: 'zoom',
            event_type: 'sync_zoom_files_error',
            payload: { meeting_uuid: payload.uuid, error: error.message },
            received_at: new Date().toISOString(),
          })
        }
      } catch (invokeError) {
        console.error('Exception invoking sync-zoom-files:', invokeError)
      }
    }
  }

  // Handle meeting ended event
  if (event.event === 'meeting.ended') {
    const payload = event.payload?.object
    if (payload) {
      console.log('Meeting ended:', payload.uuid)

      // Update meeting status with error handling
      const { error } = await supabase
        .from('meetings')
        .update({ status: 'completed' })
        .eq('zoom_id', payload.uuid)

      if (error) {
        console.error('Failed to update meeting status:', error)
      }
    }
  }

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
  )
}

async function handleGoogleWebhook(
  event: WebhookEvent,
  supabase: SupabaseClient
): Promise<Response> {
  // Handle Google Drive push notifications
  if (event.event === 'sync') {
    console.log('Google Drive sync notification received')

    // Trigger drive sync with error handling
    try {
      const { error } = await supabase.functions.invoke('google-drive-sync', {
        body: { action: 'sync' }
      })
      if (error) {
        console.error('Failed to invoke google-drive-sync:', error)
        // Log failure for retry/monitoring
        await supabase.from('webhook_logs').insert({
          provider: 'google',
          event_type: 'google_drive_sync_error',
          payload: { error: error.message },
          received_at: new Date().toISOString(),
        })
      }
    } catch (invokeError) {
      console.error('Exception invoking google-drive-sync:', invokeError)
    }
  }

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
  )
}

/**
 * Decrypt clientState for verification
 */
function decryptClientState(encrypted: string, key: string): string {
  try {
    const decoded = atob(encrypted)
    const keyData = new TextEncoder().encode(key)
    const decrypted = new Uint8Array(decoded.length)
    
    for (let i = 0; i < decoded.length; i++) {
      decrypted[i] = decoded.charCodeAt(i) ^ keyData[i % keyData.length]
    }
    
    return new TextDecoder().decode(decrypted)
  } catch (error) {
    console.error('Failed to decrypt clientState:', error)
    return ''
  }
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

/**
 * Verify Microsoft Graph notification clientState
 */
async function verifyGraphClientState(
  providedClientState: string,
  subscriptionId: string,
  supabase: SupabaseClient
): Promise<{ valid: boolean; error?: string }> {
  try {
    // Fetch stored clientState
    const { data: subscription, error } = await supabase
      .from('graph_webhook_subscriptions')
      .select('client_state')
      .eq('subscription_id', subscriptionId)
      .single()

    if (error || !subscription) {
      return { valid: false, error: 'Subscription not found' }
    }

    // Decrypt and compare
    const encryptionKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? 'default-key'
    const storedClientState = decryptClientState(subscription.client_state, encryptionKey)

    if (!constantTimeCompare(providedClientState, storedClientState)) {
      return { valid: false, error: 'clientState mismatch' }
    }

    return { valid: true }
  } catch (error) {
    console.error('[Microsoft] Verification error:', error)
    return { valid: false, error: 'Verification failed' }
  }
}

/**
 * Process meeting-related notifications
 */
async function processMeetingNotification(
  notification: GraphNotificationItem,
  supabase: SupabaseClient
): Promise<void> {
  const meetingId = notification.resourceData.id
  const changeType = notification.changeType

  console.log(`[Microsoft] Processing ${changeType} for meeting:`, meetingId)

  switch (changeType) {
    case 'created':
      // Log new meeting creation - would need to fetch full details via Graph API
      console.log('[Microsoft] New meeting created:', meetingId)
      break

    case 'updated':
      // Log meeting update
      console.log('[Microsoft] Meeting updated:', meetingId)
      break

    case 'deleted':
      // Update meeting status if we have it
      const { error } = await supabase
        .from('meetings')
        .update({ status: 'cancelled' })
        .filter('metadata->>teams_meeting_id', 'eq', meetingId)
      
      if (error) {
        console.error('[Microsoft] Failed to update meeting status:', error)
      }
      break
  }
}

/**
 * Handle Microsoft Graph webhook notifications
 */
async function handleMicrosoftGraphWebhook(
  notification: GraphNotification,
  supabase: SupabaseClient
): Promise<Response> {
  const results: Array<{ subscriptionId: string; success: boolean; error?: string }> = []
  const encryptionKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? 'default-key'

  // Process each notification in the batch
  for (const item of notification.value) {
    const receivedAt = new Date().toISOString()
    
    try {
      // 1. Verify clientState
      const verification = await verifyGraphClientState(
        item.clientState,
        item.subscriptionId,
        supabase
      )

      // 2. Log the notification
      await supabase.from('graph_webhook_logs').insert({
        subscription_id: item.subscriptionId,
        event_type: item.changeType,
        resource_data: item.resourceData,
        client_state_valid: verification.valid,
        processing_status: verification.valid ? 'processing' : 'failed',
        error_message: verification.error,
        received_at: receivedAt,
      })

      if (!verification.valid) {
        console.warn('[Microsoft] Invalid clientState for subscription:', item.subscriptionId)
        
        // Increment error count
        await supabase
          .from('graph_webhook_subscriptions')
          .update({ error_count: supabase.rpc('increment_error_count', { sub_id: item.subscriptionId }) })
          .eq('subscription_id', item.subscriptionId)
        
        results.push({
          subscriptionId: item.subscriptionId,
          success: false,
          error: verification.error,
        })
        continue
      }

      // 3. Update subscription last notification time
      await supabase
        .from('graph_webhook_subscriptions')
        .update({ 
          last_notification_at: receivedAt,
          error_count: 0, // Reset on successful verification
        })
        .eq('subscription_id', item.subscriptionId)

      // 4. Process based on resource type
      if (item.resource.includes('onlineMeetings')) {
        await processMeetingNotification(item, supabase)
      }

      // 5. Update log status to completed
      await supabase
        .from('graph_webhook_logs')
        .update({
          processing_status: 'completed',
          processed_at: new Date().toISOString(),
        })
        .eq('subscription_id', item.subscriptionId)
        .eq('received_at', receivedAt)

      results.push({ subscriptionId: item.subscriptionId, success: true })
    } catch (error) {
      console.error('[Microsoft] Error processing notification:', error)
      
      // Update log with error
      await supabase
        .from('graph_webhook_logs')
        .update({
          processing_status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('subscription_id', item.subscriptionId)
        .eq('received_at', receivedAt)

      results.push({
        subscriptionId: item.subscriptionId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  // Return 202 Accepted - we've received the notification
  return new Response(
    JSON.stringify({ processed: results }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 202 }
  )
}
