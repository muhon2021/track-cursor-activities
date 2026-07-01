/**
 * Sync Meeting Participants Edge Function
 *
 * Syncs participants from a source meeting to related meetings in the
 * same recurring series. Supports syncing to future meetings only or
 * all meetings in the series.
 *
 * Input:  { meeting_id: string, sync_to: 'future' | 'all' }
 * Output: { success: true, meetings_synced: number, participants_synced: number }
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

    const { meeting_id, sync_to = 'future' } = await req.json()

    if (!meeting_id) {
      return new Response(
        JSON.stringify({ error: 'meeting_id is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    if (sync_to !== 'future' && sync_to !== 'all') {
      return new Response(
        JSON.stringify({ error: 'sync_to must be "future" or "all"' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Fetch the source meeting to get series info
    const { data: sourceMeeting, error: meetingError } = await supabaseClient
      .from('meetings')
      .select('id, parent_meeting_id, series_id, scheduled_at')
      .eq('id', meeting_id)
      .single()

    if (meetingError || !sourceMeeting) {
      return new Response(
        JSON.stringify({ error: 'Meeting not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // Fetch source meeting participants
    const { data: sourceParticipants, error: participantsError } = await supabaseClient
      .from('meeting_participants')
      .select('user_id, email, name, role, status')
      .eq('meeting_id', meeting_id)

    if (participantsError) {
      throw new Error(`Failed to fetch source participants: ${participantsError.message}`)
    }

    if (!sourceParticipants || sourceParticipants.length === 0) {
      return new Response(
        JSON.stringify({ success: true, meetings_synced: 0, participants_synced: 0, message: 'No participants found on source meeting' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Fetch source meeting external participants
    let sourceExternalParticipants: Array<{
      external_email: string
      external_name: string | null
      role: string | null
    }> = []
    try {
      const { data: extParts, error: extError } = await supabaseClient
        .from('meeting_external_participants')
        .select('external_email, external_name, role')
        .eq('meeting_id', meeting_id)

      if (!extError && extParts) {
        sourceExternalParticipants = extParts
      }
    } catch {
      console.log('[sync-meeting-participants] meeting_external_participants not available')
    }

    // Find related meetings in the same series
    const seriesId = sourceMeeting.series_id || sourceMeeting.parent_meeting_id
    if (!seriesId) {
      return new Response(
        JSON.stringify({
          success: true,
          meetings_synced: 0,
          participants_synced: 0,
          message: 'Meeting is not part of a recurring series (no series_id or parent_meeting_id)',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Build query for related meetings
    let relatedQuery = supabaseClient
      .from('meetings')
      .select('id, scheduled_at')
      .neq('id', meeting_id)

    // Match by series_id or parent_meeting_id
    if (sourceMeeting.series_id) {
      relatedQuery = relatedQuery.eq('series_id', sourceMeeting.series_id)
    } else {
      relatedQuery = relatedQuery.or(
        `parent_meeting_id.eq.${sourceMeeting.parent_meeting_id},id.eq.${sourceMeeting.parent_meeting_id}`
      )
    }

    // If sync_to is 'future', only include meetings after now
    if (sync_to === 'future') {
      relatedQuery = relatedQuery.gt('scheduled_at', new Date().toISOString())
    }

    const { data: relatedMeetings, error: relatedError } = await relatedQuery

    if (relatedError) {
      throw new Error(`Failed to fetch related meetings: ${relatedError.message}`)
    }

    if (!relatedMeetings || relatedMeetings.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          meetings_synced: 0,
          participants_synced: 0,
          message: `No ${sync_to === 'future' ? 'future ' : ''}related meetings found in the series`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    let meetingsSynced = 0
    let participantsSynced = 0

    for (const targetMeeting of relatedMeetings) {
      let syncedForThisMeeting = false

      // Upsert internal participants
      for (const participant of sourceParticipants) {
        const { error: upsertError } = await supabaseClient
          .from('meeting_participants')
          .upsert(
            {
              meeting_id: targetMeeting.id,
              user_id: participant.user_id,
              email: participant.email,
              name: participant.name,
              role: participant.role,
              status: participant.status || 'pending',
            },
            { onConflict: 'meeting_id,user_id' }
          )

        if (upsertError) {
          console.error(
            `[sync-meeting-participants] Failed to upsert participant for meeting ${targetMeeting.id}:`,
            upsertError
          )
        } else {
          participantsSynced++
          syncedForThisMeeting = true
        }
      }

      // Upsert external participants
      for (const extParticipant of sourceExternalParticipants) {
        try {
          const { error: extUpsertError } = await supabaseClient
            .from('meeting_external_participants')
            .upsert(
              {
                meeting_id: targetMeeting.id,
                external_email: extParticipant.external_email,
                external_name: extParticipant.external_name,
                role: extParticipant.role,
              },
              { onConflict: 'meeting_id,external_email' }
            )

          if (extUpsertError) {
            console.error(
              `[sync-meeting-participants] Failed to upsert external participant for meeting ${targetMeeting.id}:`,
              extUpsertError
            )
          } else {
            participantsSynced++
            syncedForThisMeeting = true
          }
        } catch {
          console.log('[sync-meeting-participants] External participant upsert not supported')
        }
      }

      if (syncedForThisMeeting) {
        meetingsSynced++
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        meetings_synced: meetingsSynced,
        participants_synced: participantsSynced,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    console.error('Sync meeting participants error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
