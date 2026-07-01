/**
 * user-knowledge-process
 *
 * Personal file processor for user-uploaded knowledge files.
 * Routes each file through kb-document-parser instead of raw Blob.text().
 * Handles both unified_documents (owner_type = user) and user_knowledge_files.
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

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    // Prefer unified_documents (owner_type = user) first
    const { data: unifiedFiles } = await supabaseClient
      .from('unified_documents')
      .select('id, owner_id, storage_path, file_name, title, processing_status')
      .eq('owner_type', 'user')
      .eq('processing_status', 'pending')
      .limit(5)

    type FileEntry = {
      id: string
      sourceType: 'unified_document' | 'user_knowledge_file'
    }

    let filesToProcess: FileEntry[] = []

    if (unifiedFiles && unifiedFiles.length > 0) {
      filesToProcess = unifiedFiles.map((f) => ({
        id: f.id,
        sourceType: 'unified_document' as const,
      }))
    } else {
      const { data: ukFiles } = await supabaseClient
        .from('user_knowledge_files')
        .select('id, user_id, processing_status')
        .eq('processing_status', 'pending')
        .limit(5)

      if (ukFiles && ukFiles.length > 0) {
        filesToProcess = ukFiles.map((f) => ({
          id: f.id,
          sourceType: 'user_knowledge_file' as const,
        }))
      }
    }

    if (filesToProcess.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No files to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let processedCount = 0

    for (const file of filesToProcess) {
      try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/kb-document-parser`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SERVICE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            source_type: file.sourceType,
            source_id: file.id,
          }),
        })

        if (response.ok) {
          processedCount++
        } else {
          const errBody = await response.json().catch(() => ({ error: response.statusText }))
          const table = file.sourceType === 'unified_document' ? 'unified_documents' : 'user_knowledge_files'
          await supabaseClient
            .from(table)
            .update({
              processing_status: 'failed',
              processing_error: errBody.error ?? 'Parser returned non-200',
            })
            .eq('id', file.id)
        }
      } catch (error: unknown) {
        console.error(`Error processing ${file.sourceType} ${file.id}:`, error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        const table = file.sourceType === 'unified_document' ? 'unified_documents' : 'user_knowledge_files'
        await supabaseClient
          .from(table)
          .update({ processing_status: 'failed', processing_error: errorMessage })
          .eq('id', file.id)
      }

      await new Promise((r) => setTimeout(r, 1000))
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed_count: processedCount,
        total_found: filesToProcess.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    console.error('User knowledge process error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
