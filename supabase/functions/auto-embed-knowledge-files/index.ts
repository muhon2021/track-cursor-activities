/**
 * auto-embed-knowledge-files
 *
 * Org-level knowledge file processor. Routes each file through
 * kb-document-parser (which handles type detection, OCR, structured
 * extraction, and embedding generation) instead of raw Blob.text().
 *
 * Fixes from original:
 * - Column name: file_path → storage_path
 * - Column names: is_indexed, indexed_at, embedding_count, error_message
 *                 → processing_status, processed_at, chunk_count, processing_error
 */

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

    // Respect pipeline kill switch
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

    const body = await req.json().catch(() => ({}))
    const batchSize = Math.min(Math.max(1, Number(body?.batch_size) || 10), 50)
    const retryFailed = Boolean(body?.retry_failed)

    let query = supabaseClient
      .from('knowledge_files')
      .select('id, file_name, storage_path, source_id, file_type, processing_status')
      .limit(batchSize)

    if (retryFailed) {
      query = query.or('processing_status.eq.pending,processing_status.eq.failed')
    } else {
      query = query.or('processing_status.eq.pending,processing_status.is.null')
    }

    const { data: files } = await query

    if (!files || files.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No files to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    let processedCount = 0

    for (const file of files) {
      try {
        if (!file.storage_path) {
          await supabaseClient
            .from('knowledge_files')
            .update({ processing_status: 'failed', processing_error: 'No storage_path' })
            .eq('id', file.id)
          continue
        }

        // Route through kb-document-parser
        const response = await fetch(`${SUPABASE_URL}/functions/v1/kb-document-parser`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SERVICE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            source_type: 'knowledge_file',
            source_id: file.id,
          }),
        })

        if (response.ok) {
          processedCount++
        } else {
          const errBody = await response.json().catch(() => ({ error: response.statusText }))
          await supabaseClient
            .from('knowledge_files')
            .update({
              processing_status: 'failed',
              processing_error: errBody.error ?? 'Parser returned non-200',
            })
            .eq('id', file.id)
        }
      } catch (error: unknown) {
        console.error(`Error processing knowledge_file ${file.id}:`, error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        await supabaseClient
          .from('knowledge_files')
          .update({ processing_status: 'failed', processing_error: errorMessage })
          .eq('id', file.id)
      }

      // Rate limit: 1 request per second
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed_count: processedCount,
        total_found: files.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    console.error('Auto embed knowledge files error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
