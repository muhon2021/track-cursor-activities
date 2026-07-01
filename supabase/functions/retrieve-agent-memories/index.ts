/**
 * Retrieve Agent Memories Edge Function
 *
 * Semantic search for relevant agent memories using vector similarity.
 * Supports filtering by memory type, recency, and importance.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RetrieveMemoriesRequest {
  agent_id: string
  user_id: string
  query: string
  memory_types?: string[] // ['short_term', 'long_term', 'episodic', 'semantic']
  memory_categories?: string[] // ['preference', 'fact', 'skill', 'goal', etc.]
  limit?: number
  similarity_threshold?: number
  include_recent?: boolean // If true, also returns recent memories regardless of similarity
  recent_days?: number
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
      query,
      memory_types = ['short_term', 'long_term', 'episodic'],
      memory_categories,
      limit = 10,
      similarity_threshold = 0.7,
      include_recent = true,
      recent_days = 7,
    }: RetrieveMemoriesRequest = await req.json()

    if (!agent_id || !user_id || !query) {
      return new Response(
        JSON.stringify({ error: 'agent_id, user_id, and query are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Generate embedding for the query
    let queryEmbedding: number[] | null = null

    try {
      const embeddingResponse = await fetch(
        `${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-embeddings`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: query, user_id }),
        }
      )

      if (embeddingResponse.ok) {
        const embeddingData = await embeddingResponse.json()
        queryEmbedding = embeddingData?.embedding || null
      }
    } catch (embError) {
      console.error('Embedding generation error:', embError)
      // Continue without semantic search - will fall back to recent only
    }

    let semanticMemories: any[] = []
    let recentMemories: any[] = []

    // Semantic search using vector similarity
    if (queryEmbedding) {
      try {
        // Use the database function for semantic search
        const { data, error } = await supabaseClient.rpc(
          'get_relevant_memories',
          {
            p_agent_id: agent_id,
            p_user_id: user_id,
            p_query_embedding: `[${queryEmbedding.join(',')}]`,
            p_memory_types: memory_types,
            p_limit: limit,
            p_similarity_threshold: similarity_threshold,
          }
        )

        if (!error && data) {
          semanticMemories = data.map((m: any) => ({
            ...m,
            retrieval_method: 'semantic',
          }))
        } else if (error) {
          console.error('Semantic search error:', error)
        }
      } catch (searchError) {
        console.error('Semantic search failed:', searchError)
      }
    }

    // Also retrieve recent memories if requested
    if (include_recent) {
      const sinceDate = new Date()
      sinceDate.setDate(sinceDate.getDate() - recent_days)

      let recentQuery = supabaseClient
        .from('agent_memories')
        .select('id, content, summary, memory_type, memory_category, importance_score, created_at')
        .eq('agent_id', agent_id)
        .eq('user_id', user_id)
        .eq('is_active', true)
        .in('memory_type', memory_types)
        .gte('created_at', sinceDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(Math.max(5, Math.floor(limit / 2)))

      if (memory_categories && memory_categories.length > 0) {
        recentQuery = recentQuery.in('memory_category', memory_categories)
      }

      const { data, error } = await recentQuery

      if (!error && data) {
        recentMemories = data.map((m: any) => ({
          memory_id: m.id,
          content: m.content,
          summary: m.summary,
          memory_type: m.memory_type,
          memory_category: m.memory_category,
          importance_score: m.importance_score,
          created_at: m.created_at,
          similarity: null, // No similarity score for recent memories
          retrieval_method: 'recent',
        }))
      }
    }

    // Combine and deduplicate memories
    const memoryMap = new Map()

    // Add semantic memories first (higher priority)
    for (const memory of semanticMemories) {
      memoryMap.set(memory.memory_id, memory)
    }

    // Add recent memories that aren't already included
    for (const memory of recentMemories) {
      if (!memoryMap.has(memory.memory_id)) {
        memoryMap.set(memory.memory_id, memory)
      }
    }

    const allMemories = Array.from(memoryMap.values())

    // Sort by importance and recency
    allMemories.sort((a, b) => {
      // Semantic matches with high similarity get priority
      if (a.similarity && b.similarity) {
        return b.similarity - a.similarity
      }
      if (a.similarity) return -1
      if (b.similarity) return 1

      // Then by importance score
      const importanceDiff = (b.importance_score || 0) - (a.importance_score || 0)
      if (Math.abs(importanceDiff) > 0.1) {
        return importanceDiff
      }

      // Finally by recency
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

    // Limit results
    const limitedMemories = allMemories.slice(0, limit)

    // Update access statistics for retrieved memories
    const memoryIds = limitedMemories.map(m => m.memory_id)
    if (memoryIds.length > 0) {
      // Use PostgreSQL function to increment access count and update last_accessed_at atomically
      await supabaseClient.rpc('increment_memory_access' as never, {
        memory_ids: memoryIds
      } as never)
    }

    return new Response(
      JSON.stringify({
        memories: limitedMemories,
        total_count: allMemories.length,
        semantic_count: semanticMemories.length,
        recent_count: recentMemories.filter(m => !semanticMemories.find(s => s.memory_id === m.memory_id)).length,
        query,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: unknown) {
    console.error('Retrieve memories error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
