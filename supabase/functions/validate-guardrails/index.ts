/**
 * Validate Guardrails Edge Function
 *
 * Validates agent input/output against active guardrails.
 * Returns validation results and potential violations.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ValidationRequest {
  agent_id: string
  user_id?: string
  content: string
  validation_type: 'input' | 'output' | 'both'
  tool_name?: string
  estimated_cost?: number
  execution_id?: string
}

interface GuardrailViolation {
  guardrail_id: string
  guardrail_name: string
  guardrail_type: string
  severity: string
  violation_details: any
  action: string
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

    const body: ValidationRequest = await req.json()
    const {
      agent_id,
      user_id,
      content,
      validation_type,
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

    const violations: GuardrailViolation[] = []

    // Get all active guardrails for this agent
    const { data: guardrails, error: guardrailsError } = await supabaseClient
      .rpc('get_agent_guardrails' as never, { p_agent_id: agent_id } as never)

    if (guardrailsError) {
      console.error('Failed to get guardrails:', guardrailsError)
      throw new Error('Failed to get guardrails')
    }

    // Validate against each guardrail
    for (const guardrail of guardrails || []) {
      const rules = guardrail.rules || {}

      switch (guardrail.guardrail_type) {
        case 'input_validation':
          if (validation_type === 'input' || validation_type === 'both') {
            const violation = await validateInputGuardrail(content, guardrail, rules)
            if (violation) violations.push(violation)
          }
          break

        case 'output_filtering':
          if (validation_type === 'output' || validation_type === 'both') {
            const violation = await validateOutputGuardrail(content, guardrail, rules)
            if (violation) violations.push(violation)
          }
          break

        case 'tool_restriction':
          if (tool_name) {
            const violation = await validateToolRestriction(
              supabaseClient,
              agent_id,
              tool_name,
              guardrail,
              rules
            )
            if (violation) violations.push(violation)
          }
          break

        case 'cost_control':
          if (estimated_cost !== undefined) {
            const violation = await validateCostControl(
              supabaseClient,
              agent_id,
              estimated_cost,
              guardrail,
              rules
            )
            if (violation) violations.push(violation)
          }
          break

        case 'data_access':
          const violation = await validateDataAccess(content, guardrail, rules)
          if (violation) violations.push(violation)
          break
      }
    }

    // Get content filters
    const { data: contentFilters } = await supabaseClient
      .from('content_filters')
      .select('*')
      .eq('is_active', true)
      .in('applies_to', validation_type === 'both' ? ['input', 'output', 'both'] : [validation_type, 'both'])

    // Validate against content filters
    for (const filter of contentFilters || []) {
      const violation = await validateContentFilter(content, filter)
      if (violation) {
        violations.push({
          guardrail_id: filter.id,
          guardrail_name: filter.name,
          guardrail_type: 'content_filter',
          severity: filter.severity,
          violation_details: violation,
          action: filter.severity === 'block' ? 'blocked' : 'warned'
        })
      }
    }

    // Log violations
    if (violations.length > 0) {
      const violationRecords = violations.map(v => ({
        guardrail_id: v.guardrail_id,
        agent_id,
        user_id,
        execution_id,
        violation_details: v.violation_details,
        action_taken: v.action,
        input_content: validation_type === 'input' ? content : null,
        output_content: validation_type === 'output' ? content : null,
        severity: v.severity
      }))

      await supabaseClient
        .from('guardrail_violations')
        .insert(violationRecords)
    }

    // Determine if validation passes
    const blockers = violations.filter(v => v.action === 'blocked')
    const warnings = violations.filter(v => v.action === 'warned')

    return new Response(
      JSON.stringify({
        passed: blockers.length === 0,
        violations: violations.length,
        blockers: blockers.length,
        warnings: warnings.length,
        details: violations,
        action: blockers.length > 0 ? 'block' : (warnings.length > 0 ? 'warn' : 'allow')
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: unknown) {
    console.error('Validation error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

/**
 * Validate input guardrails (e.g., prompt injection detection)
 */
async function validateInputGuardrail(
  content: string,
  guardrail: any,
  rules: any
): Promise<any | null> {
  const patterns = rules.patterns || []

  for (const pattern of patterns) {
    const regex = new RegExp(pattern, rules.case_sensitive ? 'g' : 'gi')
    const matches = content.match(regex)

    if (matches && matches.length > 0) {
      return {
        guardrail_id: guardrail.id,
        guardrail_name: guardrail.name,
        guardrail_type: guardrail.guardrail_type,
        severity: guardrail.severity,
        violation_details: {
          pattern,
          matches,
          error_message: rules.error_message
        },
        action: rules.action || guardrail.severity === 'block' ? 'blocked' : 'warned'
      }
    }
  }

  return null
}

/**
 * Validate output guardrails (e.g., PII detection, offensive content)
 */
async function validateOutputGuardrail(
  content: string,
  guardrail: any,
  rules: any
): Promise<any | null> {
  const patterns = rules.patterns || []
  const keywords = rules.keywords || []

  // Check patterns (regex)
  for (const pattern of patterns) {
    const regex = new RegExp(pattern, 'gi')
    const matches = content.match(regex)

    if (matches && matches.length > 0) {
      return {
        guardrail_id: guardrail.id,
        guardrail_name: guardrail.name,
        guardrail_type: guardrail.guardrail_type,
        severity: guardrail.severity,
        violation_details: {
          type: 'pattern',
          pattern,
          matches,
          pii_types: rules.pii_types
        },
        action: rules.action === 'redact' ? 'warned' : 'blocked'
      }
    }
  }

  // Check keywords
  for (const keyword of keywords) {
    const regex = new RegExp(`\\b${keyword}\\b`, rules.case_sensitive ? 'g' : 'gi')
    if (regex.test(content)) {
      return {
        guardrail_id: guardrail.id,
        guardrail_name: guardrail.name,
        guardrail_type: guardrail.guardrail_type,
        severity: guardrail.severity,
        violation_details: {
          type: 'keyword',
          keyword
        },
        action: 'blocked'
      }
    }
  }

  return null
}

/**
 * Validate tool restriction guardrails
 */
async function validateToolRestriction(
  supabase: any,
  agentId: string,
  toolName: string,
  guardrail: any,
  rules: any
): Promise<any | null> {
  const restrictedTools = rules.restricted_tools || []
  const maxCalls = rules.max_calls

  // Check if tool is restricted
  if (restrictedTools.includes(toolName)) {
    if (rules.action === 'require_approval') {
      return {
        guardrail_id: guardrail.id,
        guardrail_name: guardrail.name,
        guardrail_type: guardrail.guardrail_type,
        severity: guardrail.severity,
        violation_details: {
          tool_name: toolName,
          reason: 'requires_approval',
          timeout_minutes: rules.approval_timeout_minutes
        },
        action: 'requires_approval'
      }
    }

    return {
      guardrail_id: guardrail.id,
      guardrail_name: guardrail.name,
      guardrail_type: guardrail.guardrail_type,
      severity: guardrail.severity,
      violation_details: {
        tool_name: toolName,
        reason: 'tool_restricted'
      },
      action: 'blocked'
    }
  }

  // Check rate limits for this specific tool
  const { data: rateLimit } = await supabase
    .rpc('check_tool_rate_limit' as never, {
      p_agent_id: agentId,
      p_tool_name: toolName
    } as never)

  if (rateLimit && rateLimit.length > 0 && !rateLimit[0].can_use) {
    return {
      guardrail_id: guardrail.id,
      guardrail_name: 'Tool Rate Limit',
      guardrail_type: guardrail.guardrail_type,
      severity: 'block',
      violation_details: {
        tool_name: toolName,
        limit_type: rateLimit[0].limit_type,
        usage_count: rateLimit[0].usage_count,
        max_allowed: rateLimit[0].max_allowed,
        resets_at: rateLimit[0].resets_at
      },
      action: 'blocked'
    }
  }

  return null
}

/**
 * Validate cost control guardrails
 */
async function validateCostControl(
  supabase: any,
  agentId: string,
  estimatedCost: number,
  guardrail: any,
  rules: any
): Promise<any | null> {
  const maxCost = rules.max_cost

  // Check per-execution cost
  if (maxCost && estimatedCost > maxCost) {
    return {
      guardrail_id: guardrail.id,
      guardrail_name: guardrail.name,
      guardrail_type: guardrail.guardrail_type,
      severity: guardrail.severity,
      violation_details: {
        estimated_cost: estimatedCost,
        max_cost: maxCost,
        error_message: rules.error_message
      },
      action: 'blocked'
    }
  }

  // Check cost limits
  const { data: costCheck } = await supabase
    .rpc('check_agent_cost_limit' as never, {
      p_agent_id: agentId,
      p_estimated_cost: estimatedCost,
      p_limit_type: 'daily'
    } as never)

  if (costCheck && costCheck.length > 0 && !costCheck[0].can_proceed) {
    return {
      guardrail_id: guardrail.id,
      guardrail_name: 'Daily Cost Limit Exceeded',
      guardrail_type: guardrail.guardrail_type,
      severity: 'block',
      violation_details: {
        current_spend: costCheck[0].current_spend,
        max_cost: costCheck[0].max_cost,
        remaining_budget: costCheck[0].remaining_budget,
        estimated_cost: estimatedCost
      },
      action: 'blocked'
    }
  }

  return null
}

/**
 * Validate data access guardrails
 */
async function validateDataAccess(
  content: string,
  guardrail: any,
  rules: any
): Promise<any | null> {
  const blockedTables = rules.blocked_tables || []
  const blockedSchemas = rules.blocked_schemas || []

  // Check for blocked table names in content
  for (const table of blockedTables) {
    const regex = new RegExp(`\\b${table}\\b`, 'i')
    if (regex.test(content)) {
      return {
        guardrail_id: guardrail.id,
        guardrail_name: guardrail.name,
        guardrail_type: guardrail.guardrail_type,
        severity: guardrail.severity,
        violation_details: {
          blocked_table: table,
          error_message: rules.error_message
        },
        action: 'blocked'
      }
    }
  }

  // Check for blocked schema names
  for (const schema of blockedSchemas) {
    const regex = new RegExp(`\\b${schema}\\.`, 'i')
    if (regex.test(content)) {
      return {
        guardrail_id: guardrail.id,
        guardrail_name: guardrail.name,
        guardrail_type: guardrail.guardrail_type,
        severity: guardrail.severity,
        violation_details: {
          blocked_schema: schema,
          error_message: rules.error_message
        },
        action: 'blocked'
      }
    }
  }

  return null
}

/**
 * Validate content filters
 */
async function validateContentFilter(
  content: string,
  filter: any
): Promise<any | null> {
  // Check pattern (regex)
  if (filter.pattern) {
    const regex = new RegExp(filter.pattern, 'gi')
    const matches = content.match(regex)

    if (matches && matches.length > 0) {
      return {
        filter_type: filter.filter_type,
        pattern: filter.pattern,
        matches
      }
    }
  }

  // Check keywords
  if (filter.keywords && filter.keywords.length > 0) {
    for (const keyword of filter.keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi')
      if (regex.test(content)) {
        return {
          filter_type: filter.filter_type,
          keyword
        }
      }
    }
  }

  return null
}
