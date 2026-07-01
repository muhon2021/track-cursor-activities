/**
 * Match Meeting to Project Edge Function
 *
 * Uses AI to determine the best project match for a meeting based on
 * meeting content, participants, and available projects. If confidence
 * is >= 0.80, automatically links the meeting to the project.
 *
 * Input:  { meeting_id: string }
 * Output: { matched_project_id, matched_project_name, confidence, reasoning }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { chatCompletion, logUsage } from '../_shared/ai-provider-routing.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CONFIDENCE_THRESHOLD = 0.80

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

    // Fetch meeting with content
    const { data: meeting, error: meetingError } = await supabaseClient
      .from('meetings')
      .select('id, title, description, ai_summary')
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
      .select('user_id, email, name, role')
      .eq('meeting_id', meeting_id)

    // Fetch external participants if available
    let externalParticipants: { external_email: string; external_name: string | null }[] = []
    try {
      const { data: extParts, error: extError } = await supabaseClient
        .from('meeting_external_participants')
        .select('external_email, external_name')
        .eq('meeting_id', meeting_id)

      if (!extError && extParts) {
        externalParticipants = extParts
      }
    } catch {
      console.log('[match-meeting-to-project] meeting_external_participants not available')
    }

    // Fetch all projects with their client info
    const { data: projects } = await supabaseClient
      .from('projects')
      .select('id, name, description, client_id, clients(name)')

    if (!projects || projects.length === 0) {
      return new Response(
        JSON.stringify({
          matched_project_id: null,
          matched_project_name: null,
          confidence: 0,
          reasoning: 'No projects exist in the system',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Build meeting context
    const meetingContent = [
      meeting.title ? `Title: ${meeting.title}` : '',
      meeting.description ? `Description: ${meeting.description}` : '',
      meeting.ai_summary ? `AI Summary: ${meeting.ai_summary}` : '',
    ].filter(Boolean).join('\n')

    const participantInfo = [
      ...(participants || []).filter((p: { name: string | null }) => p.name).map((p: { name: string }) => p.name),
      ...(participants || []).filter((p: { email: string | null }) => p.email).map((p: { email: string }) => p.email),
      ...externalParticipants.filter(p => p.external_name).map(p => p.external_name),
      ...externalParticipants.map(p => p.external_email),
    ].filter(Boolean)

    // Build project list context
    const projectsList = projects.map((p: any) => {
      const clients = p.clients
      const client = Array.isArray(clients) ? clients[0] : clients
      const clientName = client?.name || 'N/A'
      return `- Project: "${p.name}" (id: ${p.id}, client: ${clientName})${p.description ? `\n  Description: ${p.description.slice(0, 200)}` : ''}`
    }).join('\n')

    // Call AI to match
    const result = await chatCompletion(supabaseClient, {
      messages: [
        {
          role: 'system',
          content: `You are a meeting-to-project matching assistant. Given meeting details and a list of projects, determine which project this meeting most likely relates to.

Consider these signals:
1. Project name or keywords mentioned in meeting title/description/summary
2. Client name matching the project's client
3. Participant names or emails associated with the project's client
4. Subject matter overlap between meeting content and project description

Respond with a JSON object:
{
  "matched_project_id": "<UUID or null if no match>",
  "matched_project_name": "<project name or null>",
  "confidence": <0.0-1.0>,
  "reasoning": "<brief explanation of why this project was matched>"
}

Only use project IDs from the provided list. If no project matches well, set matched_project_id to null with confidence 0.`
        },
        {
          role: 'user',
          content: `Meeting Content:
${meetingContent}

Participants: ${participantInfo.length > 0 ? participantInfo.join(', ') : 'N/A'}

Available Projects:
${projectsList}`
        }
      ],
      temperature: 0.2,
      max_tokens: 1000,
    })

    // Parse AI response
    let matchResult = {
      matched_project_id: null as string | null,
      matched_project_name: null as string | null,
      confidence: 0,
      reasoning: 'Failed to parse AI response',
    }

    try {
      const parsed = JSON.parse(result.content)
      matchResult = {
        matched_project_id: parsed.matched_project_id || null,
        matched_project_name: parsed.matched_project_name || null,
        confidence: parsed.confidence || 0,
        reasoning: parsed.reasoning || '',
      }
    } catch {
      console.warn('[match-meeting-to-project] Failed to parse AI response as JSON')
    }

    // Validate matched_project_id exists in our projects list
    if (matchResult.matched_project_id) {
      const validProject = projects.find((p: { id: string }) => p.id === matchResult.matched_project_id)
      if (!validProject) {
        console.warn('[match-meeting-to-project] AI returned invalid project_id, discarding')
        matchResult.matched_project_id = null
        matchResult.matched_project_name = null
        matchResult.confidence = 0
        matchResult.reasoning = 'AI returned an invalid project ID'
      }
    }

    // If high confidence, auto-update meeting with project_id and insert meeting_assignment
    if (matchResult.matched_project_id && matchResult.confidence >= CONFIDENCE_THRESHOLD) {
      // Update meeting with project_id
      const { error: updateError } = await supabaseClient
        .from('meetings')
        .update({ project_id: matchResult.matched_project_id })
        .eq('id', meeting_id)

      if (updateError) {
        console.error('[match-meeting-to-project] Failed to update meeting project_id:', updateError)
      }

      // Insert meeting assignment record
      const { error: assignError } = await supabaseClient
        .from('meeting_assignments')
        .upsert(
          {
            meeting_id,
            project_id: matchResult.matched_project_id,
            assigned_by: 'ai-match',
            confidence: matchResult.confidence,
          },
          { onConflict: 'meeting_id,project_id' }
        )

      if (assignError) {
        console.error('[match-meeting-to-project] Failed to insert meeting_assignment:', assignError)
      }
    }

    // Log AI usage
    await logUsage(
      supabaseClient,
      null,
      null,
      'match-meeting-to-project',
      result.input_tokens || 0,
      result.output_tokens || 0,
      0,
      0
    )

    return new Response(
      JSON.stringify(matchResult),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    console.error('Match meeting to project error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
