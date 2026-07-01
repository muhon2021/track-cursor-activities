/**
 * Discover Meeting Relationships Edge Function
 *
 * Uses AI to discover relationships between a meeting and existing
 * clients, projects, and pods. Produces confidence-scored suggestions
 * and auto-assigns high-confidence matches.
 *
 * Input:  { meeting_id: string }
 * Output: { success: true, suggestions: number, auto_assigned: number, pending_review: number }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { chatCompletion, logUsage } from '../_shared/ai-provider-routing.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CONFIDENCE_HIGH = 0.80
const CONFIDENCE_MEDIUM = 0.50

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

    // Fetch meeting with content fields
    const { data: meeting, error: meetingError } = await supabaseClient
      .from('meetings')
      .select('id, title, description, ai_summary, transcript_content')
      .eq('id', meeting_id)
      .single()

    if (meetingError || !meeting) {
      return new Response(
        JSON.stringify({ error: 'Meeting not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // Build meeting content string for AI analysis
    const meetingContent = [
      meeting.title ? `Title: ${meeting.title}` : '',
      meeting.description ? `Description: ${meeting.description}` : '',
      meeting.ai_summary ? `AI Summary: ${meeting.ai_summary}` : '',
      meeting.transcript_content ? `Transcript: ${String(meeting.transcript_content).slice(0, 8000)}` : '',
    ].filter(Boolean).join('\n\n')

    if (!meetingContent.trim()) {
      return new Response(
        JSON.stringify({ error: 'Meeting has no content to analyze' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Fetch all clients
    const { data: clients } = await supabaseClient
      .from('clients')
      .select('id, name, email')

    // Fetch all projects
    const { data: projects } = await supabaseClient
      .from('projects')
      .select('id, name, client_id')

    // Fetch pods — gracefully handle if table does not exist
    let pods: { id: string; name: string }[] = []
    try {
      const { data: podsData, error: podsError } = await supabaseClient
        .from('pods')
        .select('id, name')

      if (!podsError && podsData) {
        pods = podsData
      }
    } catch {
      console.log('[discover-meeting-relationships] pods table not available, skipping')
    }

    // Build entity context for the AI prompt
    const clientsList = (clients || []).map(c => `- Client: "${c.name}" (id: ${c.id}, email: ${c.email || 'N/A'})`).join('\n')
    const projectsList = (projects || []).map(p => `- Project: "${p.name}" (id: ${p.id}, client_id: ${p.client_id || 'N/A'})`).join('\n')
    const podsList = pods.map(p => `- Pod: "${p.name}" (id: ${p.id})`).join('\n')

    const entityContext = [
      clientsList ? `Clients:\n${clientsList}` : 'Clients: none',
      projectsList ? `Projects:\n${projectsList}` : 'Projects: none',
      podsList ? `Pods:\n${podsList}` : 'Pods: none',
    ].join('\n\n')

    // Call AI to discover relationships
    const result = await chatCompletion(supabaseClient, {
      messages: [
        {
          role: 'system',
          content: `You are a meeting relationship discovery assistant. Given meeting content and a list of existing entities (clients, projects, pods), identify which entities are related to the meeting.

For each match, provide:
- entity_type: "client", "project", or "pod"
- entity_id: the UUID of the matched entity
- entity_name: the name of the matched entity
- confidence: a score from 0.0 to 1.0 indicating match strength
- reasoning: a brief explanation of why this entity is related

Only include entities you are confident are related. Do not fabricate entity IDs — only use IDs from the provided lists.

Respond with a JSON object: { "matches": [...] }`
        },
        {
          role: 'user',
          content: `Meeting Content:\n${meetingContent}\n\nAvailable Entities:\n${entityContext}`
        }
      ],
      temperature: 0.3,
      max_tokens: 2000,
    })

    // Parse AI response
    let matches: {
      entity_type: string
      entity_id: string
      entity_name: string
      confidence: number
      reasoning: string
    }[] = []

    try {
      const parsed = JSON.parse(result.content)
      matches = parsed.matches || []
    } catch {
      console.warn('[discover-meeting-relationships] Failed to parse AI response as JSON')
      matches = []
    }

    // Validate entity IDs against known entities
    const validEntityIds = new Set([
      ...(clients || []).map(c => c.id),
      ...(projects || []).map(p => p.id),
      ...pods.map(p => p.id),
    ])

    matches = matches.filter(m => validEntityIds.has(m.entity_id))

    let autoAssigned = 0
    let pendingReview = 0

    for (const match of matches) {
      const reviewStatus = match.confidence >= CONFIDENCE_HIGH ? 'approved' : 'pending'

      // Insert suggestion
      const { error: suggestError } = await supabaseClient
        .from('meeting_assignment_suggestions')
        .insert({
          meeting_id,
          suggested_type: match.entity_type,
          suggested_id: match.entity_id,
          confidence: match.confidence,
          reasoning: match.reasoning,
          review_status: reviewStatus,
        })

      if (suggestError) {
        console.error('[discover-meeting-relationships] Failed to insert suggestion:', suggestError)
        continue
      }

      // Auto-assign high-confidence matches
      if (match.confidence >= CONFIDENCE_HIGH) {
        const { error: assignError } = await supabaseClient
          .from('meeting_assignments')
          .insert({
            meeting_id,
            entity_type: match.entity_type,
            entity_id: match.entity_id,
          })

        if (assignError) {
          console.error('[discover-meeting-relationships] Failed to auto-assign:', assignError)
        } else {
          autoAssigned++
        }
      } else {
        pendingReview++
      }
    }

    // Log AI usage
    await logUsage(
      supabaseClient,
      null,
      null,
      'discover-meeting-relationships',
      result.input_tokens || 0,
      result.output_tokens || 0,
      0,
      0
    )

    return new Response(
      JSON.stringify({
        success: true,
        suggestions: matches.length,
        auto_assigned: autoAssigned,
        pending_review: pendingReview,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    console.error('Discover meeting relationships error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
