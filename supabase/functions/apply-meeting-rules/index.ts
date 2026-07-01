/**
 * Apply Meeting Rules Edge Function
 *
 * Applies rule-based categorization to meetings without AI. Matches meetings
 * to categories based on title keywords, client associations, and
 * participant composition.
 *
 * Input:  { meeting_id: string } or { meeting_ids: string[] }
 * Output: { success: true, categorized: number, rules_applied: [{ meeting_id, rule, category }] }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RuleResult {
  meeting_id: string
  rule: string
  category: string
  meeting_type: string
}

function applyRules(
  meeting: {
    id: string
    title: string | null
    description: string | null
    client_id: string | null
  },
  allParticipantsInternal: boolean,
): RuleResult {
  const title = (meeting.title || '').toLowerCase()
  const description = (meeting.description || '').toLowerCase()
  const combined = `${title} ${description}`

  // Rule 1: Standup/daily
  if (/\b(standup|stand-up|daily)\b/.test(combined)) {
    return {
      meeting_id: meeting.id,
      rule: 'title_contains_standup_or_daily',
      category: 'standup',
      meeting_type: 'standup',
    }
  }

  // Rule 2: Sprint/planning
  if (/\b(sprint|planning)\b/.test(combined)) {
    return {
      meeting_id: meeting.id,
      rule: 'title_contains_sprint_or_planning',
      category: 'planning',
      meeting_type: 'planning',
    }
  }

  // Rule 3: Review/retro
  if (/\b(review|retro|retrospective)\b/.test(combined)) {
    return {
      meeting_id: meeting.id,
      rule: 'title_contains_review_or_retro',
      category: 'review',
      meeting_type: 'review',
    }
  }

  // Rule 4: Has client_id
  if (meeting.client_id) {
    return {
      meeting_id: meeting.id,
      rule: 'has_client_id',
      category: 'client_meeting',
      meeting_type: 'client',
    }
  }

  // Rule 5: All participants internal
  if (allParticipantsInternal) {
    return {
      meeting_id: meeting.id,
      rule: 'all_participants_internal',
      category: 'internal_meeting',
      meeting_type: 'internal',
    }
  }

  // Default
  return {
    meeting_id: meeting.id,
    rule: 'default',
    category: 'other',
    meeting_type: 'internal',
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

    const body = await req.json()
    const { meeting_id, meeting_ids: providedMeetingIds } = body

    // Normalize to an array of meeting IDs
    let meetingIds: string[] = []
    if (providedMeetingIds && Array.isArray(providedMeetingIds)) {
      meetingIds = providedMeetingIds
    } else if (meeting_id) {
      meetingIds = [meeting_id]
    } else {
      return new Response(
        JSON.stringify({ error: 'Either meeting_id or meeting_ids is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    if (meetingIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'meeting_ids must be a non-empty array' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Fetch meetings
    const { data: meetings, error: meetingsError } = await supabaseClient
      .from('meetings')
      .select('id, title, description, client_id')
      .in('id', meetingIds)

    if (meetingsError) {
      throw new Error(`Failed to fetch meetings: ${meetingsError.message}`)
    }

    if (!meetings || meetings.length === 0) {
      return new Response(
        JSON.stringify({ success: true, categorized: 0, rules_applied: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Fetch participants for all meetings
    const { data: participants } = await supabaseClient
      .from('meeting_participants')
      .select('meeting_id, user_id')
      .in('meeting_id', meetingIds)

    // Fetch external participants to determine internal-only meetings
    let externalParticipants: { meeting_id: string }[] = []
    try {
      const { data: extParts, error: extError } = await supabaseClient
        .from('meeting_external_participants')
        .select('meeting_id')
        .in('meeting_id', meetingIds)

      if (!extError && extParts) {
        externalParticipants = extParts
      }
    } catch {
      console.log('[apply-meeting-rules] meeting_external_participants not available')
    }

    const rulesApplied: RuleResult[] = []

    for (const meeting of meetings) {
      // Determine if all participants are internal (no external participants)
      const hasExternal = externalParticipants.some(
        (ep: { meeting_id: string }) => ep.meeting_id === meeting.id
      )
      const hasInternalParticipants = (participants || []).some(
        (p: { meeting_id: string }) => p.meeting_id === meeting.id
      )
      const allParticipantsInternal = hasInternalParticipants && !hasExternal

      const ruleResult = applyRules(meeting, allParticipantsInternal)
      rulesApplied.push(ruleResult)

      // Upsert into meeting_categorizations with source='rule', confidence=1.0
      const { error: catError } = await supabaseClient
        .from('meeting_categorizations')
        .upsert(
          {
            meeting_id: meeting.id,
            category: ruleResult.category,
            meeting_type: ruleResult.meeting_type,
            confidence: 1.0,
            source: 'rule',
            tags: [ruleResult.rule],
          },
          { onConflict: 'meeting_id' }
        )

      if (catError) {
        console.error(`[apply-meeting-rules] Failed to upsert categorization for ${meeting.id}:`, catError)

        // Fallback: try insert if upsert fails
        const { error: insertError } = await supabaseClient
          .from('meeting_categorizations')
          .insert({
            meeting_id: meeting.id,
            category: ruleResult.category,
            meeting_type: ruleResult.meeting_type,
            confidence: 1.0,
            source: 'rule',
            tags: [ruleResult.rule],
          })

        if (insertError) {
          console.error(`[apply-meeting-rules] Fallback insert also failed for ${meeting.id}:`, insertError)
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        categorized: rulesApplied.length,
        rules_applied: rulesApplied,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    console.error('Apply meeting rules error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
