/**
 * Log Activity Edge Function
 *
 * Records user actions to the activity_logs table for auditing.
 * Fire-and-forget — always returns success to the caller.
 *
 * Input:  { user_id, action, resource_type?, resource_id?, details? }
 * Output: { success: true }
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

    const { user_id, action, resource_type, resource_id, details } = await req.json()

    if (!user_id || !action) {
      return new Response(
        JSON.stringify({ error: 'user_id and action are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Extract request metadata
    const ipAddress = req.headers.get('x-forwarded-for') ||
      req.headers.get('x-real-ip') || null
    const userAgent = req.headers.get('user-agent') || null

    const { error } = await supabaseClient.from('activity_logs').insert({
      user_id,
      action,
      resource_type: resource_type || null,
      resource_id: resource_id || null,
      details: details || {},
      ip_address: ipAddress,
      user_agent: userAgent,
    })

    if (error) {
      console.error('Failed to log activity:', error)
    }

    // Always return success — logging should not block the caller
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    console.error('Log activity error:', error)
    // Still return success — best-effort logging
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  }
})
