/**
 * Parse Meeting Action Items Edge Function
 *
 * Extracts action items from meeting transcripts using AI and
 * inserts them into the meeting_action_items table.
 *
 * Input:  { meeting_id: string, transcript?: string }
 * Output: { success: true, action_items: object[], count: number }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { chatCompletion, logUsage } from '../_shared/ai-provider-routing.ts'

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

    const { meeting_id, transcript: providedTranscript } = await req.json()

    if (!meeting_id) {
      return new Response(
        JSON.stringify({ error: 'meeting_id is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Resolve transcript content
    let transcript = providedTranscript || ''

    if (!transcript) {
      // Try meeting_transcripts table first
      const { data: transcriptRow } = await supabaseClient
        .from('meeting_transcripts')
        .select('content')
        .eq('meeting_id', meeting_id)
        .maybeSingle()

      transcript = transcriptRow?.content || ''
    }

    if (!transcript) {
      // Fallback to meetings.transcript_content or description
      const { data: meeting } = await supabaseClient
        .from('meetings')
        .select('description')
        .eq('id', meeting_id)
        .single()

      transcript = meeting?.description || ''
    }

    if (!transcript) {
      return new Response(
        JSON.stringify({ success: true, action_items: [], count: 0, message: 'No transcript content found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Extract action items via AI
    const result = await chatCompletion(supabaseClient, {
      messages: [
        {
          role: 'system',
          content: `You are an AI assistant that extracts action items from meeting transcripts.

For each action item, provide:
- text: A clear, actionable task description
- assignee_hint: The person's name or email mentioned as responsible (null if unclear)
- due_date_hint: Any mentioned deadline in ISO format YYYY-MM-DD (null if not mentioned)
- priority: "low", "medium", or "high" based on urgency and importance discussed
- confidence: How confident you are this is a real action item (0.0 to 1.0)

Only extract genuine action items — things someone needs to DO. Skip discussion points, decisions, or status updates unless they include a clear next step.

Respond with a JSON object: { "action_items": [...] }`
        },
        {
          role: 'user',
          content: `Extract all action items from this meeting transcript:\n\n${transcript.slice(0, 12000)}`
        }
      ],
      temperature: 0.3,
      max_tokens: 2000,
    })

    // Parse AI response
    let actionItems: Array<{
      text: string
      assignee_hint: string | null
      due_date_hint: string | null
      priority: string
      confidence: number
    }> = []

    try {
      const parsed = JSON.parse(result.content)
      actionItems = parsed.action_items || parsed || []
    } catch {
      console.warn('Failed to parse AI response as JSON, attempting to extract JSON')
      const jsonMatch = result.content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        actionItems = parsed.action_items || []
      }
    }

    // Insert action items into meeting_action_items table
    const insertedItems = []
    for (const item of actionItems) {
      const { data: inserted, error: insertError } = await supabaseClient
        .from('meeting_action_items')
        .insert({
          meeting_id,
          text: item.text,
          assignee_email: item.assignee_hint,
          priority: item.priority || 'medium',
          extraction_confidence: item.confidence || 0.5,
          extracted_from_transcript: true,
          status: 'pending',
        })
        .select()
        .single()

      if (insertError) {
        console.error(`Error inserting action item:`, insertError)
        // Still include the item in the response even if DB insert fails
        insertedItems.push({
          ...item,
          db_error: insertError.message,
        })
      } else {
        insertedItems.push(inserted)
      }
    }

    // Log AI usage
    await logUsage(
      supabaseClient,
      null,
      null,
      'parse-meeting-action-items',
      result.input_tokens || 0,
      result.output_tokens || 0,
      0,
      0
    )

    return new Response(
      JSON.stringify({ success: true, action_items: insertedItems, count: insertedItems.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    console.error('Parse meeting action items error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
