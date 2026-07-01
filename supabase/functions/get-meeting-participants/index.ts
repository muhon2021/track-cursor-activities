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

    const { meeting_id } = await req.json()

    if (!meeting_id) {
      return new Response(
        JSON.stringify({ error: 'meeting_id is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Verify the meeting exists
    const { data: meeting, error: meetingError } = await supabaseClient
      .from('meetings')
      .select('id, organizer_id')
      .eq('id', meeting_id)
      .single()

    if (meetingError || !meeting) {
      return new Response(
        JSON.stringify({ error: 'Meeting not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // Fetch internal participants from meeting_participants joined with profiles
    const { data: internalParticipants, error: internalError } = await supabaseClient
      .from('meeting_participants')
      .select('id, user_id, name, email, role, rsvp_status, attended')
      .eq('meeting_id', meeting_id)

    if (internalError) {
      console.error('Error fetching internal participants:', internalError)
      throw new Error(`Failed to fetch internal participants: ${internalError.message}`)
    }

    // Enrich internal participants with profile data (avatar, full_name, email)
    const enrichedInternal: any[] = []
    if (internalParticipants && internalParticipants.length > 0) {
      // Gather user_ids that are not null to fetch profiles
      const userIds = internalParticipants
        .map((p) => p.user_id)
        .filter((id): id is string => !!id)

      let profilesMap: Record<string, { full_name: string | null; email: string | null; avatar_url: string | null }> = {}

      if (userIds.length > 0) {
        const { data: profiles } = await supabaseClient
          .from('profiles')
          .select('id, full_name, email, avatar_url')
          .in('id', userIds)

        if (profiles) {
          profilesMap = Object.fromEntries(
            profiles.map((p) => [p.id, { full_name: p.full_name, email: p.email, avatar_url: p.avatar_url }])
          )
        }
      }

      for (const participant of internalParticipants) {
        const profile = participant.user_id ? profilesMap[participant.user_id] : null
        enrichedInternal.push({
          id: participant.id,
          name: profile?.full_name || participant.name || null,
          email: profile?.email || participant.email || null,
          role: participant.role || 'attendee',
          rsvp_status: participant.rsvp_status || null,
          is_external: false,
          avatar_url: profile?.avatar_url || null,
          attended: participant.attended ?? null,
        })
      }
    }

    // Fetch external participants from meeting_external_participants
    let enrichedExternal: Array<{
      id: string
      name: string | null
      email: string | null
      role: string
      rsvp_status: string | null
      is_external: boolean
      avatar_url: string | null
      attended: boolean | null
    }> = []

    try {
      const { data: externalParticipants, error: externalError } = await supabaseClient
        .from('meeting_external_participants')
        .select('id, name, email, role, rsvp_status, attended')
        .eq('meeting_id', meeting_id)

      if (!externalError && externalParticipants) {
        enrichedExternal = externalParticipants.map((p) => ({
          id: p.id,
          name: p.name || null,
          email: p.email || null,
          role: p.role || 'external',
          rsvp_status: p.rsvp_status || null,
          is_external: true,
          avatar_url: null,
          attended: p.attended ?? null,
        }))
      }
    } catch (externalFetchError) {
      // meeting_external_participants table may not exist — handle gracefully
      console.warn('Could not fetch external participants (table may not exist):', externalFetchError)
    }

    // Combine into unified list
    const allParticipants = [...enrichedInternal, ...enrichedExternal]

    // Sort: organizer first, then by name
    allParticipants.sort((a, b) => {
      // Check if participant is the organizer (match by looking up the organizer profile)
      const aIsOrganizer = enrichedInternal.some(
        (p) => p.id === a.id && internalParticipants?.find((ip) => ip.id === p.id)?.user_id === meeting.organizer_id
      )
      const bIsOrganizer = enrichedInternal.some(
        (p) => p.id === b.id && internalParticipants?.find((ip) => ip.id === p.id)?.user_id === meeting.organizer_id
      )

      if (aIsOrganizer && !bIsOrganizer) return -1
      if (!aIsOrganizer && bIsOrganizer) return 1

      // Also sort organizer role first
      if (a.role === 'organizer' && b.role !== 'organizer') return -1
      if (a.role !== 'organizer' && b.role === 'organizer') return 1

      // Then sort by name alphabetically
      const nameA = (a.name || a.email || '').toLowerCase()
      const nameB = (b.name || b.email || '').toLowerCase()
      return nameA.localeCompare(nameB)
    })

    return new Response(
      JSON.stringify({
        success: true,
        participants: allParticipants,
        internal_count: enrichedInternal.length,
        external_count: enrichedExternal.length,
        total: allParticipants.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    console.error('Get meeting participants error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
