/**
 * Suggest OKRs Edge Function
 *
 * Uses AI to suggest OKRs based on company context: recent issues,
 * meeting summaries, and existing goals. Returns structured OKR suggestions
 * with objectives, key results, and rationale.
 *
 * Input:  { pod_id?, quarter?, context?: string }
 * Output: { suggestions: SuggestedOKR[] }
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

    const { pod_id, quarter, context: userContext, type = 'team', count = 3 } = await req.json()

    // Gather context from the database
    const contextParts: string[] = []

    // 1. Recent open issues
    let issuesQuery = supabaseClient
      .from('eos_issues')
      .select('title, description, priority, category, status')
      .in('status', ['open', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(20)

    if (pod_id) issuesQuery = issuesQuery.eq('pod_id', pod_id)

    const { data: issues } = await issuesQuery
    if (issues && issues.length > 0) {
      contextParts.push(
        'Recent open issues:\n' +
        issues.map((i: Record<string, string>) =>
          `- [${i.priority}] ${i.title}: ${i.description?.slice(0, 100) || ''}`
        ).join('\n')
      )
    }

    // 2. Existing OKRs for overlap avoidance
    let okrsQuery = supabaseClient
      .from('okrs')
      .select('title, status, quarter, progress')
      .in('status', ['active', 'behind', 'at_risk'])
      .limit(15)

    if (pod_id) okrsQuery = okrsQuery.eq('pod_id', pod_id)

    const { data: existingOkrs } = await okrsQuery
    if (existingOkrs && existingOkrs.length > 0) {
      contextParts.push(
        'Existing active OKRs (avoid duplicates):\n' +
        existingOkrs.map((o: Record<string, string>) =>
          `- ${o.title} (${o.status}, ${o.progress}% done)`
        ).join('\n')
      )
    }

    // 3. User-provided additional context
    if (userContext) {
      contextParts.push(`Additional context:\n${userContext}`)
    }

    const targetQuarter = quarter || `Q${Math.ceil((new Date().getMonth() + 1) / 3)} ${new Date().getFullYear()}`

    // Generate OKR suggestions via AI
    const result = await chatCompletion(supabaseClient, {
      messages: [
        {
          role: 'system',
          content: `You are an OKR coach that suggests objectives and key results using the EOS (Entrepreneurial Operating System) methodology.

Generate 1-8 OKR suggestions based on the provided context. Each suggestion should include:
- title: A clear, inspiring objective statement
- description: Why this objective matters
- key_results: Array of 2-4 measurable key results, each with:
  - title: Specific measurable outcome
  - target_value: Numeric target
  - unit: Unit of measurement (%, count, $, etc.)
  - start_value: Starting baseline (usually 0)
- rationale: Why this OKR addresses current issues/gaps
- priority: "high", "medium", or "low"

Ensure OKRs follow best practices: objectives are qualitative and inspiring, key results are quantitative and measurable. Target quarter: ${targetQuarter}.

Respond with JSON: { "okrs": [{ title, description, key_results:[{ title, measurement_unit, target_value, update_frequency }], reasoning }], "suggestions": [...] }`
        },
        {
          role: 'user',
          content: contextParts.length > 0
            ? `Based on this company context, suggest ${count} ${type} OKRs for ${targetQuarter}:\n\n${contextParts.join('\n\n')}`
            : `Suggest ${count} ${type} OKRs for ${targetQuarter} for a technology services company.`
        }
      ],
      temperature: 0.7,
      max_tokens: 3000,
    })

    let parsed: Record<string, unknown> = {}
    try {
      parsed = JSON.parse(result.content)
    } catch {
      console.warn('Failed to parse AI response as JSON')
      parsed = {}
    }

    const rawOkrs = Array.isArray(parsed.okrs)
      ? parsed.okrs
      : Array.isArray(parsed.suggestions)
        ? parsed.suggestions
        : Array.isArray(parsed)
          ? parsed
          : []

    const okrs = rawOkrs.slice(0, Math.max(1, Number(count) || 3)).map((item: Record<string, unknown>) => ({
      title: String(item.title || 'Untitled objective'),
      description: String(item.description || ''),
      key_results: Array.isArray(item.key_results)
        ? item.key_results.map((kr: Record<string, unknown>) => ({
            title: String(kr.title || 'Key result'),
            measurement_unit: String(kr.measurement_unit || kr.unit || 'number'),
            target_value: Number(kr.target_value || 0),
            update_frequency: String(kr.update_frequency || 'weekly'),
          }))
        : [],
      reasoning: String(item.reasoning || item.rationale || ''),
    }))

    // Log AI usage
    await logUsage(
      supabaseClient,
      null,
      null,
      'suggest-okrs',
      result.input_tokens || 0,
      result.output_tokens || 0,
      0,
      0
    )

    return new Response(
      JSON.stringify({
        success: true,
        quarter: targetQuarter,
        type,
        count: okrs.length,
        okrs,
        // backward compatibility for existing callers
        suggestions: okrs,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    console.error('Suggest OKRs error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
