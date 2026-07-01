/**
 * Request Approval Edge Function
 *
 * Human-in-the-Loop (HITL) system for agent actions.
 * Handles approval requests for critical agent operations.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ApprovalRequestBody {
  agent_id: string
  user_id: string
  action_description: string
  request_type: string
  tool_name?: string
  tool_parameters?: Record<string, any>
  estimated_cost?: number
  risk_level?: 'low' | 'medium' | 'high' | 'critical'
  agent_reasoning?: string
  confidence_score?: number
  timeout_minutes?: number
  auto_execute?: boolean  // Execute automatically if approved
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

    const body: ApprovalRequestBody = await req.json()

    const {
      agent_id,
      user_id,
      action_description,
      request_type,
      tool_name,
      tool_parameters,
      estimated_cost,
      risk_level = 'medium',
      agent_reasoning,
      confidence_score,
      timeout_minutes = 60,
      auto_execute = false,
    } = body

    if (!agent_id || !user_id || !action_description || !request_type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Find applicable workflow
    const { data: workflows } = await supabaseClient
      .from('approval_workflows')
      .select('*')
      .eq('trigger_type', request_type)
      .eq('is_enabled', true)

    let workflow = null
    let requiresApproval = false

    if (workflows && workflows.length > 0) {
      // Check if any workflow conditions match
      for (const wf of workflows) {
        const conditions = wf.trigger_conditions as Record<string, any>

        // Check cost threshold
        if (conditions.min_cost && estimated_cost && estimated_cost >= conditions.min_cost) {
          workflow = wf
          requiresApproval = true
          break
        }

        // Check risk level
        if (conditions.min_risk_level) {
          const riskLevels = ['low', 'medium', 'high', 'critical']
          if (riskLevels.indexOf(risk_level) >= riskLevels.indexOf(conditions.min_risk_level)) {
            workflow = wf
            requiresApproval = true
            break
          }
        }

        // Check confidence threshold
        if (conditions.max_confidence && confidence_score && confidence_score <= conditions.max_confidence) {
          workflow = wf
          requiresApproval = true
          break
        }

        // Default workflow if no specific conditions
        if (!conditions.min_cost && !conditions.min_risk_level && !conditions.max_confidence) {
          workflow = wf
          requiresApproval = true
          break
        }
      }
    }

    // Check auto-approval threshold
    if (workflow && workflow.auto_approve_threshold && confidence_score) {
      if (confidence_score >= workflow.auto_approve_threshold) {
        requiresApproval = false
      }
    }

    // If no approval required, return immediately
    if (!requiresApproval) {
      return new Response(
        JSON.stringify({
          requires_approval: false,
          message: 'Action approved automatically',
          can_proceed: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Create approval request
    const expiresAt = new Date()
    expiresAt.setMinutes(expiresAt.getMinutes() + timeout_minutes)

    const { data: approvalRequest, error: insertError } = await supabaseClient
      .from('approval_requests')
      .insert({
        workflow_id: workflow?.id || null,
        agent_id,
        user_id,
        request_type,
        action_description,
        tool_name,
        tool_parameters,
        estimated_cost,
        risk_level,
        agent_reasoning,
        confidence_score,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
        metadata: {
          auto_execute: auto_execute,
        },
      })
      .select()
      .single()

    if (insertError) {
      console.error('Failed to create approval request:', insertError)
      throw new Error('Failed to create approval request')
    }

    // Determine who should approve
    let approvers: any[] = []
    if (workflow) {
      const approverConfig = workflow.approver_config as Record<string, any> || {}

      if (workflow.approver_type === 'specific_user' && approverConfig.user_ids) {
        const { data: users } = await supabaseClient
          .from('profiles')
          .select('id, email, full_name')
          .in('id', approverConfig.user_ids)

        approvers = users || []
      } else if (workflow.approver_type === 'role' && approverConfig.role) {
        const { data: roleUsers } = await supabaseClient
          .from('user_roles')
          .select('user_id, profiles(id, email, full_name)')
          .eq('role', approverConfig.role)

        approvers = roleUsers?.map(ru => ru.profiles) || []
      }
    }

    // TODO: Send notification to approvers
    // This would integrate with your notification system
    // await sendApprovalNotification(approvers, approvalRequest)

    return new Response(
      JSON.stringify({
        requires_approval: true,
        approval_request_id: approvalRequest.id,
        expires_at: expiresAt.toISOString(),
        approvers: approvers.map(a => ({ id: a.id, email: a.email, name: a.full_name })),
        message: 'Approval request created. Waiting for approval.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: unknown) {
    console.error('Request approval error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
