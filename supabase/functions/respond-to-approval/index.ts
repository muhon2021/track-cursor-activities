/**
 * Respond to Approval Edge Function
 *
 * Allows users to approve or reject agent action requests.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RespondToApprovalBody {
  approval_request_id: string
  approved: boolean
  approval_note?: string
  execute_immediately?: boolean
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

    // Get authenticated user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    const body: RespondToApprovalBody = await req.json()
    const { approval_request_id, approved, approval_note, execute_immediately = false } = body

    if (!approval_request_id || approved === undefined) {
      return new Response(
        JSON.stringify({ error: 'approval_request_id and approved are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Get the approval request
    const { data: approvalRequest, error: requestError } = await supabaseClient
      .from('approval_requests')
      .select('*, workflow:approval_workflows(*)')
      .eq('id', approval_request_id)
      .single()

    if (requestError || !approvalRequest) {
      return new Response(
        JSON.stringify({ error: 'Approval request not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // Check if request is still pending
    if (approvalRequest.status !== 'pending') {
      return new Response(
        JSON.stringify({
          error: `Request already ${approvalRequest.status}`,
          current_status: approvalRequest.status,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Check if expired
    if (approvalRequest.expires_at && new Date(approvalRequest.expires_at) < new Date()) {
      await supabaseClient
        .from('approval_requests')
        .update({ status: 'expired' })
        .eq('id', approval_request_id)

      return new Response(
        JSON.stringify({ error: 'Approval request has expired' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Check if user is authorized to approve
    const workflow = approvalRequest.workflow
    let canApprove = false

    if (workflow) {
      const approverConfig = workflow.approver_config as Record<string, any> || {}

      if (workflow.approver_type === 'any_user') {
        canApprove = true
      } else if (workflow.approver_type === 'specific_user') {
        canApprove = approverConfig.user_ids?.includes(user.id)
      } else if (workflow.approver_type === 'role') {
        const { data: userRoles } = await supabaseClient
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)

        canApprove = userRoles?.some(ur => ur.role === approverConfig.role) || false
      }

      // Check delegations
      if (!canApprove) {
        const { data: delegation } = await supabaseClient
          .from('approval_delegations')
          .select('*')
          .eq('delegate_id', user.id)
          .eq('is_active', true)
          .or(`workflow_id.eq.${workflow.id},workflow_id.is.null`)
          .or(`agent_id.eq.${approvalRequest.agent_id},agent_id.is.null`)
          .single()

        if (delegation) {
          // Check delegation constraints
          if (delegation.max_cost_limit && approvalRequest.estimated_cost > delegation.max_cost_limit) {
            return new Response(
              JSON.stringify({
                error: 'Cost exceeds your delegation limit',
                your_limit: delegation.max_cost_limit,
                requested_cost: approvalRequest.estimated_cost,
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
            )
          }

          if (delegation.allowed_risk_levels && !delegation.allowed_risk_levels.includes(approvalRequest.risk_level)) {
            return new Response(
              JSON.stringify({
                error: 'Risk level not within your delegation scope',
                allowed_levels: delegation.allowed_risk_levels,
                requested_level: approvalRequest.risk_level,
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
            )
          }

          canApprove = true
        }
      }
    } else {
      // No workflow - check if user is admin
      const { data: userRoles } = await supabaseClient
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)

      canApprove = userRoles?.some(ur => ur.role === 'admin') || false
    }

    if (!canApprove) {
      return new Response(
        JSON.stringify({ error: 'You are not authorized to approve this request' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      )
    }

    // Update approval request
    const newStatus = approved ? 'approved' : 'rejected'
    const { error: updateError } = await supabaseClient
      .from('approval_requests')
      .update({
        status: newStatus,
        approved_by: user.id,
        approval_note,
        responded_at: new Date().toISOString(),
      })
      .eq('id', approval_request_id)

    if (updateError) {
      console.error('Failed to update approval request:', updateError)
      throw new Error('Failed to update approval request')
    }

    // Record audit trail
    await supabaseClient
      .from('agent_audit_trail')
      .insert({
        agent_id: approvalRequest.agent_id,
        user_id: user.id,
        action_type: 'approval_response',
        action_description: `${approved ? 'Approved' : 'Rejected'}: ${approvalRequest.action_description}`,
        after_state: { status: newStatus, note: approval_note },
      })

    // If approved and auto_execute, execute the action
    let executionResult = null
    if (approved && (execute_immediately || approvalRequest.metadata?.auto_execute)) {
      // Execute the tool if it was a tool execution request
      if (approvalRequest.request_type === 'tool_execution' && approvalRequest.tool_name) {
        try {
          const executeResponse = await fetch(
            `${Deno.env.get('SUPABASE_URL')}/functions/v1/execute-mcp-tool`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                tool_name: approvalRequest.tool_name,
                input_parameters: approvalRequest.tool_parameters,
                agent_id: approvalRequest.agent_id,
                user_id: approvalRequest.user_id,
              }),
            }
          )

          if (executeResponse.ok) {
            executionResult = await executeResponse.json()

            // Update approval request with execution result
            await supabaseClient
              .from('approval_requests')
              .update({
                execution_id: executionResult.execution_id,
                execution_result: executionResult,
                executed_at: new Date().toISOString(),
              })
              .eq('id', approval_request_id)
          }
        } catch (execError) {
          console.error('Tool execution failed:', execError)
          executionResult = { error: 'Execution failed after approval' }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: newStatus,
        approval_request_id,
        execution_result: executionResult,
        message: approved
          ? 'Request approved successfully'
          : 'Request rejected',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: unknown) {
    console.error('Respond to approval error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
