/**
 * Gemini RAG Query Edge Function — shared retrieval pipeline with optional Graphify hybrid search.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { chatCompletion, logUsage } from '../_shared/ai-provider-routing.ts'
import { performRetrieval, logVectorSearch } from '../_shared/rag-retrieval.ts'
import { performGraphAwareRetrieval } from '../_shared/graphify-context.ts'
import { isGraphifyFeatureEnabled } from '../_shared/graphify-store.ts'
import { resolveGraphAuthClient } from '../_shared/graphify-auth-client.ts'

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

    const {
      query,
      corpus_id,
      user_id,
      match_count = 10,
      match_threshold = 0.7,
      generate_answer = true,
      entity_type,
      source_id,
      use_graphify,
      graphify,
    } = await req.json()

    if (!query) {
      return new Response(
        JSON.stringify({ error: 'query is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const start = Date.now()
    const graphifyEnabled = await isGraphifyFeatureEnabled(supabaseClient)
    const useGraph = graphifyEnabled && (use_graphify === true || graphify?.enabled === true)
    const graphAuthClient = resolveGraphAuthClient(req, supabaseClient)

    const retrieval = useGraph
      ? await performGraphAwareRetrieval(supabaseClient, {
          query,
          match_threshold,
          match_count,
          entity_type,
          user_id,
          source_id,
          graphify: {
            enabled: true,
            auth_client: graphAuthClient,
            ...(graphify ?? {}),
          },
        })
      : await performRetrieval(supabaseClient, {
          query,
          match_threshold,
          match_count,
          entity_type,
          user_id,
          source_id,
        })

    const results = retrieval.results
    const graphContext = 'graph_context' in retrieval ? retrieval.graph_context : ''
    let answer: string | undefined
    let answerTokens = { input: 0, output: 0 }

    if (generate_answer && results.length > 0) {
      const contextChunks = results
        .map((r, i) => {
          const score = r.rerank_score ?? r.similarity
          return `[${i + 1}] (score: ${score.toFixed(3)}, type: ${r.entity_type})\n${r.content}`
        })
        .join('\n\n---\n\n')

      const graphBlock = graphContext ? `\n\nKnowledge graph context:\n${graphContext}\n` : ''

      const chatResult = await chatCompletion(supabaseClient, {
        messages: [
          {
            role: 'system',
            content: `You are a helpful knowledge assistant. Answer based ONLY on the provided context. Cite chunk numbers [1], [2], etc. When graph context lists related entities, use it to improve relevance but still cite document chunks.`,
          },
          { role: 'user', content: `Question: ${query}${graphBlock}\n\nContext:\n${contextChunks}` },
        ],
        temperature: 0.3,
        max_tokens: 1500,
      })

      answer = chatResult.content
      answerTokens = { input: chatResult.input_tokens, output: chatResult.output_tokens }
    }

    const durationMs = Date.now() - start

    await supabaseClient.from('gemini_query_logs').insert({
      corpus_id: corpus_id ?? null,
      user_id: user_id ?? null,
      query_text: query,
      result_count: results.length,
      duration_ms: durationMs,
      metadata: {
        match_threshold,
        match_count,
        entity_type: entity_type || null,
        generated_answer: !!answer,
        reranked: retrieval.reranked,
        retrieval_latency_ms: retrieval.retrieval_latency_ms,
        rerank_latency_ms: retrieval.rerank_latency_ms,
        graphify: useGraph,
        graph_latency_ms: 'graph_latency_ms' in retrieval ? retrieval.graph_latency_ms : undefined,
      },
    })

    await logVectorSearch(supabaseClient, {
      user_id,
      query,
      result_count: results.length,
      duration_ms: durationMs,
      search_type: 'gemini-rag',
    })

    await logUsage(supabaseClient, user_id || null, null, 'gemini-rag-query', answerTokens.input, answerTokens.output, 0, retrieval.rerank_cost)

    return new Response(
      JSON.stringify({
        success: true,
        query,
        results: results.map((r) => ({
          id: r.id,
          entity_type: r.entity_type,
          entity_id: r.entity_id,
          content: r.content,
          metadata: r.metadata,
          similarity: r.similarity,
          rerank_score: r.rerank_score,
          unified_document_id: r.unified_document_id,
        })),
        answer,
        result_count: results.length,
        duration_ms: durationMs,
        retrieval_latency_ms: retrieval.retrieval_latency_ms,
        rerank_latency_ms: retrieval.rerank_latency_ms,
        reranked: retrieval.reranked,
        graph_context: graphContext || undefined,
        graph_entities: 'graph_entities' in retrieval ? retrieval.graph_entities : undefined,
        graph_latency_ms: 'graph_latency_ms' in retrieval ? retrieval.graph_latency_ms : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    console.error('gemini-rag-query error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
