/**
 * Generate Meeting Summary V2 Edge Function
 *
 * Improved meeting summary generation with structured output.
 * Uses the shared AI provider routing for multi-provider support.
 *
 * Input:  { meeting_id: string, force?: boolean }
 * Output: { executive_summary, key_decisions[], action_items[], follow_up_topics[], participants_mentioned[], sentiment, meeting_effectiveness_score, issues[], risks[], blockers[] }
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

    const { meeting_id, force } = await req.json()

    if (!meeting_id) {
      return new Response(
        JSON.stringify({ error: 'meeting_id is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Fetch meeting
    const { data: meeting, error: meetingError } = await supabaseClient
      .from('meetings')
      .select('id, title, ai_summary, summary, start_time, description')
      .eq('id', meeting_id)
      .single()

    if (meetingError || !meeting) {
      return new Response(
        JSON.stringify({ error: 'Meeting not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // Check if ai_summary already exists (skip unless force=true)
    if (meeting.ai_summary && !force) {
      return new Response(
        JSON.stringify({
          message: 'Summary already exists. Use force=true to regenerate.',
          executive_summary: meeting.ai_summary,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Fetch transcript from meeting_transcripts
    let transcriptContent = ''
    const { data: transcriptRow } = await supabaseClient
      .from('meeting_transcripts')
      .select('content')
      .eq('meeting_id', meeting_id)
      .maybeSingle()

    transcriptContent = transcriptRow?.content || ''

    // If no transcript, try meeting_files for transcript_text
    if (!transcriptContent) {
      const { data: files } = await supabaseClient
        .from('zoom_files')
        .select('transcript_text')
        .eq('meeting_id', meeting_id)
        .not('transcript_text', 'is', null)
        .limit(1)
        .maybeSingle()

      transcriptContent = files?.transcript_text || ''
    }

    // If still no content, return error
    if (!transcriptContent) {
      return new Response(
        JSON.stringify({ error: 'No transcript content found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Generate structured meeting intelligence via AI
    const result = await chatCompletion(supabaseClient, {
      messages: [
        {
          role: 'system',
          content: `You are a meeting intelligence analyst. Produce structured output from the transcript. Your response must be valid JSON with the following structure:

{
  "executive_summary": "A concise 2-4 sentence summary of the meeting",
  "key_decisions": ["Decision 1", "Decision 2"],
  "action_items": [{"task": "description", "assignee": "person or null", "deadline": "date or null"}],
  "follow_up_topics": ["Topic 1", "Topic 2"],
  "participants_mentioned": ["Name 1", "Name 2"],
  "sentiment": "positive" | "neutral" | "negative" | "mixed",
  "meeting_effectiveness_score": 1-10,
  "issues": [{"title":"string","severity":"low|medium|high|critical","evidence":"string"}],
  "risks": [{"title":"string","impact":"low|medium|high","evidence":"string"}],
  "blockers": [{"title":"string","owner":"string|null","evidence":"string"}]
}

Be thorough but concise. Extract all key decisions, action items, follow-up topics, and risk signals. Rate effectiveness based on clarity of outcomes, participation, and actionability.`
        },
        {
          role: 'user',
          content: `Analyze this meeting transcript and produce a structured summary:\n\n${transcriptContent.slice(0, 12000)}`
        }
      ],
      temperature: 0.3,
      max_tokens: 3000,
    })

    // Parse the structured response
    let summary
    try {
      summary = JSON.parse(result.content)
    } catch {
      console.warn('Failed to parse AI response as JSON, attempting to extract JSON')
      // Try to extract JSON from the response
      const jsonMatch = result.content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        summary = JSON.parse(jsonMatch[0])
      } else {
        summary = {
          executive_summary: result.content,
          key_decisions: [],
          action_items: [],
          follow_up_topics: [],
          participants_mentioned: [],
          sentiment: 'neutral',
          meeting_effectiveness_score: 5,
          issues: [],
          risks: [],
          blockers: [],
        }
      }
    }

    // Update meetings table with the summary
    const { error: updateError } = await supabaseClient
      .from('meetings')
      .update({
        ai_summary: summary.executive_summary,
        summary: JSON.stringify(summary),
      })
      .eq('id', meeting_id)

    if (updateError) {
      console.error('Error updating meeting summary:', updateError)
    }

    // Log AI usage
    await logUsage(
      supabaseClient,
      null,
      null,
      'generate-meeting-summary-v2',
      result.input_tokens || 0,
      result.output_tokens || 0,
      0,
      0
    )

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    console.error('Generate meeting summary v2 error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
