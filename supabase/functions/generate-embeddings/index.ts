import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { generateEmbedding, getModel, logUsage, calculateCost } from '../_shared/ai-provider-routing.ts'
import { chunkText } from '../_shared/chunking/index.ts'
import { loadSourceConfig } from '../_shared/kb-source-config.ts'
import { syncGraphOnIngest } from '../_shared/graphify-ingest.ts'

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
      entity_type,
      entity_id,
      content,
      metadata = {},
      user_id,
      model_id,
      chunk_size,
      chunk_overlap,
      chunk_strategy,
      strategy_config,
      source_id,
      unified_document_id,
      skip_delete = false,
      // Citation metadata from kb-document-parser
      // Array aligned with chunk positions: citations[i] applies to chunk i
      page_citations,
    } = await req.json()

    if (!entity_type || !entity_id || !content) {
      return new Response(
        JSON.stringify({ error: 'entity_type, entity_id, and content are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const sourceConfig = await loadSourceConfig(supabaseClient, source_id)
    const chunkingConfig = {
      chunk_size: chunk_size ?? sourceConfig.chunk_size,
      chunk_overlap: chunk_overlap ?? sourceConfig.chunk_overlap,
      chunk_strategy: chunk_strategy ?? sourceConfig.chunk_strategy,
      strategy_config: strategy_config ?? sourceConfig.strategy_config,
    }

    const model = await getModel(supabaseClient, model_id, 'embedding')
    if (!model) {
      throw new Error('No valid embedding model found')
    }

    if (!skip_delete) {
      await supabaseClient
        .from('embeddings')
        .delete()
        .eq('entity_type', entity_type)
        .eq('entity_id', entity_id)
    }

    const chunks = chunkText(content, chunkingConfig)
    const embeddings = []
    let totalTokens = 0

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const response = await generateEmbedding(supabaseClient, chunk.content, model_id)

      // Attach per-chunk citation when page_citations array is provided
      const citationMeta = Array.isArray(page_citations) && page_citations[i]
        ? {
            citation_page: page_citations[i].page ?? null,
            citation_heading: page_citations[i].heading ?? null,
            citation_section: page_citations[i].section ?? null,
          }
        : {}

      embeddings.push({
        entity_type,
        entity_id,
        user_id: user_id || null,
        unified_document_id: unified_document_id || null,
        content: chunk.content,
        chunk_index: chunk.chunk_index ?? i,
        metadata: { ...metadata, ...(chunk.metadata ?? {}), ...citationMeta },
        embedding: response.embedding,
      })

      totalTokens += response.tokens
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    const totalCost = calculateCost(model, 0, 0, totalTokens)

    await logUsage(
      supabaseClient,
      user_id,
      model.id,
      'generate-embeddings',
      0,
      0,
      totalTokens,
      totalCost
    )

    const { data, error } = await supabaseClient
      .from('embeddings')
      .insert(embeddings)
      .select()

    if (error) throw error

    const graphify = await syncGraphOnIngest(supabaseClient, {
      entity_type,
      entity_id,
      content,
      metadata,
      user_id,
    })

    return new Response(
      JSON.stringify({
        success: true,
        embeddings_created: data.length,
        chunks_processed: chunks.length,
        total_tokens: totalTokens,
        estimated_cost: totalCost,
        model_used: model.name,
        chunk_strategy: chunkingConfig.chunk_strategy,
        graphify,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    console.error('Generate embeddings error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
