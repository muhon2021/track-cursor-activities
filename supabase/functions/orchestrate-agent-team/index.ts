/**
 * Orchestrate Agent Team Edge Function
 *
 * Coordinates multiple agents working together on complex tasks.
 * Handles agent handoffs, parallel execution, and consensus building.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface OrchestrationRequest {
  team_id: string
  user_id: string
  goal: string
  session_type?: 'task_delegation' | 'consensus_building' | 'parallel_execution' | 'review_chain'
  initial_context?: Record<string, any>
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

    const body: OrchestrationRequest = await req.json()
    const { team_id, user_id, goal, session_type = 'task_delegation', initial_context = {} } = body

    if (!team_id || !user_id || !goal) {
      return new Response(
        JSON.stringify({ error: 'team_id, user_id, and goal are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Get team configuration
    const { data: team, error: teamError } = await supabaseClient
      .from('agent_teams')
      .select(`
        *,
        members:agent_team_members(
          *,
          agent:ai_agents(*)
        )
      `)
      .eq('id', team_id)
      .eq('is_active', true)
      .single()

    if (teamError || !team) {
      return new Response(
        JSON.stringify({ error: 'Team not found or not active' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    if (!team.members || team.members.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Team has no active members' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Create collaboration session
    const { data: session, error: sessionError } = await supabaseClient
      .from('agent_collaboration_sessions')
      .insert({
        team_id,
        user_id,
        goal,
        session_type,
        status: 'active',
        session_context: initial_context,
      })
      .select()
      .single()

    if (sessionError) {
      console.error('Failed to create collaboration session:', sessionError)
      throw new Error('Failed to create collaboration session')
    }

    // Determine orchestration strategy
    const strategy = team.collaboration_strategy || session_type

    let orchestrationResult: any

    switch (strategy) {
      case 'sequential':
        orchestrationResult = await orchestrateSequential(supabaseClient, session, team, goal)
        break

      case 'parallel':
        orchestrationResult = await orchestrateParallel(supabaseClient, session, team, goal)
        break

      case 'hierarchical':
        orchestrationResult = await orchestrateHierarchical(supabaseClient, session, team, goal)
        break

      case 'consensus':
        orchestrationResult = await orchestrateConsensus(supabaseClient, session, team, goal)
        break

      default:
        orchestrationResult = await orchestrateSequential(supabaseClient, session, team, goal)
    }

    return new Response(
      JSON.stringify({
        success: true,
        session_id: session.id,
        strategy,
        ...orchestrationResult,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: unknown) {
    console.error('Orchestration error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

/**
 * Sequential orchestration: Agents work one after another
 */
async function orchestrateSequential(
  supabase: any,
  session: any,
  team: any,
  goal: string
) {
  // Sort agents by priority order
  const sortedAgents = team.members
    .filter((m: any) => m.is_active)
    .sort((a: any, b: any) => a.priority_order - b.priority_order)

  if (sortedAgents.length === 0) {
    throw new Error('No active agents in team')
  }

  // Start with first agent
  const firstAgent = sortedAgents[0].agent

  // Update session with current agent
  await supabase
    .from('agent_collaboration_sessions')
    .update({
      current_agent_id: firstAgent.id,
      current_stage: 'agent_1',
    })
    .eq('id', session.id)

  // Create initial message
  await supabase
    .from('agent_collaboration_messages')
    .insert({
      session_id: session.id,
      from_agent_id: null, // From user/system
      to_agent_id: firstAgent.id,
      message_type: 'request',
      content: goal,
      requires_response: true,
    })

  return {
    message: 'Sequential orchestration started',
    current_agent: {
      id: firstAgent.id,
      name: firstAgent.name,
    },
    total_agents: sortedAgents.length,
    next_steps: sortedAgents.slice(1).map((m: any) => ({
      id: m.agent.id,
      name: m.agent.name,
      role: m.role,
    })),
  }
}

/**
 * Parallel orchestration: Multiple agents work simultaneously
 */
async function orchestrateParallel(
  supabase: any,
  session: any,
  team: any,
  goal: string
) {
  const activeAgents = team.members.filter((m: any) => m.is_active)

  // Create tasks for each agent
  const messages = await Promise.all(
    activeAgents.map(async (member: any) => {
      return await supabase
        .from('agent_collaboration_messages')
        .insert({
          session_id: session.id,
          from_agent_id: null,
          to_agent_id: member.agent.id,
          message_type: 'request',
          content: `${goal}\n\nYour expertise: ${member.expertise_tags?.join(', ') || 'General'}`,
          requires_response: true,
        })
        .select()
        .single()
    })
  )

  return {
    message: 'Parallel orchestration started',
    agents_working: activeAgents.map((m: any) => ({
      id: m.agent.id,
      name: m.agent.name,
      expertise: m.expertise_tags,
    })),
    total_agents: activeAgents.length,
  }
}

/**
 * Hierarchical orchestration: Coordinator agent delegates to specialists
 */
async function orchestrateHierarchical(
  supabase: any,
  session: any,
  team: any,
  goal: string
) {
  // Find coordinator agent
  const coordinator = team.coordinator_agent_id
    ? team.members.find((m: any) => m.agent.id === team.coordinator_agent_id)?.agent
    : team.members.find((m: any) => m.role === 'lead')?.agent

  if (!coordinator) {
    throw new Error('No coordinator agent found for hierarchical orchestration')
  }

  // Update session
  await supabase
    .from('agent_collaboration_sessions')
    .update({
      current_agent_id: coordinator.id,
      current_stage: 'coordinator_planning',
    })
    .eq('id', session.id)

  // Send goal to coordinator
  await supabase
    .from('agent_collaboration_messages')
    .insert({
      session_id: session.id,
      from_agent_id: null,
      to_agent_id: coordinator.id,
      message_type: 'request',
      content: `As team coordinator, plan how to achieve this goal:\n\n${goal}\n\nAvailable team members:\n${team.members.map((m: any) => `- ${m.agent.name}: ${m.expertise_tags?.join(', ') || 'General'}`).join('\n')}`,
      requires_response: true,
    })

  return {
    message: 'Hierarchical orchestration started',
    coordinator: {
      id: coordinator.id,
      name: coordinator.name,
    },
    available_specialists: team.members
      .filter((m: any) => m.agent.id !== coordinator.id && m.is_active)
      .map((m: any) => ({
        id: m.agent.id,
        name: m.agent.name,
        expertise: m.expertise_tags,
      })),
  }
}

/**
 * Consensus orchestration: Agents discuss and reach agreement
 */
async function orchestrateConsensus(
  supabase: any,
  session: any,
  team: any,
  goal: string
) {
  const activeAgents = team.members.filter((m: any) => m.is_active)

  if (activeAgents.length < 2) {
    throw new Error('Consensus requires at least 2 agents')
  }

  // Update session
  await supabase
    .from('agent_collaboration_sessions')
    .update({
      current_stage: 'initial_proposals',
    })
    .eq('id', session.id)

  // Request initial proposals from all agents
  await Promise.all(
    activeAgents.map(async (member: any) => {
      return await supabase
        .from('agent_collaboration_messages')
        .insert({
          session_id: session.id,
          from_agent_id: null,
          to_agent_id: member.agent.id,
          message_type: 'request',
          content: `Provide your initial proposal for:\n\n${goal}\n\nOther agents will review and we'll work toward consensus.`,
          requires_response: true,
          metadata: { stage: 'proposal' },
        })
    })
  )

  return {
    message: 'Consensus orchestration started',
    participating_agents: activeAgents.map((m: any) => ({
      id: m.agent.id,
      name: m.agent.name,
      expertise: m.expertise_tags,
    })),
    consensus_stages: ['initial_proposals', 'discussion', 'refinement', 'final_vote'],
  }
}
