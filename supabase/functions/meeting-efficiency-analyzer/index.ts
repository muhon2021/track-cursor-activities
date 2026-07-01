/**
 * Meeting Efficiency Analyzer Edge Function
 *
 * Analyzes meeting efficiency metrics for a single meeting or a date range.
 * Calculates weighted scores for duration, engagement, agenda completion,
 * takeaway density, action item rate, and follow-up completion.
 *
 * Input:  { meeting_id?: string, date_range?: { start: string, end: string }, user_id?: string }
 * Output: { success: true, metrics: { overall_score, duration_efficiency, participant_engagement, agenda_completion, takeaway_density, action_item_rate }, recommendations: string[] }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MeetingMetrics {
  overall_score: number
  duration_efficiency: number
  participant_engagement: number
  agenda_completion: number
  takeaway_density: number
  action_item_rate: number
  follow_up_completion: number
}

// Weighted average factors for overall score
const WEIGHTS = {
  duration_efficiency: 0.15,
  participant_engagement: 0.20,
  agenda_completion: 0.25,
  takeaway_density: 0.15,
  action_item_rate: 0.10,
  follow_up_completion: 0.15,
}

function generateRecommendations(metrics: MeetingMetrics): string[] {
  const recommendations: string[] = []

  if (metrics.duration_efficiency < 0.5) {
    recommendations.push('Meetings are running significantly over or under scheduled time. Consider adjusting meeting duration estimates.')
  }
  if (metrics.participant_engagement < 0.6) {
    recommendations.push('Participant acceptance rate is low. Ensure invitations reach the right people and meeting purpose is clear.')
  }
  if (metrics.agenda_completion < 0.5) {
    recommendations.push('Agenda items are frequently left incomplete. Consider reducing the number of agenda items or extending meeting time.')
  }
  if (metrics.takeaway_density < 0.3) {
    recommendations.push('Few takeaways are being captured per hour. Designate a note-taker or use AI transcription to capture more outcomes.')
  }
  if (metrics.action_item_rate < 0.3) {
    recommendations.push('Low ratio of action items to total takeaways. Encourage more concrete, assignable next steps during meetings.')
  }
  if (metrics.follow_up_completion < 0.5) {
    recommendations.push('Follow-up action items have low completion rates. Implement regular check-ins on outstanding items.')
  }
  if (metrics.overall_score >= 80) {
    recommendations.push('Meeting efficiency is excellent. Maintain current practices.')
  }

  return recommendations
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

    const { meeting_id, date_range, user_id } = await req.json()

    if (!meeting_id && !date_range) {
      return new Response(
        JSON.stringify({ error: 'Either meeting_id or date_range is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Build meeting query
    let meetingQuery = supabaseClient
      .from('meetings')
      .select('id, title, start_time, duration, scheduled_duration')

    if (meeting_id) {
      meetingQuery = meetingQuery.eq('id', meeting_id)
    } else if (date_range) {
      meetingQuery = meetingQuery
        .gte('start_time', date_range.start)
        .lte('start_time', date_range.end)
    }

    if (user_id) {
      // Filter by user participation — fetch meeting IDs first
      const { data: userMeetings } = await supabaseClient
        .from('meeting_participants')
        .select('meeting_id')
        .eq('user_id', user_id)

      if (userMeetings && userMeetings.length > 0) {
        const meetingIds = userMeetings.map((m: { meeting_id: string }) => m.meeting_id)
        meetingQuery = meetingQuery.in('id', meetingIds)
      }
    }

    const { data: meetings, error: meetingsError } = await meetingQuery

    if (meetingsError) {
      throw new Error(`Failed to fetch meetings: ${meetingsError.message}`)
    }

    if (!meetings || meetings.length === 0) {
      return new Response(
        JSON.stringify({ success: true, metrics: null, recommendations: [], message: 'No meetings found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    const meetingIds = meetings.map((m: { id: string }) => m.id)

    // Fetch participants for all meetings
    const { data: participants } = await supabaseClient
      .from('meeting_participants')
      .select('meeting_id, user_id, status')
      .in('meeting_id', meetingIds)

    // Fetch agenda items for all meetings
    const { data: agendaItems } = await supabaseClient
      .from('meeting_agenda_items')
      .select('meeting_id, is_completed')
      .in('meeting_id', meetingIds)

    // Fetch takeaways for all meetings
    const { data: takeaways } = await supabaseClient
      .from('meeting_takeaways')
      .select('meeting_id, takeaway_type')
      .in('meeting_id', meetingIds)

    // Fetch action items for all meetings
    const { data: actionItems } = await supabaseClient
      .from('meeting_action_items')
      .select('meeting_id, status')
      .in('meeting_id', meetingIds)

    // Calculate metrics

    // 1. Duration efficiency: actual vs scheduled duration
    let durationEfficiencySum = 0
    let durationCount = 0
    for (const meeting of meetings) {
      const actual = meeting.duration || 0
      const scheduled = meeting.scheduled_duration || actual
      if (scheduled > 0 && actual > 0) {
        // Perfect is 1.0 (actual === scheduled), penalty for over or under
        const ratio = actual / scheduled
        const efficiency = ratio <= 1.0 ? ratio : Math.max(0, 2.0 - ratio)
        durationEfficiencySum += efficiency
        durationCount++
      }
    }
    const durationEfficiency = durationCount > 0 ? durationEfficiencySum / durationCount : 0.5

    // 2. Participant engagement: accepted / invited ratio
    let engagementSum = 0
    let engagementCount = 0
    for (const mid of meetingIds) {
      const meetingParticipants = (participants || []).filter(
        (p: { meeting_id: string }) => p.meeting_id === mid
      )
      if (meetingParticipants.length > 0) {
        const accepted = meetingParticipants.filter(
          (p: { status: string }) => p.status === 'accepted' || p.status === 'attended'
        ).length
        engagementSum += accepted / meetingParticipants.length
        engagementCount++
      }
    }
    const participantEngagement = engagementCount > 0 ? engagementSum / engagementCount : 0.5

    // 3. Agenda completion: completed / total agenda items
    const totalAgendaItems = (agendaItems || []).length
    const completedAgendaItems = (agendaItems || []).filter(
      (a: { is_completed: boolean }) => a.is_completed
    ).length
    const agendaCompletion = totalAgendaItems > 0 ? completedAgendaItems / totalAgendaItems : 0.5

    // 4. Takeaway density: takeaways per hour
    const totalTakeaways = (takeaways || []).length
    const totalHours = meetings.reduce(
      (sum: number, m: { duration: number | null }) => sum + ((m.duration || 60) / 60),
      0
    )
    const rawDensity = totalHours > 0 ? totalTakeaways / totalHours : 0
    // Normalize: 5 takeaways per hour = 1.0
    const takeawayDensity = Math.min(1.0, rawDensity / 5)

    // 5. Action item rate: action items / total takeaways
    const actionTakeaways = (takeaways || []).filter(
      (t: { takeaway_type: string }) => t.takeaway_type === 'action_item'
    ).length
    const actionItemRate = totalTakeaways > 0 ? actionTakeaways / totalTakeaways : 0

    // 6. Follow-up completion: completed action items / total action items
    const totalActionItems = (actionItems || []).length
    const completedActionItems = (actionItems || []).filter(
      (a: { status: string }) => a.status === 'completed' || a.status === 'done'
    ).length
    const followUpCompletion = totalActionItems > 0 ? completedActionItems / totalActionItems : 0.5

    // Calculate overall score (0-100) as weighted average
    const overallScore = Math.round(
      (
        WEIGHTS.duration_efficiency * durationEfficiency +
        WEIGHTS.participant_engagement * participantEngagement +
        WEIGHTS.agenda_completion * agendaCompletion +
        WEIGHTS.takeaway_density * takeawayDensity +
        WEIGHTS.action_item_rate * actionItemRate +
        WEIGHTS.follow_up_completion * followUpCompletion
      ) * 100
    )

    const metrics: MeetingMetrics = {
      overall_score: overallScore,
      duration_efficiency: Math.round(durationEfficiency * 100) / 100,
      participant_engagement: Math.round(participantEngagement * 100) / 100,
      agenda_completion: Math.round(agendaCompletion * 100) / 100,
      takeaway_density: Math.round(takeawayDensity * 100) / 100,
      action_item_rate: Math.round(actionItemRate * 100) / 100,
      follow_up_completion: Math.round(followUpCompletion * 100) / 100,
    }

    const recommendations = generateRecommendations(metrics)

    // If single meeting, update the efficiency_score on the meeting
    if (meeting_id) {
      const { error: updateError } = await supabaseClient
        .from('meetings')
        .update({ efficiency_score: overallScore })
        .eq('id', meeting_id)

      if (updateError) {
        console.error('[meeting-efficiency-analyzer] Failed to update efficiency_score:', updateError)
      }
    }

    return new Response(
      JSON.stringify({ success: true, metrics, recommendations }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    console.error('Meeting efficiency analyzer error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
