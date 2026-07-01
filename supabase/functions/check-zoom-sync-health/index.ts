/**
 * Check Zoom Sync Health Edge Function
 *
 * Health check endpoint for monitoring Zoom sync status. Verifies
 * integration connectivity, token validity, and provides sync statistics.
 *
 * Input:  none
 * Output: { healthy: boolean, zoom_connected: boolean, token_valid: boolean, last_sync: timestamp, stats: { total, processed, pending, failed } }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Check if Zoom integration exists in organization_integrations
    const { data: zoomIntegration, error: integrationError } = await supabaseClient
      .from('organization_integrations')
      .select('id, config, status')
      .eq('provider_slug', 'zoom')
      .maybeSingle()

    const zoomConnected = !integrationError && !!zoomIntegration && zoomIntegration.status === 'active'

    // Check if OAuth token is valid/expired
    let tokenValid = false
    if (zoomConnected && zoomIntegration?.config) {
      const config = zoomIntegration.config
      const expiresAt = config.expires_at
      if (expiresAt) {
        tokenValid = new Date(expiresAt) > new Date()
      } else if (config.access_token) {
        // Token exists but no expiry info — assume valid
        tokenValid = true
      }
    }

    // Check last sync timestamp from meeting_files (max created_at where provider='zoom')
    const { data: lastSyncData } = await supabaseClient
      .from('meeting_files')
      .select('created_at')
      .eq('provider', 'zoom')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const lastSync = lastSyncData?.created_at || null

    // Count zoom files by status
    const { count: totalCount } = await supabaseClient
      .from('meeting_files')
      .select('id', { count: 'exact', head: true })
      .eq('provider', 'zoom')

    const { count: processedCount } = await supabaseClient
      .from('meeting_files')
      .select('id', { count: 'exact', head: true })
      .eq('provider', 'zoom')
      .not('meeting_id', 'is', null)

    const { count: failedCount } = await supabaseClient
      .from('meeting_files')
      .select('id', { count: 'exact', head: true })
      .eq('provider', 'zoom')
      .eq('status', 'failed')

    const total = totalCount || 0
    const processed = processedCount || 0
    const failed = failedCount || 0
    const pending = total - processed - failed

    // Determine overall health
    const healthy = zoomConnected && tokenValid

    return new Response(
      JSON.stringify({
        healthy,
        zoom_connected: zoomConnected,
        token_valid: tokenValid,
        last_sync: lastSync,
        stats: {
          total,
          processed,
          pending: Math.max(0, pending),
          failed,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    console.error('Check Zoom sync health error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({
        healthy: false,
        zoom_connected: false,
        token_valid: false,
        last_sync: null,
        stats: { total: 0, processed: 0, pending: 0, failed: 0 },
        error: message,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  }
})
