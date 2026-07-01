/**
 * Enforce Guardrails Edge Function
 *
 * Takes action on guardrail violations:
 * - Blocks content
 * - Redacts PII
 * - Returns sanitized output
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EnforceRequest {
  agent_id: string
  user_id?: string
  content: string
  enforcement_type: 'input' | 'output' | 'both'
  tool_name?: string
  estimated_cost?: number
  execution_id?: string
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

    const body: EnforceRequest = await req.json()
    const {
      agent_id,
      user_id,
      content,
      enforcement_type,
      tool_name,
      estimated_cost,
      execution_id
    } = body

    if (!agent_id || !content) {
      return new Response(
        JSON.stringify({ error: 'agent_id and content are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // First validate to find violations
    const validateResponse = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/validate-guardrails`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agent_id,
          user_id,
          content,
          validation_type: enforcement_type,
          tool_name,
          estimated_cost,
          execution_id
        }),
      }
    )

    if (!validateResponse.ok) {
      throw new Error('Validation failed')
    }

    const validationResult = await validateResponse.json()

    // If there are blockers, block execution
    if (validationResult.blockers > 0) {
      const blockReasons = validationResult.details
        .filter((d: any) => d.action === 'blocked')
        .map((d: any) => ({
          guardrail: d.guardrail_name,
          reason: d.violation_details.error_message || d.violation_details.reason || 'Blocked by guardrail',
          details: d.violation_details
        }))

      return new Response(
        JSON.stringify({
          allowed: false,
          action: 'blocked',
          content: null,
          violations: validationResult.violations,
          blockers: blockReasons,
          message: `Execution blocked by ${validationResult.blockers} guardrail(s)`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      )
    }

    // Apply transformations (e.g., redact PII)
    let sanitizedContent = content
    const transformations: any[] = []

    for (const violation of validationResult.details || []) {
      if (violation.violation_details.type === 'pattern' && violation.action === 'warned') {
        // Redact pattern matches
        const pattern = violation.violation_details.pattern
        const regex = new RegExp(pattern, 'gi')

        let matchCount = 0
        sanitizedContent = sanitizedContent.replace(regex, (match) => {
          matchCount++
          return `[REDACTED_${violation.violation_details.pii_types?.[0] || 'PII'}_${matchCount}]`
        })

        if (matchCount > 0) {
          transformations.push({
            type: 'redaction',
            guardrail: violation.guardrail_name,
            count: matchCount,
            pii_type: violation.violation_details.pii_types?.[0] || 'PII'
          })
        }
      }

      if (violation.violation_details.type === 'keyword') {
        // Redact keyword
        const keyword = violation.violation_details.keyword
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi')

        let matchCount = 0
        sanitizedContent = sanitizedContent.replace(regex, (match) => {
          matchCount++
          return '[REDACTED_KEYWORD]'
        })

        if (matchCount > 0) {
          transformations.push({
            type: 'keyword_redaction',
            guardrail: violation.guardrail_name,
            count: matchCount
          })
        }
      }
    }

    // Record tool usage if applicable
    if (tool_name) {
      await supabaseClient
        .rpc('record_tool_usage' as never, {
          p_agent_id: agent_id,
          p_tool_name: tool_name,
          p_execution_id: execution_id,
          p_success: true
        } as never)
    }

    // Record cost if applicable
    if (estimated_cost) {
      await supabaseClient
        .rpc('record_agent_cost' as never, {
          p_agent_id: agent_id,
          p_cost: estimated_cost
        } as never)
    }

    const warnings = validationResult.details.filter((d: any) => d.action === 'warned')

    return new Response(
      JSON.stringify({
        allowed: true,
        action: transformations.length > 0 ? 'transformed' : 'allowed',
        content: sanitizedContent,
        original_content: content !== sanitizedContent ? content : null,
        violations: validationResult.violations,
        warnings: warnings.length,
        warning_details: warnings.map((w: any) => ({
          guardrail: w.guardrail_name,
          message: w.violation_details.error_message || 'Content triggered warning',
          details: w.violation_details
        })),
        transformations,
        message: transformations.length > 0
          ? `Content sanitized (${transformations.length} transformation(s) applied)`
          : warnings.length > 0
          ? `Content allowed with ${warnings.length} warning(s)`
          : 'Content passed all guardrails'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: unknown) {
    console.error('Enforcement error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
