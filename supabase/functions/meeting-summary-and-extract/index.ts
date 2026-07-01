/**
 * Meeting Summary and Extract Edge Function
 *
 * Performs combined summary generation and action item extraction in a
 * single AI call. Updates the meeting's ai_summary and inserts action
 * items into meeting_action_items.
 *
 * Input:  { meeting_id: string }
 * Output: { success: true, summary: { executive_summary, key_decisions, sentiment }, action_items: [{ text, assignee_hint, priority, confidence }] }
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
      .select('id, title, description')
      .eq('id', meeting_id)
      .single()

    if (meetingError || !meeting) {
      return new Response(
        JSON.stringify({ error: 'Meeting not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // Fetch transcript
    const { data: transcriptRow } = await supabaseClient
      .from('meeting_transcripts')
      .select('content')
      .eq('meeting_id', meeting_id)
      .maybeSingle()

    const transcript = transcriptRow?.content || ''

    if (!transcript) {
      return new Response(
        JSON.stringify({
          success: true,
          summary: null,
          action_items: [],
          message: 'No transcript found for this meeting',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Single AI call for both summary and action item extraction
    const result = await chatCompletion(supabaseClient, {
      messages: [
        {
          role: 'system',
          content: `You are an expert meeting analyst. Given a meeting transcript, produce BOTH a summary and a list of action items in a single response.

Respond with a JSON object in this exact format:
{
  "summary": {
    "executive_summary": "<2-4 sentence overview of the meeting>",
    "key_decisions": ["<decision 1>", "<decision 2>", ...],
    "sentiment": "<positive|neutral|negative|mixed>"
  },
  "action_items": [
    {
      "text": "<clear, actionable task description>",
      "assignee_hint": "<person's name or null if unclear>",
      "priority": "<low|medium|high>",
      "confidence": <0.0 to 1.0>
    }
  ]
}

Guidelines:
- The executive_summary should capture the main purpose, outcomes, and tone of the meeting
- key_decisions should list concrete decisions that were made
- For action_items, only include genuine tasks someone needs to DO
- Set confidence based on how clearly the action item was stated
- Set priority based on urgency and importance discussed`
        },
        {
          role: 'user',
          content: `Meeting: ${meeting.title}\n${meeting.description ? `Description: ${meeting.description}\n` : ''}\nTranscript:\n${transcript.slice(0, 12000)}`
        }
      ],
      temperature: 0.3,
      max_tokens: 3000,
    })

    // Parse AI response
    let summary = {
      executive_summary: '',
      key_decisions: [] as string[],
      sentiment: 'neutral',
    }
    let actionItems: Array<{
      text: string
      assignee_hint: string | null
      priority: string
      confidence: number
    }> = []

    try {
      const parsed = JSON.parse(result.content)
      summary = {
        executive_summary: parsed.summary?.executive_summary || '',
        key_decisions: parsed.summary?.key_decisions || [],
        sentiment: parsed.summary?.sentiment || 'neutral',
      }
      actionItems = parsed.action_items || []
    } catch {
      console.warn('[meeting-summary-and-extract] Failed to parse AI response, attempting extraction')
      const jsonMatch = result.content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        summary = {
          executive_summary: parsed.summary?.executive_summary || '',
          key_decisions: parsed.summary?.key_decisions || [],
          sentiment: parsed.summary?.sentiment || 'neutral',
        }
        actionItems = parsed.action_items || []
      }
    }

    // Update meeting with executive summary
    if (summary.executive_summary) {
      const { error: updateError } = await supabaseClient
        .from('meetings')
        .update({ ai_summary: summary.executive_summary })
        .eq('id', meeting_id)

      if (updateError) {
        console.error('[meeting-summary-and-extract] Failed to update ai_summary:', updateError)
      }
    }

    // Insert action items into meeting_action_items
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
        console.error('[meeting-summary-and-extract] Error inserting action item:', insertError)
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
      'meeting-summary-and-extract',
      result.input_tokens || 0,
      result.output_tokens || 0,
      0,
      0
    )

    return new Response(
      JSON.stringify({
        success: true,
        summary,
        action_items: insertedItems,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    console.error('Meeting summary and extract error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
