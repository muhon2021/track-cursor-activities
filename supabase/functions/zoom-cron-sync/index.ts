/**
 * Zoom Cron Sync Edge Function
 *
 * Scheduled cron job to sync Zoom recordings. Fetches recordings from
 * the Zoom API, matches them to existing meetings, and stores file
 * metadata and transcript text.
 *
 * Input:  none (cron) or { days_back?: number }
 * Output: { success: true, recordings_synced: number, matched_to_meetings: number }
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

    // Parse body if available (may be empty for cron invocations)
    let daysBack = 7
    try {
      const body = await req.json()
      if (body.days_back && typeof body.days_back === 'number') {
        daysBack = body.days_back
      }
    } catch {
      // No body (cron invocation) — use default
    }

    console.log(`[zoom-cron-sync] Starting sync for last ${daysBack} days`)

    // Fetch Zoom OAuth credentials from organization_integrations
    const { data: zoomIntegration, error: integrationError } = await supabaseClient
      .from('organization_integrations')
      .select('id, config, status')
      .eq('provider_slug', 'zoom')
      .eq('status', 'active')
      .maybeSingle()

    if (integrationError || !zoomIntegration) {
      console.log('[zoom-cron-sync] No active Zoom integration found')
      return new Response(
        JSON.stringify({ success: false, error: 'No active Zoom integration found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    const config = zoomIntegration.config || {}
    let accessToken = config.access_token
    const refreshToken = config.refresh_token
    const clientId = config.client_id
    const clientSecret = config.client_secret
    const tokenExpiresAt = config.expires_at

    if (!accessToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'Zoom access token not available' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Check if token is expired and attempt refresh
    if (tokenExpiresAt && new Date(tokenExpiresAt) <= new Date()) {
      console.log('[zoom-cron-sync] Token expired, attempting refresh...')

      if (!refreshToken || !clientId || !clientSecret) {
        return new Response(
          JSON.stringify({ success: false, error: 'Zoom token expired and refresh credentials are missing' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }

      const refreshResponse = await fetch('https://zoom.us/oauth/token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      })

      if (!refreshResponse.ok) {
        const errorText = await refreshResponse.text()
        console.error('[zoom-cron-sync] Token refresh failed:', errorText)
        return new Response(
          JSON.stringify({ success: false, error: 'Zoom token refresh failed' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }

      const refreshData = await refreshResponse.json()
      accessToken = refreshData.access_token

      // Update stored credentials
      const updatedConfig = {
        ...config,
        access_token: refreshData.access_token,
        refresh_token: refreshData.refresh_token || refreshToken,
        expires_at: new Date(Date.now() + (refreshData.expires_in * 1000)).toISOString(),
      }

      await supabaseClient
        .from('organization_integrations')
        .update({ config: updatedConfig })
        .eq('id', zoomIntegration.id)

      console.log('[zoom-cron-sync] Token refreshed successfully')
    }

    // Calculate date range
    const toDate = new Date().toISOString().split('T')[0]
    const fromDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    // Fetch recordings from Zoom API
    const recordingsResponse = await fetch(
      `https://api.zoom.us/v2/users/me/recordings?from=${fromDate}&to=${toDate}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    )

    if (!recordingsResponse.ok) {
      const errorText = await recordingsResponse.text()
      console.error('[zoom-cron-sync] Zoom API error:', recordingsResponse.status, errorText)
      return new Response(
        JSON.stringify({ success: false, error: `Zoom API error: ${recordingsResponse.status}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    const recordingsData = await recordingsResponse.json()
    const zoomMeetings = recordingsData.meetings || []

    let recordingsSynced = 0
    let matchedToMeetings = 0

    for (const zoomMeeting of zoomMeetings) {
      const zoomMeetingId = String(zoomMeeting.id)

      for (const file of zoomMeeting.recording_files || []) {
        // Upsert into meeting_files
        const { error: fileError } = await supabaseClient
          .from('meeting_files')
          .upsert(
            {
              external_meeting_id: zoomMeetingId,
              provider: 'zoom',
              file_type: file.file_type,
              file_name: file.file_name || `${zoomMeeting.topic}_${file.file_type}`,
              file_size: file.file_size,
              download_url: file.download_url,
              metadata: {
                play_url: file.play_url,
                meeting_topic: zoomMeeting.topic,
                meeting_start_time: zoomMeeting.start_time,
                meeting_duration: zoomMeeting.duration,
                recording_start: file.recording_start,
                recording_end: file.recording_end,
                recording_type: file.recording_type,
              },
            },
            { onConflict: 'external_meeting_id,file_type' }
          )

        if (fileError) {
          console.error(`[zoom-cron-sync] Failed to upsert meeting file:`, fileError)
        } else {
          recordingsSynced++
        }

        // If the recording has a transcript, store it
        if (file.file_type === 'TRANSCRIPT' && file.download_url) {
          try {
            const transcriptResponse = await fetch(
              `${file.download_url}?access_token=${accessToken}`
            )

            if (transcriptResponse.ok) {
              const transcriptText = await transcriptResponse.text()

              // Try to find matching meeting and store transcript
              const { data: matchedMeeting } = await supabaseClient
                .from('meetings')
                .select('id')
                .or(`zoom_meeting_id.eq.${zoomMeetingId},external_meeting_id.eq.${zoomMeetingId}`)
                .maybeSingle()

              if (matchedMeeting) {
                await supabaseClient
                  .from('meeting_transcripts')
                  .upsert(
                    {
                      meeting_id: matchedMeeting.id,
                      content: transcriptText,
                      source: 'zoom',
                    },
                    { onConflict: 'meeting_id' }
                  )
              }
            }
          } catch (transcriptError) {
            console.error('[zoom-cron-sync] Failed to fetch transcript:', transcriptError)
          }
        }
      }

      // Try to match recording to existing meeting by zoom_meeting_id or title
      const { data: existingMeeting } = await supabaseClient
        .from('meetings')
        .select('id')
        .or(`zoom_meeting_id.eq.${zoomMeetingId},external_meeting_id.eq.${zoomMeetingId}`)
        .maybeSingle()

      if (existingMeeting) {
        // Update meeting_files with the meeting_id
        await supabaseClient
          .from('meeting_files')
          .update({ meeting_id: existingMeeting.id })
          .eq('external_meeting_id', zoomMeetingId)
          .eq('provider', 'zoom')

        matchedToMeetings++
      } else {
        // Try title-based matching as fallback
        const { data: titleMatch } = await supabaseClient
          .from('meetings')
          .select('id')
          .ilike('title', `%${zoomMeeting.topic}%`)
          .gte('scheduled_at', new Date(new Date(zoomMeeting.start_time).getTime() - 24 * 60 * 60 * 1000).toISOString())
          .lte('scheduled_at', new Date(new Date(zoomMeeting.start_time).getTime() + 24 * 60 * 60 * 1000).toISOString())
          .maybeSingle()

        if (titleMatch) {
          await supabaseClient
            .from('meeting_files')
            .update({ meeting_id: titleMatch.id })
            .eq('external_meeting_id', zoomMeetingId)
            .eq('provider', 'zoom')

          matchedToMeetings++
        }
      }
    }

    console.log(`[zoom-cron-sync] Completed: ${recordingsSynced} recordings synced, ${matchedToMeetings} matched to meetings`)

    return new Response(
      JSON.stringify({
        success: true,
        recordings_synced: recordingsSynced,
        matched_to_meetings: matchedToMeetings,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    console.error('Zoom cron sync error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
