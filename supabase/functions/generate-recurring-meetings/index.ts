/**
 * Generate Recurring Meetings Edge Function
 *
 * Generates instances of recurring meetings. Designed for cron execution
 * but can also be triggered manually with an optional series_id filter.
 *
 * Input:  none (cron job) or { series_id?: string }
 * Output: { success: true, instances_created: number, series_processed: number }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function calculateNextOccurrence(baseDate: string, pattern: string): string {
  const date = new Date(baseDate)
  switch (pattern) {
    case 'daily':
      date.setDate(date.getDate() + 1)
      break
    case 'weekly':
      date.setDate(date.getDate() + 7)
      break
    case 'biweekly':
      date.setDate(date.getDate() + 14)
      break
    case 'monthly':
      date.setMonth(date.getMonth() + 1)
      break
    default:
      return ''
  }
  return date.toISOString()
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

    // Parse optional body (may be empty for cron invocations)
    let seriesId: string | undefined
    try {
      const body = await req.json()
      seriesId = body?.series_id
    } catch {
      // No body provided — this is fine for cron invocations
    }

    let instancesCreated = 0
    let seriesProcessed = 0

    // Strategy 1: Fetch active meeting_series
    let seriesQuery = supabaseClient
      .from('meeting_series')
      .select('*')
      .eq('is_active', true)

    if (seriesId) {
      seriesQuery = seriesQuery.eq('id', seriesId)
    }

    const { data: seriesList, error: seriesError } = await seriesQuery

    if (seriesError) {
      console.error('Error fetching meeting series:', seriesError)
    }

    if (seriesList && seriesList.length > 0) {
      for (const series of seriesList) {
        const pattern = series.recurrence_pattern
        if (!pattern || pattern === 'none') continue

        // Find the most recent instance in this series
        const { data: latestInstance } = await supabaseClient
          .from('meetings')
          .select('id, start_time')
          .eq('series_id', series.id)
          .order('start_time', { ascending: false })
          .limit(1)
          .maybeSingle()

        const baseDate = latestInstance?.start_time || series.start_date || new Date().toISOString()
        const nextDate = calculateNextOccurrence(baseDate, pattern)

        if (!nextDate) continue

        // Check if an instance already exists for this date (avoid duplicates)
        const nextDateStart = nextDate.split('T')[0]
        const { data: existing } = await supabaseClient
          .from('meetings')
          .select('id')
          .eq('series_id', series.id)
          .gte('start_time', `${nextDateStart}T00:00:00.000Z`)
          .lte('start_time', `${nextDateStart}T23:59:59.999Z`)
          .maybeSingle()

        if (existing) {
          console.log(`Instance already exists for series ${series.id} on ${nextDateStart}`)
          seriesProcessed++
          continue
        }

        // Create new meeting instance
        const { data: newMeeting, error: createError } = await supabaseClient
          .from('meetings')
          .insert({
            title: series.title,
            description: series.description,
            start_time: nextDate,
            duration: series.duration,
            series_id: series.id,
            created_by: series.created_by,
            is_recurring: true,
            recurrence_pattern: pattern,
          })
          .select('id')
          .single()

        if (createError) {
          console.error(`Error creating meeting for series ${series.id}:`, createError)
          continue
        }

        // Copy participants from the series template or latest instance
        if (latestInstance) {
          const { data: participants } = await supabaseClient
            .from('meeting_participants')
            .select('user_id, role')
            .eq('meeting_id', latestInstance.id)

          if (participants && participants.length > 0 && newMeeting) {
            const participantInserts = participants.map((p: { user_id: string; role: string }) => ({
              meeting_id: newMeeting.id,
              user_id: p.user_id,
              role: p.role,
            }))

            const { error: participantsError } = await supabaseClient
              .from('meeting_participants')
              .insert(participantInserts)

            if (participantsError) {
              console.error(`Error copying participants for series ${series.id}:`, participantsError)
            }
          }
        }

        // Copy agenda items from latest instance if agenda is finalized
        if (latestInstance) {
          const { data: agendaItems } = await supabaseClient
            .from('meeting_agenda_items')
            .select('title, description, duration_minutes, sort_order')
            .eq('meeting_id', latestInstance.id)

          if (agendaItems && agendaItems.length > 0 && newMeeting) {
            const agendaInserts = agendaItems.map((item: { title: string; description: string; duration_minutes: number; sort_order: number }) => ({
              meeting_id: newMeeting.id,
              title: item.title,
              description: item.description,
              duration_minutes: item.duration_minutes,
              sort_order: item.sort_order,
            }))

            const { error: agendaError } = await supabaseClient
              .from('meeting_agenda_items')
              .insert(agendaInserts)

            if (agendaError) {
              console.error(`Error copying agenda items for series ${series.id}:`, agendaError)
            }
          }
        }

        instancesCreated++
        seriesProcessed++
        console.log(`Created recurring meeting instance for series ${series.id} on ${nextDateStart}`)
      }
    }

    // Strategy 2: Fetch standalone recurring meetings (not part of a series)
    if (!seriesId) {
      const { data: recurringMeetings, error: recurringError } = await supabaseClient
        .from('meetings')
        .select('*')
        .eq('is_recurring', true)
        .neq('recurrence_pattern', 'none')
        .is('series_id', null)

      if (recurringError) {
        console.error('Error fetching recurring meetings:', recurringError)
      }

      if (recurringMeetings && recurringMeetings.length > 0) {
        for (const parentMeeting of recurringMeetings) {
          const pattern = parentMeeting.recurrence_pattern
          if (!pattern || pattern === 'none') continue

          // Find the most recent child instance
          const { data: latestChild } = await supabaseClient
            .from('meetings')
            .select('id, start_time')
            .eq('parent_meeting_id', parentMeeting.id)
            .order('start_time', { ascending: false })
            .limit(1)
            .maybeSingle()

          const baseDate = latestChild?.start_time || parentMeeting.start_time || new Date().toISOString()
          const nextDate = calculateNextOccurrence(baseDate, pattern)

          if (!nextDate) continue

          // Check if an instance already exists for this date
          const nextDateStart = nextDate.split('T')[0]
          const { data: existing } = await supabaseClient
            .from('meetings')
            .select('id')
            .eq('parent_meeting_id', parentMeeting.id)
            .gte('start_time', `${nextDateStart}T00:00:00.000Z`)
            .lte('start_time', `${nextDateStart}T23:59:59.999Z`)
            .maybeSingle()

          if (existing) {
            console.log(`Instance already exists for parent meeting ${parentMeeting.id} on ${nextDateStart}`)
            seriesProcessed++
            continue
          }

          // Create new meeting instance
          const { data: newMeeting, error: createError } = await supabaseClient
            .from('meetings')
            .insert({
              title: parentMeeting.title,
              description: parentMeeting.description,
              start_time: nextDate,
              duration: parentMeeting.duration,
              parent_meeting_id: parentMeeting.id,
              created_by: parentMeeting.created_by,
              is_recurring: false,
              recurrence_pattern: 'none',
            })
            .select('id')
            .single()

          if (createError) {
            console.error(`Error creating meeting for parent ${parentMeeting.id}:`, createError)
            continue
          }

          // Copy participants from parent meeting
          const { data: participants } = await supabaseClient
            .from('meeting_participants')
            .select('user_id, role')
            .eq('meeting_id', parentMeeting.id)

          if (participants && participants.length > 0 && newMeeting) {
            const participantInserts = participants.map((p: { user_id: string; role: string }) => ({
              meeting_id: newMeeting.id,
              user_id: p.user_id,
              role: p.role,
            }))

            const { error: participantsError } = await supabaseClient
              .from('meeting_participants')
              .insert(participantInserts)

            if (participantsError) {
              console.error(`Error copying participants for parent ${parentMeeting.id}:`, participantsError)
            }
          }

          // Copy agenda items from parent meeting
          const { data: agendaItems } = await supabaseClient
            .from('meeting_agenda_items')
            .select('title, description, duration_minutes, sort_order')
            .eq('meeting_id', parentMeeting.id)

          if (agendaItems && agendaItems.length > 0 && newMeeting) {
            const agendaInserts = agendaItems.map((item: { title: string; description: string; duration_minutes: number; sort_order: number }) => ({
              meeting_id: newMeeting.id,
              title: item.title,
              description: item.description,
              duration_minutes: item.duration_minutes,
              sort_order: item.sort_order,
            }))

            const { error: agendaError } = await supabaseClient
              .from('meeting_agenda_items')
              .insert(agendaInserts)

            if (agendaError) {
              console.error(`Error copying agenda for parent ${parentMeeting.id}:`, agendaError)
            }
          }

          instancesCreated++
          seriesProcessed++
          console.log(`Created recurring instance for parent meeting ${parentMeeting.id} on ${nextDateStart}`)
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, instances_created: instancesCreated, series_processed: seriesProcessed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    console.error('Generate recurring meetings error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
