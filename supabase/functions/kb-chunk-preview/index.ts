import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { chunkText, estimateEmbeddingCost } from '../_shared/chunking/index.ts'
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

    const { sample_text, chunk_size, chunk_overlap, chunk_strategy, strategy_config } = await req.json()

    if (!sample_text || typeof sample_text !== 'string') {
      return new Response(
        JSON.stringify({ error: 'sample_text is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const chunks = chunkText(sample_text, {
      chunk_size: chunk_size ?? 1000,
      chunk_overlap: chunk_overlap ?? 100,
      chunk_strategy: chunk_strategy ?? 'fixed',
      strategy_config: strategy_config ?? {},
    })

    const avgChars = chunks.reduce((s, c) => s + c.content.length, 0) / Math.max(chunks.length, 1)
    const estimated_cost = estimateEmbeddingCost(chunks.length, avgChars)

    return new Response(
      JSON.stringify({
        success: true,
        estimated_chunks: chunks.length,
        estimated_cost,
        preview: chunks.slice(0, 5).map((c) => ({
          chunk_index: c.chunk_index,
          content: c.content.slice(0, 300) + (c.content.length > 300 ? '...' : ''),
          metadata: c.metadata ?? {},
        })),
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
