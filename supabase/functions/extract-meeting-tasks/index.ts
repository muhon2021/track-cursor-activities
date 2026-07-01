/**
 * Extract Meeting Tasks Edge Function
 *
 * Uses AI to extract action items from meeting transcripts.
 * Returns structured tasks with content, assignee hints, due date hints,
 * and confidence scores.
 *
 * Called by: useExtractMeetingTasks hook
 * Input:  { meeting_id, transcript? }
 * Output: { tasks: ExtractedTask[] }
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

    if (!meeting_id && !providedTranscript) {
      return new Response(
        JSON.stringify({ error: 'meeting_id or transcript is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Resolve transcript content
    let transcript = providedTranscript || ''
    if (!transcript && meeting_id) {
      const { data: transcriptRow } = await supabaseClient
        .from('meeting_transcripts')
        .select('content')
        .eq('meeting_id', meeting_id)
        .maybeSingle()

      transcript = transcriptRow?.content || ''

      if (!transcript) {
        const { data: meeting } = await supabaseClient
          .from('meetings')
          .select('description')
          .eq('id', meeting_id)
          .single()

        transcript = meeting?.description || ''
      }
    }

    if (!transcript) {
      return new Response(
        JSON.stringify({ tasks: [], message: 'No transcript content found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Extract tasks via AI
    const result = await chatCompletion(supabaseClient, {
      messages: [
        {
          role: 'system',
          content: `You are an AI assistant that extracts action items from meeting transcripts.
For each action item, identify:
- content: A clear, actionable task description
- assignee_hint: The person's name mentioned as responsible (null if unclear)
- due_date_hint: Any mentioned deadline in ISO format YYYY-MM-DD (null if not mentioned)
- confidence: How confident you are this is a real action item (0.0 to 1.0)

Only extract genuine action items — things someone needs to DO. Skip discussion points, decisions, or status updates unless they include a clear next step.

Respond with a JSON object: { "tasks": [...] }`
        },
        {
          role: 'user',
          content: `Extract all action items from this meeting transcript:\n\n${transcript.slice(0, 12000)}`
        }
      ],
      temperature: 0.3,
      max_tokens: 2000,
    })

    let tasks = []
    try {
      const parsed = JSON.parse(result.content)
      tasks = parsed.tasks || parsed || []
    } catch {
      console.warn('Failed to parse AI response as JSON, returning empty tasks')
      tasks = []
    }

    // Log AI usage
    await logUsage(
      supabaseClient,
      null,
      null,
      'extract-meeting-tasks',
      result.input_tokens || 0,
      result.output_tokens || 0,
      0,
      0
    )

    return new Response(
      JSON.stringify({ tasks }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    console.error('Extract meeting tasks error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
