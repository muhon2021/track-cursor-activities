/**
 * Sync Action Item to ActiveCollab Edge Function
 *
 * Syncs meeting action items to ActiveCollab as tasks. Supports
 * syncing a single action item or all action items from a meeting.
 *
 * Input:  { action_item_id: string } or { meeting_id: string }
 * Output: { success: true, synced: number, skipped: number } or { skipped: true, reason: string }
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

    // Check if ActiveCollab is configured
    const acApiKey = Deno.env.get('ACTIVECOLLAB_API_KEY')
    const acBaseUrl = Deno.env.get('ACTIVECOLLAB_BASE_URL')

    if (!acApiKey) {
      return new Response(
        JSON.stringify({ skipped: true, reason: 'ActiveCollab not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    const { action_item_id, meeting_id } = await req.json()

    if (!action_item_id && !meeting_id) {
      return new Response(
        JSON.stringify({ error: 'Either action_item_id or meeting_id is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Fetch action item(s)
    let actionItemsQuery = supabaseClient
      .from('meeting_action_items')
      .select('id, meeting_id, text, assignee_email, priority, status, task_id')

    if (action_item_id) {
      actionItemsQuery = actionItemsQuery.eq('id', action_item_id)
    } else if (meeting_id) {
      actionItemsQuery = actionItemsQuery.eq('meeting_id', meeting_id)
    }

    const { data: actionItems, error: fetchError } = await actionItemsQuery

    if (fetchError) {
      throw new Error(`Failed to fetch action items: ${fetchError.message}`)
    }

    if (!actionItems || actionItems.length === 0) {
      return new Response(
        JSON.stringify({ success: true, synced: 0, skipped: 0, message: 'No action items found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    let synced = 0
    let skipped = 0

    for (const item of actionItems) {
      // Skip items already synced to ActiveCollab
      if (item.task_id) {
        console.log(`[sync-action-item-to-ac] Skipping already synced item: ${item.id}`)
        skipped++
        continue
      }

      try {
        // Map priority
        const priorityMap: Record<string, number> = {
          low: 0,
          medium: 1,
          high: 2,
        }

        // POST to ActiveCollab API to create a task
        const acResponse = await fetch(
          `${acBaseUrl || 'https://app.activecollab.com'}/api/v1/projects/tasks`,
          {
            method: 'POST',
            headers: {
              'X-Angie-AuthApiToken': acApiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: item.text,
              body: `<p>Synced from meeting action item. Meeting ID: ${item.meeting_id}</p>`,
              priority: priorityMap[item.priority] ?? 1,
              assignee_email: item.assignee_email || undefined,
            }),
          }
        )

        if (!acResponse.ok) {
          const errorText = await acResponse.text()
          console.error(`[sync-action-item-to-ac] ActiveCollab API error for item ${item.id}:`, errorText)
          skipped++
          continue
        }

        const acTask = await acResponse.json()

        // Update meeting_action_items with external task reference
        const externalRef = `ac-${acTask.id || acTask.task_id}`
        const { error: updateError } = await supabaseClient
          .from('meeting_action_items')
          .update({ task_id: externalRef })
          .eq('id', item.id)

        if (updateError) {
          console.error(`[sync-action-item-to-ac] Failed to update task_id for item ${item.id}:`, updateError)
        }

        synced++
      } catch (syncError) {
        console.error(`[sync-action-item-to-ac] Error syncing item ${item.id}:`, syncError)
        skipped++
      }
    }

    return new Response(
      JSON.stringify({ success: true, synced, skipped }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    console.error('Sync action item to ActiveCollab error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
