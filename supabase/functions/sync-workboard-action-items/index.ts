/**
 * Sync Workboard Action Items Edge Function
 *
 * Syncs meeting action items to Workboard as tasks for a given meeting.
 *
 * Input:  { meeting_id: string }
 * Output: { success: true, synced: number } or { skipped: true, reason: string }
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

    // Check if Workboard is configured
    const wbApiKey = Deno.env.get('WORKBOARD_API_KEY')
    const wbBaseUrl = Deno.env.get('WORKBOARD_BASE_URL') || 'https://api.workboard.com'

    if (!wbApiKey) {
      return new Response(
        JSON.stringify({ skipped: true, reason: 'Workboard not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    const { meeting_id } = await req.json()

    if (!meeting_id) {
      return new Response(
        JSON.stringify({ error: 'meeting_id is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Fetch meeting details for context
    const { data: meeting, error: meetingError } = await supabaseClient
      .from('meetings')
      .select('id, title')
      .eq('id', meeting_id)
      .single()

    if (meetingError || !meeting) {
      return new Response(
        JSON.stringify({ error: 'Meeting not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // Fetch meeting action items
    const { data: actionItems, error: fetchError } = await supabaseClient
      .from('meeting_action_items')
      .select('id, text, assignee_email, priority, status, task_id')
      .eq('meeting_id', meeting_id)

    if (fetchError) {
      throw new Error(`Failed to fetch action items: ${fetchError.message}`)
    }

    if (!actionItems || actionItems.length === 0) {
      return new Response(
        JSON.stringify({ success: true, synced: 0, message: 'No action items found for this meeting' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    let synced = 0

    for (const item of actionItems) {
      // Skip items already synced (have a task_id reference starting with 'wb-')
      if (item.task_id && item.task_id.startsWith('wb-')) {
        console.log(`[sync-workboard-action-items] Skipping already synced item: ${item.id}`)
        continue
      }

      try {
        // Map priority to Workboard format
        const priorityMap: Record<string, string> = {
          low: 'low',
          medium: 'medium',
          high: 'high',
        }

        // POST to Workboard API to create a task
        const wbResponse = await fetch(`${wbBaseUrl}/v1/tasks`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${wbApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: item.text,
            description: `Action item from meeting: ${meeting.title} (Meeting ID: ${meeting_id})`,
            priority: priorityMap[item.priority] || 'medium',
            assignee_email: item.assignee_email || undefined,
            source: 'meeting-action-item',
            source_id: item.id,
          }),
        })

        if (!wbResponse.ok) {
          const errorText = await wbResponse.text()
          console.error(`[sync-workboard-action-items] Workboard API error for item ${item.id}:`, errorText)
          continue
        }

        const wbTask = await wbResponse.json()

        // Update meeting_action_items with external task reference
        const externalRef = `wb-${wbTask.id || wbTask.task_id}`
        const { error: updateError } = await supabaseClient
          .from('meeting_action_items')
          .update({ task_id: externalRef })
          .eq('id', item.id)

        if (updateError) {
          console.error(`[sync-workboard-action-items] Failed to update task_id for item ${item.id}:`, updateError)
        }

        synced++
      } catch (syncError) {
        console.error(`[sync-workboard-action-items] Error syncing item ${item.id}:`, syncError)
      }
    }

    return new Response(
      JSON.stringify({ success: true, synced }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    console.error('Sync Workboard action items error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
