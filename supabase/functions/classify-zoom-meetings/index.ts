/**
 * Classify Zoom Meetings Edge Function
 *
 * Classifies meeting types from Zoom recording data using AI analysis
 * of transcript content. Updates meeting_files with assignment status,
 * confidence, suggested client, and reasoning.
 *
 * Input:  { file_ids?: string[] } (optional — if not provided, processes all unclassified)
 * Output: { success: true, classified: number, auto_assigned: number, pending_review: number }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { chatCompletion, logUsage } from '../_shared/ai-provider-routing.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CONFIDENCE_HIGH = 0.80

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { file_ids } = await req.json()

    // Fetch meeting_files — either specific IDs or all unreviewed
    let query = supabaseClient
      .from('meeting_files')
      .select('id, meeting_id, file_name, file_type, transcript_text, metadata, external_meeting_id')

    if (file_ids && Array.isArray(file_ids) && file_ids.length > 0) {
      query = query.in('id', file_ids)
    } else {
      query = query.eq('assignment_status', 'unreviewed')
    }

    const { data: files, error: filesError } = await query

    if (filesError) {
      throw new Error(`Failed to fetch meeting files: ${filesError.message}`)
    }

    if (!files || files.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          classified: 0,
          auto_assigned: 0,
          pending_review: 0,
          message: 'No files to classify',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Fetch all clients for matching context
    const { data: clients } = await supabaseClient
      .from('clients')
      .select('id, name, email, company')

    const clientsList = (clients || [])
      .map(c => `- "${c.name}" (id: ${c.id}, email: ${c.email || 'N/A'}, company: ${c.company || 'N/A'})`)
      .join('\n')

    let classified = 0
    let autoAssigned = 0
    let pendingReview = 0
    let totalInputTokens = 0
    let totalOutputTokens = 0

    for (const file of files) {
      // Only process files that have transcript content
      if (!file.transcript_text) {
        console.log(`[classify-zoom-meetings] Skipping file ${file.id} — no transcript_text`)
        continue
      }

      const meetingTopic = (file.metadata as Record<string, unknown>)?.meeting_topic || file.file_name || 'Unknown'
      const transcriptPreview = file.transcript_text.slice(0, 8000)

      try {
        const result = await chatCompletion(supabaseClient, {
          messages: [
            {
              role: 'system',
              content: `You are a meeting classification assistant. Given a meeting transcript from a Zoom recording, classify the meeting and identify related clients.

Meeting Types:
- internal: Internal team meetings, syncs, 1:1s
- client: Meetings involving external clients or customers
- standup: Daily/weekly standups
- review: Code reviews, performance reviews, retrospectives
- planning: Sprint planning, project planning
- other: Anything else

Also determine if the meeting relates to a specific client from the provided list.

Respond with a JSON object:
{
  "meeting_type": "<one of the types above>",
  "suggested_client_id": "<UUID from client list or null>",
  "confidence": <0.0-1.0>,
  "reasoning": "<brief explanation>"
}

Only use client IDs from the provided list. If no client matches, set suggested_client_id to null.`
            },
            {
              role: 'user',
              content: `Meeting Topic: ${meetingTopic}

Transcript:
${transcriptPreview}

Available Clients:
${clientsList || 'No clients in system'}`
            }
          ],
          temperature: 0.3,
          max_tokens: 500,
        })

        totalInputTokens += result.input_tokens || 0
        totalOutputTokens += result.output_tokens || 0

        let parsed: {
          meeting_type: string
          suggested_client_id: string | null
          confidence: number
          reasoning: string
        }

        try {
          parsed = JSON.parse(result.content)
        } catch {
          console.warn(`[classify-zoom-meetings] Failed to parse AI response for file ${file.id}`)
          continue
        }

        const meetingType = parsed.meeting_type || 'other'
        const suggestedClientId = parsed.suggested_client_id || null
        const confidence = parsed.confidence || 0.5
        const reasoning = parsed.reasoning || ''

        // Validate suggested_client_id
        let validClientId = suggestedClientId
        if (validClientId) {
          const validClient = (clients || []).find(c => c.id === validClientId)
          if (!validClient) {
            console.warn(`[classify-zoom-meetings] AI returned invalid client_id for file ${file.id}, discarding`)
            validClientId = null
          }
        }

        // Determine assignment_status based on confidence
        const assignmentStatus = confidence >= CONFIDENCE_HIGH ? 'assigned' : 'pending_review'

        // Update meeting_files with classification results
        const { error: updateError } = await supabaseClient
          .from('meeting_files')
          .update({
            assignment_status: assignmentStatus,
            assignment_confidence: confidence,
            suggested_client_id: validClientId,
            assignment_reasoning: reasoning,
            metadata: {
              ...(file.metadata as Record<string, unknown> || {}),
              classified_meeting_type: meetingType,
              classified_at: new Date().toISOString(),
            },
          })
          .eq('id', file.id)

        if (updateError) {
          console.error(`[classify-zoom-meetings] Failed to update file ${file.id}:`, updateError)
          continue
        }

        classified++

        if (assignmentStatus === 'assigned') {
          autoAssigned++
        } else {
          pendingReview++
        }
      } catch (fileError) {
        console.error(`[classify-zoom-meetings] Error classifying file ${file.id}:`, fileError)
      }
    }

    // Log AI usage
    await logUsage(
      supabaseClient,
      null,
      null,
      'classify-zoom-meetings',
      totalInputTokens,
      totalOutputTokens,
      0,
      0
    )

    return new Response(
      JSON.stringify({
        success: true,
        classified,
        auto_assigned: autoAssigned,
        pending_review: pendingReview,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    console.error('Classify zoom meetings error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
