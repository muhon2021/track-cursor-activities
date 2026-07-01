/**
 * Extract Meeting Issues Edge Function
 *
 * Uses AI to extract EOS-style issues from meeting transcripts.
 * Returns structured issues with title, description, category,
 * priority, and confidence scores.
 *
 * Called by: useExtractMeetingIssues hook
 * Input:  { meeting_id, transcript?, pod_id? }
 * Output: { issues: ExtractedIssue[] }
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

    const { meeting_id, transcript: providedTranscript, pod_id } = await req.json()

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
        JSON.stringify({ issues: [], message: 'No transcript content found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Extract issues via AI
    const result = await chatCompletion(supabaseClient, {
      messages: [
        {
          role: 'system',
          content: `You are an AI assistant that identifies business issues from meeting transcripts using the EOS (Entrepreneurial Operating System) IDS framework.

For each issue found, provide:
- title: A concise issue title (max 100 chars)
- description: Detailed description of the issue
- category: One of "people", "process", "technology", "strategy", "customer", "financial", "other"
- priority: One of "critical", "high", "medium", "low"
- confidence: How confident you are this is a genuine issue (0.0 to 1.0)

Focus on problems, blockers, risks, and pain points mentioned in the discussion. Skip positive updates and resolved items.

Respond with a JSON object: { "issues": [...] }`
        },
        {
          role: 'user',
          content: `Extract all business issues from this meeting transcript:\n\n${transcript.slice(0, 12000)}`
        }
      ],
      temperature: 0.3,
      max_tokens: 2000,
    })

    let issues = []
    try {
      const parsed = JSON.parse(result.content)
      issues = parsed.issues || parsed || []
    } catch {
      console.warn('Failed to parse AI response as JSON, returning empty issues')
      issues = []
    }

    // Attach pod_id if provided
    if (pod_id) {
      issues = issues.map((issue: Record<string, unknown>) => ({
        ...issue,
        pod_id,
      }))
    }

    // Log AI usage
    await logUsage(
      supabaseClient,
      null,
      null,
      'extract-meeting-issues',
      result.input_tokens || 0,
      result.output_tokens || 0,
      0,
      0
    )

    return new Response(
      JSON.stringify({ issues }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    console.error('Extract meeting issues error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
