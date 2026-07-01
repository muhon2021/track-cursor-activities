import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { performRetrieval, logVectorSearch } from '../_shared/rag-retrieval.ts'
import { chatCompletion, logUsage } from '../_shared/ai-provider-routing.ts'
import { requireAdmin } from '../_shared/admin-auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const adminCheck = await requireAdmin(req, supabase, corsHeaders)
    if (adminCheck instanceof Response) return adminCheck
    const { userId } = adminCheck

    const {
      query,
      source_id,
      match_threshold = 0.5,
      match_count = 10,
      generate_answer = true,
      save_run = false,
      save_test_case = false,
      expected_answer,
    } = await req.json()

    if (!query) {
      return new Response(
        JSON.stringify({ error: 'query is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const totalStart = Date.now()
    const retrieval = await performRetrieval(supabase, {
      query,
      match_threshold,
      match_count,
      source_id,
    })

    let answer: string | undefined
    let generation_latency_ms = 0
    let generation_cost = 0
    const citations: { chunk_id: string; index: number }[] = []

    if (generate_answer && retrieval.results.length > 0) {
      const genStart = Date.now()
      const contextChunks = retrieval.results
        .map((r, i) => {
          citations.push({ chunk_id: r.id, index: i + 1 })
          const score = r.rerank_score ?? r.similarity
          return `[${i + 1}] (score: ${score.toFixed(3)})\n${r.content}`
        })
        .join('\n\n---\n\n')

      const chatResult = await chatCompletion(supabase, {
        messages: [
          {
            role: 'system',
            content: 'Answer based ONLY on the provided context. Cite chunk numbers [1], [2], etc.',
          },
          { role: 'user', content: `Question: ${query}\n\nContext:\n${contextChunks}` },
        ],
        temperature: 0.3,
        max_tokens: 1500,
      })
      answer = chatResult.content
      generation_latency_ms = Date.now() - genStart
      generation_cost = 0
      await logUsage(supabase, userId, null, 'kb-rag-playground', chatResult.input_tokens, chatResult.output_tokens, 0, 0)
    }

    const total_latency_ms = Date.now() - totalStart
    const total_cost = retrieval.rerank_cost + generation_cost

    let run_id: string | undefined
    if (save_run) {
      const { data: run } = await supabase.from('kb_eval_runs').insert({
        query,
        answer: answer ?? null,
        retrieval_latency_ms: retrieval.retrieval_latency_ms,
        rerank_latency_ms: retrieval.rerank_latency_ms,
        generation_latency_ms,
        latency_ms: total_latency_ms,
        cost: total_cost,
        source_id: source_id ?? null,
        created_by: userId,
        metadata: { reranked: retrieval.reranked },
      }).select('id').single()

      run_id = run?.id
      if (run_id) {
        const resultRows = retrieval.results.map((r) => ({
          run_id,
          chunk_id: r.id,
          chunk_preview: r.content.slice(0, 500),
          similarity_score: r.similarity,
          rerank_score: r.rerank_score ?? null,
          source_name: (r.metadata as Record<string, string>)?.title ?? r.entity_type,
        }))
        await supabase.from('kb_eval_results').insert(resultRows)
      }
    }

    if (save_test_case && run_id) {
      await supabase.from('kb_eval_test_cases').insert({
        question: query,
        expected_answer: expected_answer ?? null,
        run_id,
        created_by: userId,
      })
    }

    await logVectorSearch(supabase, {
      user_id: userId,
      query,
      result_count: retrieval.results.length,
      duration_ms: total_latency_ms,
      search_type: 'playground',
      metadata: { run_id, reranked: retrieval.reranked },
    })

    return new Response(
      JSON.stringify({
        success: true,
        retrieved_chunks: retrieval.results.map((r) => ({
          chunk_id: r.id,
          content: r.content,
          source: r.entity_type,
          similarity_score: r.similarity,
          rerank_score: r.rerank_score,
        })),
        reranked_results: retrieval.reranked
          ? retrieval.results.map((r) => ({
              chunk_id: r.id,
              original_score: r.similarity,
              reranked_score: r.rerank_score,
            }))
          : [],
        answer,
        citations,
        metrics: {
          retrieval_latency_ms: retrieval.retrieval_latency_ms,
          rerank_latency_ms: retrieval.rerank_latency_ms,
          generation_latency_ms,
          total_latency_ms,
          total_cost,
        },
        run_id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
