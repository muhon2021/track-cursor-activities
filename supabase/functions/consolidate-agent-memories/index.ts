/**
 * Consolidate Agent Memories Edge Function
 *
 * Background maintenance for agent memory system:
 * - Consolidates old short-term memories into long-term
 * - Prunes low-value, rarely-accessed memories
 * - Boosts importance of frequently accessed memories
 * - Updates memory statistics
 *
 * This should be run periodically (e.g., daily via cron job)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ConsolidateRequest {
  agent_id?: string // If not provided, consolidates for all agents
  user_id?: string // If not provided, consolidates for all users
  consolidation_age_days?: number // Age threshold for consolidation (default: 7)
  pruning_age_days?: number // Age threshold for pruning (default: 30)
  importance_threshold?: number // Importance threshold for pruning (default: 0.2)
  dry_run?: boolean // If true, only reports what would be done
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

    const {
      agent_id,
      user_id,
      consolidation_age_days = 7,
      pruning_age_days = 30,
      importance_threshold = 0.2,
      dry_run = false,
    }: ConsolidateRequest = await req.json()

    const results = {
      consolidated_count: 0,
      pruned_count: 0,
      boosted_count: 0,
      dry_run,
      operations: [] as string[],
    }

    // Get agents to process
    let agents: any[] = []
    if (agent_id && user_id) {
      // Process specific agent for specific user
      agents = [{ agent_id, user_id }]
    } else if (agent_id) {
      // Get all users for this agent
      const { data } = await supabaseClient
        .from('agent_memories')
        .select('agent_id, user_id')
        .eq('agent_id', agent_id)
        .eq('is_active', true)

      if (data) {
        // Get unique agent-user pairs
        const uniquePairs = new Map()
        data.forEach(m => uniquePairs.set(`${m.agent_id}-${m.user_id}`, { agent_id: m.agent_id, user_id: m.user_id }))
        agents = Array.from(uniquePairs.values())
      }
    } else {
      // Get all active agent-user pairs
      const { data } = await supabaseClient
        .from('agent_memories')
        .select('agent_id, user_id')
        .eq('is_active', true)

      if (data) {
        const uniquePairs = new Map()
        data.forEach(m => uniquePairs.set(`${m.agent_id}-${m.user_id}`, { agent_id: m.agent_id, user_id: m.user_id }))
        agents = Array.from(uniquePairs.values())
      }
    }

    console.log(`Processing ${agents.length} agent-user pairs`)

    // Process each agent-user pair
    for (const pair of agents) {
      try {
        // 1. Consolidate short-term memories
        if (!dry_run) {
          const { data, error } = await supabaseClient.rpc(
            'consolidate_short_term_memories',
            {
              p_agent_id: pair.agent_id,
              p_user_id: pair.user_id,
              p_days_old: consolidation_age_days,
            }
          )

          if (!error && data) {
            results.consolidated_count += data
            if (data > 0) {
              results.operations.push(
                `Consolidated ${data} memories for agent ${pair.agent_id.slice(0, 8)}`
              )
            }
          }
        } else {
          // Dry run: count what would be consolidated
          const cutoffDate = new Date()
          cutoffDate.setDate(cutoffDate.getDate() - consolidation_age_days)

          const { count } = await supabaseClient
            .from('agent_memories')
            .select('*', { count: 'exact', head: true })
            .eq('agent_id', pair.agent_id)
            .eq('user_id', pair.user_id)
            .eq('memory_type', 'short_term')
            .eq('is_active', true)
            .lt('created_at', cutoffDate.toISOString())
            .gte('importance_score', 0.3)
            .gt('access_count', 0)

          if (count && count > 0) {
            results.operations.push(
              `Would consolidate ${count} memories for agent ${pair.agent_id.slice(0, 8)}`
            )
          }
        }

        // 2. Prune low-value memories
        if (!dry_run) {
          const { data, error } = await supabaseClient.rpc(
            'prune_short_term_memories',
            {
              p_agent_id: pair.agent_id,
              p_user_id: pair.user_id,
              p_days_old: pruning_age_days,
              p_importance_threshold: importance_threshold,
            }
          )

          if (!error && data) {
            results.pruned_count += data
            if (data > 0) {
              results.operations.push(
                `Pruned ${data} low-value memories for agent ${pair.agent_id.slice(0, 8)}`
              )
            }
          }
        } else {
          // Dry run: count what would be pruned
          const cutoffDate = new Date()
          cutoffDate.setDate(cutoffDate.getDate() - pruning_age_days)

          const { count } = await supabaseClient
            .from('agent_memories')
            .select('*', { count: 'exact', head: true })
            .eq('agent_id', pair.agent_id)
            .eq('user_id', pair.user_id)
            .eq('memory_type', 'short_term')
            .eq('is_active', true)
            .lt('created_at', cutoffDate.toISOString())
            .lt('importance_score', importance_threshold)
            .lt('access_count', 2)

          if (count && count > 0) {
            results.operations.push(
              `Would prune ${count} memories for agent ${pair.agent_id.slice(0, 8)}`
            )
          }
        }

        // 3. Boost frequently accessed memories
        if (!dry_run) {
          const { data: frequentMemories } = await supabaseClient
            .from('agent_memories')
            .select('id, importance_score, access_count')
            .eq('agent_id', pair.agent_id)
            .eq('user_id', pair.user_id)
            .eq('is_active', true)
            .gt('access_count', 5) // Accessed more than 5 times
            .lt('importance_score', 0.9) // Not already at max

          if (frequentMemories && frequentMemories.length > 0) {
            for (const memory of frequentMemories) {
              // Boost importance based on access count
              const boostAmount = Math.min(0.1, memory.access_count / 100)

              await supabaseClient.rpc('boost_memory_importance', {
                p_memory_id: memory.id,
                p_boost_amount: boostAmount,
              })

              results.boosted_count++
            }

            if (frequentMemories.length > 0) {
              results.operations.push(
                `Boosted ${frequentMemories.length} frequently-accessed memories for agent ${pair.agent_id.slice(0, 8)}`
              )
            }
          }
        }

      } catch (pairError) {
        console.error(`Error processing agent ${pair.agent_id}:`, pairError)
        results.operations.push(
          `Error processing agent ${pair.agent_id.slice(0, 8)}: ${pairError instanceof Error ? pairError.message : 'Unknown error'}`
        )
      }
    }

    // 4. Generate statistics
    const { data: stats } = await supabaseClient
      .from('agent_memory_stats')
      .select('*')
      .limit(10)

    return new Response(
      JSON.stringify({
        success: true,
        ...results,
        statistics: stats || [],
        processed_agents: agents.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: unknown) {
    console.error('Consolidate memories error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
