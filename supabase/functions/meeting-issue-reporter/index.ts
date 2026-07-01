/**
 * Meeting Issue Reporter Edge Function
 *
 * Analyzes meeting transcripts using AI to identify issues, risks,
 * blockers, and concerns discussed during the meeting.
 *
 * Input:  { meeting_id: string }
 * Output: { success: true, issues: [{ title, description, severity, category, mentioned_by_hint }], count: number }
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
        JSON.stringify({ success: true, issues: [], count: 0, message: 'No transcript found for this meeting' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Use AI to identify issues from the transcript
    const result = await chatCompletion(supabaseClient, {
      messages: [
        {
          role: 'system',
          content: `You are an expert meeting analyst. Identify issues, risks, blockers, and concerns mentioned in the meeting transcript.

For each issue found, provide:
- title: A concise title for the issue
- description: A detailed description of the issue as discussed
- severity: One of "low", "medium", "high", or "critical"
- category: One of "risk", "blocker", "concern", or "action_needed"
- mentioned_by_hint: The name or identifier of who mentioned this issue (null if unclear)

Only include genuine issues, risks, blockers, or concerns. Do not include positive updates, completed items, or general discussion points.

Respond with a JSON object: { "issues": [...] }`
        },
        {
          role: 'user',
          content: `Meeting: ${meeting.title}\n\nTranscript:\n${transcript.slice(0, 12000)}`
        }
      ],
      temperature: 0.3,
      max_tokens: 2000,
    })

    // Parse AI response
    let issues: Array<{
      title: string
      description: string
      severity: string
      category: string
      mentioned_by_hint: string | null
    }> = []

    try {
      const parsed = JSON.parse(result.content)
      issues = parsed.issues || []
    } catch {
      console.warn('[meeting-issue-reporter] Failed to parse AI response as JSON, attempting extraction')
      const jsonMatch = result.content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        issues = parsed.issues || []
      }
    }

    // Validate severity and category values
    const validSeverities = ['low', 'medium', 'high', 'critical']
    const validCategories = ['risk', 'blocker', 'concern', 'action_needed']

    issues = issues.map(issue => ({
      ...issue,
      severity: validSeverities.includes(issue.severity) ? issue.severity : 'medium',
      category: validCategories.includes(issue.category) ? issue.category : 'concern',
    }))

    // Log AI usage
    await logUsage(
      supabaseClient,
      null,
      null,
      'meeting-issue-reporter',
      result.input_tokens || 0,
      result.output_tokens || 0,
      0,
      0
    )

    return new Response(
      JSON.stringify({ success: true, issues, count: issues.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    console.error('Meeting issue reporter error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
