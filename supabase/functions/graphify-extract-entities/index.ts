import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { DEFAULT_TENANT_ID } from '../_shared/graphify-types.ts'
import { getGraphifyConfig } from '../_shared/graphify-store.ts'
import { extractTopicEntitiesFromText } from '../_shared/graphify-extraction.ts'

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

    const { source_table, source_id, text } = await req.json()

    if (!source_table || !source_id || !text?.trim()) {
      return new Response(
        JSON.stringify({ error: 'source_table, source_id, and text are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const config = await getGraphifyConfig(supabaseAdmin, DEFAULT_TENANT_ID)
    if (!config.entity_extraction_enabled) {
      return new Response(
        JSON.stringify({ extracted: [], message: 'Entity extraction disabled in graphify_config' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const extracted = await extractTopicEntitiesFromText(
      supabaseAdmin,
      DEFAULT_TENANT_ID,
      text,
      source_table,
      source_id
    )

    return new Response(
      JSON.stringify({ extracted, count: extracted.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    console.error('[graphify-extract-entities]', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
