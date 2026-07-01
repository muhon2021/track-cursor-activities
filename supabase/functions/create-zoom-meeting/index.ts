import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform',
}

interface CreateMeetingRequest {
  topic: string;
  start_time: string;
  duration: number;
  timezone?: string;
  agenda?: string;
  settings?: {
    host_video?: boolean;
    participant_video?: boolean;
    join_before_host?: boolean;
    mute_upon_entry?: boolean;
    waiting_room?: boolean;
    registrants_email_notification?: boolean;
  };
  registrants?: Array<{
    email: string;
    first_name?: string;
    last_name?: string;
  }>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Manual JWT validation for ES256 compatibility
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    
    // Create client with auth header for RLS
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Validate the JWT
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)
    if (authError || !user) {
      console.error('[create-zoom-meeting] JWT validation failed:', authError)
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('[create-zoom-meeting] Authenticated user:', user.id)

    // Use service role for database operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Parse request body
    let body: CreateMeetingRequest;
    try {
      body = await req.json()
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { topic, start_time, duration, timezone, agenda, settings, registrants } = body

    // Validate required fields
    if (!topic?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Meeting title is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!start_time) {
      return new Response(
        JSON.stringify({ error: 'Start time is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!duration || duration < 1) {
      return new Response(
        JSON.stringify({ error: 'Duration must be at least 1 minute' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user's OAuth token from database
    const { data: tokenData, error: tokenError } = await supabaseClient
      .from('user_oauth_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', user.id)
      .eq('provider_slug', 'zoom')
      .eq('is_active', true)
      .single()

    if (tokenError || !tokenData) {
      console.error('[create-zoom-meeting] No Zoom token found:', tokenError)
      return new Response(
        JSON.stringify({ error: 'Zoom account not connected. Please connect your Zoom account first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let access_token = tokenData.access_token

    // Check if token is expired and refresh if needed
    const expiresAt = new Date(tokenData.expires_at)
    const now = new Date()
    if (expiresAt <= now && tokenData.refresh_token) {
      console.log('[create-zoom-meeting] Token expired, refreshing...')
      
      // Get org credentials for refresh
      const { data: orgIntegration } = await supabaseClient
        .from('organization_integrations')
        .select('config')
        .eq('user_id', user.id)
        .eq('provider_id', 'b8b53f6f-de8a-42bb-89dd-2606061c7997') // Zoom provider ID
        .single()

      if (orgIntegration?.config?.client_id && orgIntegration?.config?.client_secret) {
        const refreshResponse = await fetch('https://zoom.us/oauth/token', {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(`${orgIntegration.config.client_id}:${orgIntegration.config.client_secret}`)}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: tokenData.refresh_token,
          }),
        })

        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json()
          access_token = refreshData.access_token

          // Update token in database
          await supabaseClient
            .from('user_oauth_tokens')
            .update({
              access_token: refreshData.access_token,
              refresh_token: refreshData.refresh_token || tokenData.refresh_token,
              expires_at: new Date(Date.now() + (refreshData.expires_in * 1000)).toISOString(),
              last_refreshed_at: new Date().toISOString(),
            })
            .eq('user_id', user.id)
            .eq('provider_slug', 'zoom')

          console.log('[create-zoom-meeting] Token refreshed successfully')
        } else {
          const errorText = await refreshResponse.text()
          console.error('[create-zoom-meeting] Token refresh failed:', errorText)
          return new Response(
            JSON.stringify({ error: 'Zoom token expired. Please disconnect and reconnect your Zoom account.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      } else {
        return new Response(
          JSON.stringify({ error: 'Zoom token expired and no refresh credentials available.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Build Zoom API request body
    const zoomRequestBody: Record<string, unknown> = {
      topic: topic.trim(),
      type: 2, // Scheduled meeting
      start_time: new Date(start_time).toISOString(),
      duration: duration,
      timezone: timezone || 'UTC',
      agenda: agenda || '',
      settings: {
        host_video: settings?.host_video ?? true,
        participant_video: settings?.participant_video ?? false,
        join_before_host: settings?.join_before_host ?? false,
        mute_upon_entry: settings?.mute_upon_entry ?? false,
        waiting_room: settings?.waiting_room ?? false,
        registrants_email_notification: settings?.registrants_email_notification ?? true,
      },
    }

    // Add registrants if provided
    if (registrants && registrants.length > 0) {
      zoomRequestBody.settings = {
        ...(zoomRequestBody.settings as Record<string, unknown>),
        approval_type: 0, // Automatically approve
        registrants_confirmation_email: true,
      }
      zoomRequestBody.registrants = registrants
    }

    console.log('[create-zoom-meeting] Creating Zoom meeting:', topic)

    // Make request to Zoom API
    const zoomResponse = await fetch('https://api.zoom.us/v2/users/me/meetings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(zoomRequestBody),
    })

    if (!zoomResponse.ok) {
      const errorData = await zoomResponse.json().catch(() => ({}))
      const errorMessage = errorData.message || `HTTP ${zoomResponse.status}: ${zoomResponse.statusText}`
      
      console.error('[create-zoom-meeting] Zoom API error:', zoomResponse.status, errorMessage)

      if (zoomResponse.status === 401) {
        return new Response(
          JSON.stringify({ error: 'Zoom authentication failed. Please disconnect and reconnect your Zoom account.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } else if (zoomResponse.status === 403) {
        return new Response(
          JSON.stringify({ error: 'Missing Zoom permissions. Please ensure your Zoom app has meeting:write:meeting scope.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      return new Response(
        JSON.stringify({ error: `Failed to create Zoom meeting: ${errorMessage}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const zoomData = await zoomResponse.json()
    
    if (!zoomData.id || !zoomData.join_url) {
      console.error('[create-zoom-meeting] Invalid Zoom response:', zoomData)
      return new Response(
        JSON.stringify({ error: 'Invalid response from Zoom API - missing meeting ID or join URL' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('[create-zoom-meeting] Zoom meeting created successfully:', zoomData.id)

    // Return the created meeting data
    return new Response(
      JSON.stringify({
        zoom_meeting_id: String(zoomData.id),
        title: zoomData.topic,
        scheduled_at: zoomData.start_time,
        duration_minutes: zoomData.duration,
        join_url: zoomData.join_url,
        start_url: zoomData.start_url,
        meeting_type: 'zoom',
        status: 'scheduled',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    console.error('[create-zoom-meeting] Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
