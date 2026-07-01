/**
 * Compile Meeting Summary Edge Function
 *
 * Compiles comprehensive meeting summaries from multiple sources
 * including takeaways, agenda items, and AI-generated summaries.
 *
 * Input:  { meeting_id: string }
 * Output: { success: true, compiled_summary: string, sections: { overview, decisions, action_items, notes, follow_ups } }
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

    const { meeting_id } = await req.json()

    if (!meeting_id) {
      return new Response(
        JSON.stringify({ error: 'meeting_id is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Fetch meeting details
    const { data: meeting, error: meetingError } = await supabaseClient
      .from('meetings')
      .select('id, title, start_time, duration, ai_summary, description, timezone')
      .eq('id', meeting_id)
      .single()

    if (meetingError || !meeting) {
      return new Response(
        JSON.stringify({ error: 'Meeting not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // Fetch participants for the overview
    const { data: participants } = await supabaseClient
      .from('meeting_participants')
      .select('user_id, role, profiles(full_name, email)')
      .eq('meeting_id', meeting_id)

    // Fetch all takeaways for this meeting
    const { data: takeaways } = await supabaseClient
      .from('meeting_takeaways')
      .select('id, content, takeaway_type, assigned_to, due_date')
      .eq('meeting_id', meeting_id)
      .order('created_at', { ascending: true })

    // Fetch agenda items
    const { data: agendaItems } = await supabaseClient
      .from('meeting_agenda_items')
      .select('id, title, description, is_completed, sort_order')
      .eq('meeting_id', meeting_id)
      .order('sort_order', { ascending: true })

    // Categorize takeaways by type
    const decisions = (takeaways || []).filter((t: { takeaway_type: string }) => t.takeaway_type === 'decision')
    const actionItems = (takeaways || []).filter((t: { takeaway_type: string }) => t.takeaway_type === 'action_item')
    const notes = (takeaways || []).filter((t: { takeaway_type: string }) => t.takeaway_type === 'note')
    const followUps = (takeaways || []).filter((t: { takeaway_type: string }) => t.takeaway_type === 'follow_up')

    // Build attendees list
    const attendeeNames = (participants || []).map((p: any) => {
      const profiles = p.profiles
      const profile = Array.isArray(profiles) ? profiles[0] : profiles
      return profile?.full_name || profile?.email || 'Unknown'
    })

    // Format meeting date
    const meetingDate = meeting.start_time
      ? new Date(meeting.start_time).toLocaleString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: meeting.timezone || 'UTC',
        })
      : 'Date not specified'

    // Build sections
    const overviewSection = [
      `# Meeting Summary: ${meeting.title}`,
      '',
      `**Date:** ${meetingDate}`,
      meeting.duration ? `**Duration:** ${meeting.duration} minutes` : '',
      attendeeNames.length > 0 ? `**Attendees:** ${attendeeNames.join(', ')}` : '',
      '',
    ].filter(Boolean).join('\n')

    const aiSummarySection = meeting.ai_summary
      ? `## AI Summary\n\n${meeting.ai_summary}\n`
      : ''

    const agendaSection = agendaItems && agendaItems.length > 0
      ? `## Agenda Items\n\n${agendaItems.map((item: { title: string; description: string; is_completed: boolean }) =>
          `- [${item.is_completed ? 'x' : ' '}] **${item.title}**${item.description ? `: ${item.description}` : ''}`
        ).join('\n')}\n`
      : ''

    const decisionsSection = decisions.length > 0
      ? `## Decisions Made\n\n${decisions.map((d: { content: string }) => `- ${d.content}`).join('\n')}\n`
      : ''

    const actionItemsSection = actionItems.length > 0
      ? `## Action Items\n\n${actionItems.map((a: { content: string; assigned_to: string | null; due_date: string | null }) => {
          let line = `- ${a.content}`
          if (a.assigned_to) line += ` (Assigned to: ${a.assigned_to})`
          if (a.due_date) line += ` [Due: ${a.due_date}]`
          return line
        }).join('\n')}\n`
      : ''

    const notesSection = notes.length > 0
      ? `## Notes\n\n${notes.map((n: { content: string }) => `- ${n.content}`).join('\n')}\n`
      : ''

    const followUpsSection = followUps.length > 0
      ? `## Follow-ups\n\n${followUps.map((f: { content: string }) => `- ${f.content}`).join('\n')}\n`
      : ''

    // Compile the full summary
    const compiledSummary = [
      overviewSection,
      aiSummarySection,
      agendaSection,
      decisionsSection,
      actionItemsSection,
      notesSection,
      followUpsSection,
    ].filter(Boolean).join('\n')

    const sections = {
      overview: overviewSection,
      ai_summary: aiSummarySection || null,
      agenda: agendaSection || null,
      decisions: decisions.map((d: { content: string }) => d.content),
      action_items: actionItems.map((a: { content: string; assigned_to: string | null; due_date: string | null }) => ({
        content: a.content,
        assigned_to: a.assigned_to,
        due_date: a.due_date,
      })),
      notes: notes.map((n: { content: string }) => n.content),
      follow_ups: followUps.map((f: { content: string }) => f.content),
    }

    return new Response(
      JSON.stringify({ success: true, compiled_summary: compiledSummary, sections }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    console.error('Compile meeting summary error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
