/**
 * Smart Categorize Meetings Edge Function
 *
 * Batch AI categorization for multiple meetings. Classifies each meeting
 * into a category and meeting type with confidence scoring and tags.
 * Results are stored in meeting_categorizations and meetings.categorization_data.
 *
 * Input:  { meeting_ids: string[] }
 * Output: { success: true, categorized: number, results: [{ meeting_id, category, confidence }] }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { chatCompletion, logUsage } from '../_shared/ai-provider-routing.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CategorizationResult {
  meeting_id: string
  category: string
  meeting_type: string
  confidence: number
  tags: string[]
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

    const { meeting_ids } = await req.json()

    if (!meeting_ids || !Array.isArray(meeting_ids) || meeting_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: 'meeting_ids is required and must be a non-empty array' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Fetch all specified meetings
    const { data: meetings, error: meetingsError } = await supabaseClient
      .from('meetings')
      .select('id, title, description, ai_summary')
      .in('id', meeting_ids)

    if (meetingsError) {
      throw new Error(`Failed to fetch meetings: ${meetingsError.message}`)
    }

    if (!meetings || meetings.length === 0) {
      return new Response(
        JSON.stringify({ success: true, categorized: 0, results: [], message: 'No meetings found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    const results: CategorizationResult[] = []
    let totalInputTokens = 0
    let totalOutputTokens = 0

    for (const meeting of meetings) {
      const content = [
        meeting.title ? `Title: ${meeting.title}` : '',
        meeting.description ? `Description: ${meeting.description}` : '',
        meeting.ai_summary ? `AI Summary: ${meeting.ai_summary}` : '',
      ].filter(Boolean).join('\n')

      if (!content.trim()) {
        console.log(`[smart-categorize-meetings] Skipping meeting ${meeting.id} — no content`)
        continue
      }

      try {
        const result = await chatCompletion(supabaseClient, {
          messages: [
            {
              role: 'system',
              content: `You are a meeting categorization assistant. Categorize the given meeting into one of these categories and types.

Categories:
- client_meeting: External meetings with clients or customers
- internal_meeting: Team or company internal meetings
- planning: Sprint planning, project planning, roadmap discussions
- review: Code reviews, performance reviews, retrospectives
- standup: Daily standups, quick sync meetings
- interview: Job interviews, candidate screenings
- training: Training sessions, workshops, onboarding
- other: Anything that doesn't fit above categories

Meeting Types:
- internal: Internal team meetings
- client: Meetings involving external clients
- standup: Daily/weekly standups
- review: Reviews and retrospectives
- planning: Planning sessions

Respond with a JSON object:
{
  "category": "<one of the categories>",
  "meeting_type": "<one of the meeting types>",
  "confidence": <0.0-1.0>,
  "tags": ["<relevant tags>"]
}`
            },
            {
              role: 'user',
              content: `Categorize this meeting:\n\n${content}`
            }
          ],
          temperature: 0.3,
          max_tokens: 500,
        })

        totalInputTokens += result.input_tokens || 0
        totalOutputTokens += result.output_tokens || 0

        let parsed: { category: string; meeting_type: string; confidence: number; tags: string[] }
        try {
          parsed = JSON.parse(result.content)
        } catch {
          console.warn(`[smart-categorize-meetings] Failed to parse AI response for meeting ${meeting.id}`)
          continue
        }

        const category = parsed.category || 'other'
        const meetingType = parsed.meeting_type || 'internal'
        const confidence = parsed.confidence || 0.5
        const tags = parsed.tags || []

        // Upsert into meeting_categorizations
        const { error: catError } = await supabaseClient
          .from('meeting_categorizations')
          .upsert(
            {
              meeting_id: meeting.id,
              category,
              confidence,
              source: 'ai-smart-categorize',
              meeting_type: meetingType,
              tags,
            },
            { onConflict: 'meeting_id' }
          )

        if (catError) {
          console.error(`[smart-categorize-meetings] Failed to upsert categorization for ${meeting.id}:`, catError)

          // Fallback: try insert if upsert fails (no unique constraint scenario)
          const { error: insertError } = await supabaseClient
            .from('meeting_categorizations')
            .insert({
              meeting_id: meeting.id,
              category,
              confidence,
              source: 'ai-smart-categorize',
              meeting_type: meetingType,
              tags,
            })

          if (insertError) {
            console.error(`[smart-categorize-meetings] Fallback insert also failed for ${meeting.id}:`, insertError)
          }
        }

        // Update meetings.categorization_data with the result
        const { error: updateError } = await supabaseClient
          .from('meetings')
          .update({
            categorization_data: {
              category,
              meeting_type: meetingType,
              confidence,
              tags,
              categorized_at: new Date().toISOString(),
              source: 'ai-smart-categorize',
            },
          })
          .eq('id', meeting.id)

        if (updateError) {
          console.error(`[smart-categorize-meetings] Failed to update categorization_data for ${meeting.id}:`, updateError)
        }

        results.push({
          meeting_id: meeting.id,
          category,
          meeting_type: meetingType,
          confidence,
          tags,
        })
      } catch (meetingError) {
        console.error(`[smart-categorize-meetings] Error categorizing meeting ${meeting.id}:`, meetingError)
      }
    }

    // Log AI usage
    await logUsage(
      supabaseClient,
      null,
      null,
      'smart-categorize-meetings',
      totalInputTokens,
      totalOutputTokens,
      0,
      0
    )

    return new Response(
      JSON.stringify({
        success: true,
        categorized: results.length,
        results: results.map(r => ({
          meeting_id: r.meeting_id,
          category: r.category,
          confidence: r.confidence,
        })),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    console.error('Smart categorize meetings error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
