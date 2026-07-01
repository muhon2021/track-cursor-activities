/**
 * EOS Triage Assistant Edge Function
 *
 * AI-powered issue triage: suggests priority, category, pod assignment,
 * and related issues for a new or existing EOS issue.
 *
 * Input:  { title, description?, existing_issues?: boolean }
 * Output: { priority, category, suggested_pod_id?, related_issues?, rationale }
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

    const { title, description } = await req.json()

    if (!title) {
      return new Response(
        JSON.stringify({ error: 'title is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Gather context: pods and recent issues
    const { data: pods } = await supabaseClient
      .from('eos_pods')
      .select('id, name, description')
      .eq('is_active', true)
      .limit(20)

    const { data: recentIssues } = await supabaseClient
      .from('eos_issues')
      .select('id, title, priority, category, pod_id, status')
      .order('created_at', { ascending: false })
      .limit(30)

    const podsContext = (pods || []).map((p: Record<string, string>) =>
      `- ${p.name} (id: ${p.id}): ${p.description || 'No description'}`
    ).join('\n')

    const issuesContext = (recentIssues || []).map((i: Record<string, string>) =>
      `- [${i.priority}/${i.category}] ${i.title} (pod: ${i.pod_id || 'unassigned'}, status: ${i.status})`
    ).join('\n')

    // AI triage
    const result = await chatCompletion(supabaseClient, {
      messages: [
        {
          role: 'system',
          content: `You are an EOS issue triage assistant. Given a new issue, suggest:
- priority: "critical", "high", "medium", or "low"
- category: "people", "process", "technology", "strategy", "customer", "financial", or "other"
- suggested_pod_id: The ID of the most appropriate pod (or null)
- suggested_pod_name: The name of the suggested pod
- related_issue_ids: Array of IDs of similar/related existing issues (max 3)
- rationale: Brief explanation of your triage decisions

Available pods:
${podsContext || 'No pods configured'}

Recent issues for context:
${issuesContext || 'No recent issues'}

Respond with JSON.`
        },
        {
          role: 'user',
          content: `Triage this new issue:\nTitle: ${title}\nDescription: ${description || 'No description provided'}`
        }
      ],
      temperature: 0.3,
      max_tokens: 1000,
    })

    let triage = {}
    try {
      triage = JSON.parse(result.content)
    } catch {
      triage = {
        priority: 'medium',
        category: 'other',
        suggested_pod_id: null,
        related_issue_ids: [],
        rationale: 'Could not parse AI response',
      }
    }

    // Log AI usage
    await logUsage(
      supabaseClient,
      null,
      null,
      'eos-triage-assistant',
      result.input_tokens || 0,
      result.output_tokens || 0,
      0,
      0
    )

    return new Response(
      JSON.stringify(triage),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    console.error('EOS triage assistant error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
