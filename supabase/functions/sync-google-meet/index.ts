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
      console.error('[sync-google-meet] JWT validation failed:', authError)
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('[sync-google-meet] Authenticated user:', user.id)

    // Use service role for database operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const body = await req.json().catch(() => ({}))
    const { meeting_id, force_refresh = false, sync_recordings = true, sync_transcripts = true } = body
    const meetingProvider: MeetingProvider = 'google_meet'

    // Get user's OAuth token from database
    const { data: tokenData, error: tokenError } = await supabaseClient
      .from('user_oauth_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', user.id)
      .eq('provider_slug', 'google-meet')
      .eq('is_active', true)
      .single()

    if (tokenError || !tokenData) {
      console.error('[sync-google-meet] No Google Meet token found:', tokenError)
      return new Response(
        JSON.stringify({ error: 'Google account not connected. Please connect your Google account first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let access_token = tokenData.access_token

    // Check if token is expired and refresh if needed
    const expiresAt = new Date(tokenData.expires_at)
    const now = new Date()
    if (expiresAt <= now && tokenData.refresh_token) {
      console.log('[sync-google-meet] Token expired, refreshing...')
      
      // Get org credentials for refresh - Google Meet provider ID
      const { data: orgIntegration } = await supabaseClient
        .from('organization_integrations')
        .select('config')
        .eq('user_id', user.id)
        .eq('provider_id', '550e8400-e29b-41d4-a716-446655440001') // Google Meet provider ID
        .single()

      if (orgIntegration?.config?.client_id && orgIntegration?.config?.client_secret) {
        const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: tokenData.refresh_token,
            client_id: orgIntegration.config.client_id,
            client_secret: orgIntegration.config.client_secret,
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
            .eq('provider_slug', 'google-meet')

          console.log('[sync-google-meet] Token refreshed successfully')
        } else {
          const errorText = await refreshResponse.text()
          console.error('[sync-google-meet] Token refresh failed:', errorText)
          return new Response(
            JSON.stringify({ error: 'Google token expired. Please reconnect your Google account.' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }
    }

    // Fetch calendar events with Google Meet links
    const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const toDate = new Date().toISOString()

    const calendarUrl = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events')
    calendarUrl.searchParams.set('timeMin', fromDate)
    calendarUrl.searchParams.set('timeMax', toDate)
    calendarUrl.searchParams.set('singleEvents', 'true')
    calendarUrl.searchParams.set('orderBy', 'startTime')
    calendarUrl.searchParams.set('maxResults', '250')

    const eventsResponse = await fetch(calendarUrl.toString(), {
      headers: {
        'Authorization': `Bearer ${access_token}`,
      },
    })

    if (!eventsResponse.ok) {
      const errorText = await eventsResponse.text()
      console.error('[sync-google-meet] Google Calendar API error:', eventsResponse.status, errorText)
      return new Response(
        JSON.stringify({ error: `Failed to fetch Google Calendar events: ${eventsResponse.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const eventsData = await eventsResponse.json()
    const events = eventsData.items || []

    // Filter events with Google Meet links
    const meetEvents = events.filter((event: any) => {
      return event.conferenceData?.conferenceSolution?.key?.type === 'hangoutsMeet' ||
             event.hangoutLink
    })

    console.log(`[sync-google-meet] Found ${meetEvents.length} Google Meet events out of ${events.length} total`)

    let syncedCount = 0

    for (const event of meetEvents) {
      const meetLink = event.hangoutLink || event.conferenceData?.entryPoints?.find((ep: any) => ep.entryPointType === 'video')?.uri
      const eventId = event.id
      const eventStart = event.start?.dateTime || event.start?.date
      const eventEnd = event.end?.dateTime || event.end?.date

      // Calculate duration in minutes
      let durationMinutes = 0
      if (eventStart && eventEnd) {
        const start = new Date(eventStart)
        const end = new Date(eventEnd)
        durationMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60))
      }

      // Check if meeting exists
      const { data: existingMeeting } = await supabaseClient
        .from('meetings')
        .select('id')
        .eq('external_id', eventId)
        .single()

      let meetingId = existingMeeting?.id

      const meetingData = {
        title: event.summary || 'Untitled Meeting',
        description: event.description,
        scheduled_at: eventStart,
        duration_minutes: durationMinutes,
        status: new Date(eventEnd) < new Date() ? 'completed' : 'scheduled',
        provider: meetingProvider,
        external_id: eventId,
        external_uuid: eventId,
        external_meeting_id: eventId,
        join_url: meetLink,
        host_url: meetLink,
        organizer_id: user.id,
      }

      if (!meetingId) {
        const { data: newMeeting, error: insertError } = await supabaseClient
          .from('meetings')
          .insert([meetingData])
          .select()
          .single()

        if (insertError) {
          console.error('[sync-google-meet] Failed to insert meeting:', insertError)
          continue
        }

        console.log('[sync-google-meet] Created meeting:', eventId)
        meetingId = newMeeting.id
        syncedCount++
      } else if (force_refresh) {
        await supabaseClient
          .from('meetings')
          .update(meetingData)
          .eq('id', meetingId)

        console.log('[sync-google-meet] Updated meeting:', eventId)
        syncedCount++
      }

      // Sync to meeting_files table if there are attachments
      if (event.attachments && event.attachments.length > 0) {
        for (const attachment of event.attachments) {
          const { error: meetingFilesError } = await supabaseClient
            .from('meeting_files')
            .upsert([{
              meeting_id: meetingId,
              external_meeting_id: eventId,
              provider: meetingProvider,
              file_type: attachment.mimeType || 'unknown',
              file_name: attachment.title || 'attachment',
              file_size: attachment.fileSize || null,
              download_url: attachment.fileUrl,
              metadata: {
                icon_link: attachment.iconLink,
                mime_type: attachment.mimeType,
              },
            }], {
              onConflict: 'external_meeting_id,file_type',
            })

          if (!meetingFilesError) {
            console.log('[sync-google-meet] Synced attachment for meeting:', eventId)
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Synced ${syncedCount} Google Meet meetings`,
        synced_count: syncedCount,
        meetings_found: meetEvents.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    console.error('[sync-google-meet] Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
