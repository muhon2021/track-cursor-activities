import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

    const { data: setting } = await supabaseClient
      .from('system_settings')
      .select('value')
      .eq('category', 'ai')
      .eq('key', 'embedding_processing_enabled')
      .maybeSingle()
    const enabled = setting?.value === true || setting?.value === 'true' || setting?.value === '"true"'
    if (!enabled) {
      return new Response(
        JSON.stringify({ error: 'Embedding pipeline is disabled', code: 'PIPELINE_DISABLED' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 503 }
      )
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured')
    }

    const body = await req.json().catch(() => ({}))
    const batchSize = Math.min(Math.max(1, Number(body?.batch_size) || 10), 50)
    const retryFailed = Boolean(body?.retry_failed)

    let query = supabaseClient
      .from('zoom_files')
      .select('*')
      .eq('is_processed', true)
      .not('transcript_text', 'is', null)
      .limit(batchSize)

    if (retryFailed) {
      query = query.or('has_embeddings.eq.false,processing_status.eq.failed')
    } else {
      query = query.eq('has_embeddings', false)
    }

    const { data: files } = await query

    if (!files || files.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No files to process', processed_count: 0, total_found: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    let processedCount = 0
    let graphifySynced = 0

    for (const file of files) {
      const metadata = {
        meeting_topic: file.meeting_topic,
        meeting_date: file.meeting_start_time,
        meeting_id: file.meeting_id ?? undefined,
      }

      // Call generate-embeddings function
      const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-embeddings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entity_type: 'meeting_transcript',
          entity_id: file.id,
          content: file.transcript_text,
          metadata,
        }),
      })

      if (response.ok) {
        const result = await response.json().catch(() => ({}))
        if (result?.graphify && !result.graphify.skipped) {
          graphifySynced++
        }

        await supabaseClient
          .from('zoom_files')
          .update({ has_embeddings: true, processing_status: 'completed' })
          .eq('id', file.id)

        processedCount++
      } else {
        await supabaseClient
          .from('zoom_files')
          .update({ processing_status: 'failed' })
          .eq('id', file.id)
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed_count: processedCount,
        total_found: files.length,
        graphify_synced: graphifySynced,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    console.error('Auto embed meetings error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
