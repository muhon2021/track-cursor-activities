/**
 * Quarterly Digest Edge Function
 *
 * Generates a comprehensive quarterly digest report using AI.
 * Aggregates data from EOS issues, OKRs, meetings, and scorecard metrics
 * to produce an executive summary with highlights, risks, and recommendations.
 *
 * Input:  { quarter?: string, pod_id?: string }
 * Output: { digest: QuarterlyDigest }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { chatCompletion, logUsage } from '../_shared/ai-provider-routing.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function getQuarterDateRange(quarter?: string): { start: string; end: string; label: string } {
  const now = new Date()
  const currentQ = Math.ceil((now.getMonth() + 1) / 3)
  const currentYear = now.getFullYear()

  let q = currentQ
  let year = currentYear

  if (quarter) {
    const match = quarter.match(/Q(\d)\s*(\d{4})/)
    if (match) {
      q = parseInt(match[1])
      year = parseInt(match[2])
    }
  }

  const startMonth = (q - 1) * 3
  const start = new Date(year, startMonth, 1).toISOString()
  const end = new Date(year, startMonth + 3, 0, 23, 59, 59).toISOString()

  return { start, end, label: `Q${q} ${year}` }
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

    const { quarter, pod_id } = await req.json()
    const range = getQuarterDateRange(quarter)

    // Gather quarterly data in parallel
    const [issuesResult, okrsResult, meetingsResult, scorecardResult] = await Promise.all([
      // Issues created/resolved this quarter
      supabaseClient
        .from('eos_issues')
        .select('title, status, priority, category, created_at, resolved_at')
        .gte('created_at', range.start)
        .lte('created_at', range.end)
        .order('created_at', { ascending: false })
        .limit(50),

      // OKRs for this quarter
      supabaseClient
        .from('okrs')
        .select('title, status, progress, quarter')
        .eq('quarter', range.label)
        .limit(30),

      // Meetings this quarter
      supabaseClient
        .from('meetings')
        .select('title, scheduled_at, status, duration_minutes')
        .gte('scheduled_at', range.start)
        .lte('scheduled_at', range.end)
        .limit(50),

      // Scorecard metrics
      supabaseClient
        .from('eos_scorecard_metrics')
        .select('metric_name, actual_value, target_value, week_of')
        .gte('week_of', range.start)
        .lte('week_of', range.end)
        .limit(100),
    ])

    const issues = issuesResult.data || []
    const okrs = okrsResult.data || []
    const meetings = meetingsResult.data || []
    const metrics = scorecardResult.data || []

    // Build context for AI
    const issueStats = {
      total: issues.length,
      resolved: issues.filter((i: Record<string, string>) => i.status === 'solved').length,
      critical: issues.filter((i: Record<string, string>) => i.priority === 'critical').length,
      byCategory: {} as Record<string, number>,
    }
    issues.forEach((i: Record<string, string>) => {
      issueStats.byCategory[i.category] = (issueStats.byCategory[i.category] || 0) + 1
    })

    const okrStats = {
      total: okrs.length,
      completed: okrs.filter((o: Record<string, string>) => o.status === 'completed').length,
      atRisk: okrs.filter((o: Record<string, string>) => o.status === 'at_risk').length,
      avgProgress: okrs.length > 0
        ? Math.round(okrs.reduce((s: number, o: Record<string, number>) => s + (o.progress || 0), 0) / okrs.length)
        : 0,
    }

    const contextText = `
Quarter: ${range.label}

ISSUES (${issueStats.total} total, ${issueStats.resolved} resolved, ${issueStats.critical} critical):
${issues.slice(0, 20).map((i: Record<string, string>) => `- [${i.priority}] ${i.title} (${i.status})`).join('\n')}

OKRs (${okrStats.total} total, ${okrStats.completed} completed, avg ${okrStats.avgProgress}% progress):
${okrs.map((o: Record<string, string | number>) => `- ${o.title}: ${o.progress}% (${o.status})`).join('\n')}

MEETINGS: ${meetings.length} meetings held

SCORECARD: ${metrics.length} metric entries tracked
`

    // Generate digest via AI
    const result = await chatCompletion(supabaseClient, {
      messages: [
        {
          role: 'system',
          content: `You are an executive business analyst creating a quarterly digest report.

Based on the provided data, generate a comprehensive digest with:
- executive_summary: 3-5 sentence overview of the quarter
- highlights: Array of positive achievements (3-5 items)
- risks: Array of concerns or risks (2-4 items)
- recommendations: Array of actionable recommendations for next quarter (3-5 items)
- metrics_summary: Key performance metrics in plain text
- okr_assessment: Overall OKR health assessment

Be specific, reference actual data points, and provide actionable insights.

Respond with JSON: { "executive_summary", "highlights", "risks", "recommendations", "metrics_summary", "okr_assessment" }`
        },
        {
          role: 'user',
          content: `Generate a quarterly digest for this data:\n${contextText}`
        }
      ],
      temperature: 0.5,
      max_tokens: 2000,
    })

    let digest = {}
    try {
      digest = JSON.parse(result.content)
    } catch {
      digest = {
        executive_summary: 'Unable to generate digest from available data.',
        highlights: [],
        risks: [],
        recommendations: [],
      }
    }

    // Log AI usage
    await logUsage(
      supabaseClient,
      null,
      null,
      'quarterly-digest',
      result.input_tokens || 0,
      result.output_tokens || 0,
      0,
      0
    )

    return new Response(
      JSON.stringify({
        digest,
        quarter: range.label,
        stats: { issues: issueStats, okrs: okrStats, meetings: meetings.length },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    console.error('Quarterly digest error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
