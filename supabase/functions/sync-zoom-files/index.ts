import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { MeetingProvider } from "../_shared/meeting-providers.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform',
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
      console.error('JWT validation failed:', authError)
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('[sync-zoom-files] Authenticated user:', user.id)

    // Use service role for database operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { action = 'sync', date_from, date_to, provider = 'zoom' } = await req.json()
    const meetingProvider = provider as MeetingProvider

    if (meetingProvider !== 'zoom') {
      throw new Error(`Unsupported provider: ${meetingProvider}`)
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
      console.error('[sync-zoom-files] No Zoom token found:', tokenError)
      throw new Error('Zoom account not connected. Please connect your Zoom account first.')
    }

    let access_token = tokenData.access_token

    // Check if token is expired and refresh if needed
    const expiresAt = new Date(tokenData.expires_at)
    const now = new Date()
    if (expiresAt <= now && tokenData.refresh_token) {
      console.log('[sync-zoom-files] Token expired, refreshing...')
      
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

          console.log('[sync-zoom-files] Token refreshed successfully')
        } else {
          console.error('[sync-zoom-files] Token refresh failed')
          throw new Error('Zoom token expired. Please reconnect your Zoom account.')
        }
      }
    }

    // Get recordings from Zoom
    const fromDate = date_from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const toDate = date_to || new Date().toISOString().split('T')[0]

    const recordingsResponse = await fetch(
      `https://api.zoom.us/v2/users/me/recordings?from=${fromDate}&to=${toDate}`,
      {
        headers: {
          'Authorization': `Bearer ${access_token}`,
        },
      }
    )

    if (!recordingsResponse.ok) {
      const errorText = await recordingsResponse.text()
      console.error('[sync-zoom-files] Zoom API error:', recordingsResponse.status, errorText)
      throw new Error(`Failed to fetch Zoom recordings: ${recordingsResponse.status} - ${errorText}`)
    }

    const recordingsData = await recordingsResponse.json()
    const meetings = recordingsData.meetings || []

    let syncedCount = 0

    for (const meeting of meetings) {
      // Check if meeting exists
      const { data: existingMeeting } = await supabaseClient
        .from('meetings')
        .select('id')
        .or(`zoom_id.eq.${meeting.uuid},external_id.eq.${meeting.uuid}`)
        .single()

      let meetingId = existingMeeting?.id

      const meetingData = {
        title: meeting.topic,
        zoom_id: meeting.uuid,
        zoom_meeting_id: String(meeting.id),
        zoom_join_url: meeting.join_url,
        zoom_start_url: meeting.start_url,
        scheduled_at: meeting.start_time,
        duration_minutes: meeting.duration,
        status: 'completed',
        provider: meetingProvider,
        external_id: meeting.uuid,
        external_uuid: meeting.uuid,
        external_meeting_id: String(meeting.id),
        join_url: meeting.join_url,
        host_url: meeting.start_url,
      }

      if (!meetingId) {
        const { data: newMeeting } = await supabaseClient
          .from('meetings')
          .insert([meetingData])
          .select()
          .single()

        console.log('[sync-zoom-files] Created meeting with dual-write fields:', meeting.uuid)
        meetingId = newMeeting.id
      } else {
        await supabaseClient
          .from('meetings')
          .update(meetingData)
          .eq('id', meetingId)

        console.log('[sync-zoom-files] Updated meeting with dual-write fields:', meeting.uuid)
      }

      // Sync recording files
      for (const file of meeting.recording_files || []) {
        const { error } = await supabaseClient
          .from('zoom_files')
          .upsert([{
            meeting_id: meetingId,
            zoom_meeting_id: String(meeting.id),
            file_type: file.file_type,
            file_name: file.file_name || `${meeting.topic}_${file.file_type}`,
            file_size: file.file_size,
            download_url: file.download_url,
            play_url: file.play_url,
            meeting_topic: meeting.topic,
            meeting_start_time: meeting.start_time,
            meeting_duration: meeting.duration,
          }], {
            onConflict: 'zoom_meeting_id,file_type',
          })

        const { error: meetingFilesError } = await supabaseClient
          .from('meeting_files')
          .upsert([{
            meeting_id: meetingId,
            external_meeting_id: String(meeting.id),
            provider: meetingProvider,
            file_type: file.file_type,
            file_name: file.file_name || `${meeting.topic}_${file.file_type}`,
            file_size: file.file_size,
            download_url: file.download_url,
            metadata: {
              play_url: file.play_url,
              meeting_topic: meeting.topic,
              meeting_start_time: meeting.start_time,
              meeting_duration: meeting.duration,
            },
          }], {
            onConflict: 'external_meeting_id,file_type',
          })

        if (!error && !meetingFilesError) {
          syncedCount++
          console.log('[sync-zoom-files] Dual-wrote meeting file:', meeting.id, file.file_type)
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        synced_count: syncedCount,
        meetings_found: meetings.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    console.error('Sync Zoom files error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
