import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { validateAuth } from '../_shared/auth-middleware.ts'
import { DEFAULT_TENANT_ID } from '../_shared/graphify-types.ts'
import {
  getEntityNeighbors,
  getGraphStats,
  getGraphifyConfig,
  logGraphQuery,
  matchEntities,
  traverseGraph,
} from '../_shared/graphify-store.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const auth = await validateAuth(req, supabaseAdmin)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${auth.token}` } } }
    )

    const body = await req.json()
    const {
      mode = 'search',
      query,
      entity_id,
      entity_types,
      relationship_types,
      depth,
      direction = 'both',
      limit = 20,
      offset = 0,
      from_entity_id,
      to_entity_id,
      suggest = false,
    } = body

    const start = Date.now()
    const config = await getGraphifyConfig(supabaseAdmin, DEFAULT_TENANT_ID)
    const tenantId = DEFAULT_TENANT_ID

    if (mode === 'stats') {
      const stats = await getGraphStats(supabaseAdmin, tenantId)
      return new Response(JSON.stringify({ stats, config }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (mode === 'summary' && entity_id) {
      const { data: entity, error: entityError } = await supabase
        .from('graph_entities')
        .select('*')
        .eq('id', entity_id)
        .maybeSingle()

      if (entityError) throw entityError
      if (!entity) {
        return new Response(JSON.stringify({ error: 'Entity not found' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        })
      }

      const neighbors = await getEntityNeighbors(supabase, entity_id, {
        direction,
        relationshipTypes: relationship_types,
        limit,
      })

      const latency_ms = Date.now() - start
      await logGraphQuery(supabaseAdmin, {
        tenant_id: tenantId,
        user_id: auth.user.id,
        query: entity_id,
        query_type: 'summary',
        latency_ms,
        nodes_returned: 1 + neighbors.length,
        edges_traversed: neighbors.length,
      })

      return new Response(
        JSON.stringify({
          entity,
          neighbors,
          neighbor_count: neighbors.length,
          latency_ms,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (mode === 'neighbors' && entity_id) {
      const neighbors = await getEntityNeighbors(supabase, entity_id, {
        direction,
        relationshipTypes: relationship_types,
        limit,
      })

      const latency_ms = Date.now() - start
      await logGraphQuery(supabaseAdmin, {
        tenant_id: tenantId,
        user_id: auth.user.id,
        query: entity_id,
        query_type: 'neighbors',
        latency_ms,
        nodes_returned: neighbors.length,
        edges_traversed: neighbors.length,
      })

      return new Response(
        JSON.stringify({ neighbors, latency_ms, offset, limit }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (mode === 'traverse') {
      const entityIds: string[] = Array.isArray(body.entity_ids)
        ? body.entity_ids.filter((id: unknown) => typeof id === 'string')
        : []
      const seedIds: string[] = entityIds.length > 0
        ? entityIds
        : entity_id
          ? [entity_id]
          : []
      if (seedIds.length === 0 && query) {
        const matched = await matchEntities(supabase, tenantId, query, entity_types, 5)
        seedIds.push(...(matched as Array<{ id: string }>).map((m) => m.id))
      }
      if (seedIds.length === 0) {
        return new Response(JSON.stringify({ error: 'entity_id or query required for traverse' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
      }

      const nodes = await traverseGraph(supabase, tenantId, seedIds, {
        maxDepth: depth ?? config.max_traversal_depth,
        relationshipTypes: relationship_types,
        maxNodes: config.max_nodes_per_query,
        userId: auth.user.id,
      })

      const latency_ms = Date.now() - start
      await logGraphQuery(supabaseAdmin, {
        tenant_id: tenantId,
        user_id: auth.user.id,
        query: query ?? entity_id,
        query_type: 'traverse',
        latency_ms,
        nodes_returned: nodes.length,
        edges_traversed: Math.max(0, nodes.length - seedIds.length),
      })

      return new Response(
        JSON.stringify({ nodes, seed_ids: seedIds, latency_ms, offset, limit }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (mode === 'path' && from_entity_id && to_entity_id) {
      const nodes = await traverseGraph(supabase, tenantId, [from_entity_id], {
        maxDepth: 4,
        maxNodes: config.max_nodes_per_query,
      })
      const pathNode = nodes.find((n) => n.entity_id === to_entity_id)
      const latency_ms = Date.now() - start

      return new Response(
        JSON.stringify({
          found: Boolean(pathNode),
          path: pathNode?.path ?? [],
          latency_ms,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Default: entity search (+ optional context traverse)
    if (!query?.trim()) {
      return new Response(JSON.stringify({ error: 'query is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const entities = await matchEntities(supabase, tenantId, query, entity_types, limit)
    const seedIds = (entities as Array<{ id: string }>).map((e) => e.id).slice(0, 5)

    let context_nodes: unknown[] = []
    if (!suggest && seedIds.length > 0) {
      context_nodes = await traverseGraph(supabase, tenantId, seedIds, {
        maxDepth: depth ?? config.max_traversal_depth,
        relationshipTypes: relationship_types,
        maxNodes: config.max_nodes_per_query,
        userId: auth.user.id,
      })
    }

    const latency_ms = Date.now() - start
    await logGraphQuery(supabaseAdmin, {
      tenant_id: tenantId,
      user_id: auth.user.id,
      query,
      query_type: suggest ? 'suggest' : 'search',
      latency_ms,
      nodes_returned: (entities as unknown[]).length + context_nodes.length,
      edges_traversed: context_nodes.length,
    })

    return new Response(
      JSON.stringify({
        entities,
        context_nodes,
        latency_ms,
        offset,
        limit,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    console.error('[graphify-query]', error)
    const status = (error as { status?: number })?.status ?? 500
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status,
    })
  }
})
