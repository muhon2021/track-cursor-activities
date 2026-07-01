/**
 * Create Meeting Review Tasks Edge Function
 *
 * Auto-creates review tasks after meeting completion by converting
 * action item takeaways into tasks in the tasks table.
 *
 * Input:  { meeting_id: string }
 * Output: { success: true, tasks_created: number }
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

    // Fetch meeting with participants
    const { data: meeting, error: meetingError } = await supabaseClient
      .from('meetings')
      .select('id, title, created_by')
      .eq('id', meeting_id)
      .single()

    if (meetingError || !meeting) {
      return new Response(
        JSON.stringify({ error: 'Meeting not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // Fetch meeting participants
    const { data: participants } = await supabaseClient
      .from('meeting_participants')
      .select('user_id, role')
      .eq('meeting_id', meeting_id)

    console.log(`Meeting "${meeting.title}" has ${participants?.length || 0} participants`)

    // Fetch action item takeaways for this meeting
    const { data: takeaways, error: takeawaysError } = await supabaseClient
      .from('meeting_takeaways')
      .select('id, content, assigned_to, due_date')
      .eq('meeting_id', meeting_id)
      .eq('takeaway_type', 'action_item')

    if (takeawaysError) {
      console.error('Error fetching takeaways:', takeawaysError)
      throw new Error('Failed to fetch meeting takeaways')
    }

    if (!takeaways || takeaways.length === 0) {
      return new Response(
        JSON.stringify({ success: true, tasks_created: 0, message: 'No action item takeaways found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    let tasksCreated = 0

    for (const takeaway of takeaways) {
      // Create a task for each action item takeaway
      const { data: task, error: taskError } = await supabaseClient
        .from('tasks')
        .insert({
          title: takeaway.content,
          description: `From meeting: ${meeting.title}`,
          assigned_to: takeaway.assigned_to,
          due_date: takeaway.due_date,
          status: 'pending',
          meeting_id: meeting.id,
        })
        .select('id')
        .single()

      if (taskError) {
        console.error(`Error creating task for takeaway ${takeaway.id}:`, taskError)
        continue
      }

      // Update the takeaway with the created task id
      if (task) {
        const { error: updateError } = await supabaseClient
          .from('meeting_takeaways')
          .update({ task_id: task.id })
          .eq('id', takeaway.id)

        if (updateError) {
          console.error(`Error updating takeaway ${takeaway.id} with task_id:`, updateError)
        }

        tasksCreated++
      }
    }

    console.log(`Created ${tasksCreated} tasks from meeting "${meeting.title}"`)

    return new Response(
      JSON.stringify({ success: true, tasks_created: tasksCreated }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    console.error('Create meeting review tasks error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
