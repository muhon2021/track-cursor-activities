/**
 * kb-document-parser — unified document parsing entry point.
 *
 * Accepts a source reference, downloads the file from storage,
 * runs format-specific parsing, stores structured results in
 * parsed_documents / document_pages / document_tables / document_images,
 * then invokes generate-embeddings with normalized Markdown + citation metadata.
 *
 * Contract:
 * POST body: {
 *   source_type: 'knowledge_file' | 'unified_document' | 'user_knowledge_file'
 *   source_id: string
 *   force_reparse?: boolean   // Re-parse even if parse_status === 'completed'
 * }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { parseDocument, PARSE_VERSION } from '../_shared/parsers/index.ts'
import { requireAdmin } from '../_shared/admin-auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type SourceType = 'knowledge_file' | 'unified_document' | 'user_knowledge_file'

interface SourceRecord {
  id: string
  file_name: string
  storage_path: string
  source_id?: string
  user_id?: string
  owner_id?: string
  file_type?: string
  title?: string
}

/** Resolve source record + storage bucket from source_type */
async function resolveSource(
  supabase: ReturnType<typeof createClient>,
  source_type: SourceType,
  source_id: string
): Promise<{ record: SourceRecord; bucket: string } | null> {
  if (source_type === 'knowledge_file') {
    const { data } = await supabase
      .from('knowledge_files')
      .select('id, file_name, storage_path, source_id, uploaded_by, file_type, title')
      .eq('id', source_id)
      .maybeSingle()
    if (!data) return null
    return {
      record: {
        id: data.id,
        file_name: data.file_name,
        storage_path: data.storage_path,
        source_id: data.source_id,
        user_id: data.uploaded_by,
        file_type: data.file_type,
        title: data.title,
      },
      bucket: 'knowledge-files',
    }
  }

  if (source_type === 'unified_document') {
    const { data } = await supabase
      .from('unified_documents')
      .select('id, file_name, storage_path, source_id, owner_id, file_type, title')
      .eq('id', source_id)
      .maybeSingle()
    if (!data) return null
    return {
      record: {
        id: data.id,
        file_name: data.file_name ?? data.title ?? '',
        storage_path: data.storage_path,
        source_id: data.source_id,
        owner_id: data.owner_id,
        file_type: data.file_type,
        title: data.title,
      },
      bucket: 'user-knowledge',
    }
  }

  if (source_type === 'user_knowledge_file') {
    const { data } = await supabase
      .from('user_knowledge_files')
      .select('id, file_name, storage_path, user_id, file_type')
      .eq('id', source_id)
      .maybeSingle()
    if (!data) return null
    return {
      record: {
        id: data.id,
        file_name: data.file_name ?? '',
        storage_path: data.storage_path ?? '',
        user_id: data.user_id,
        file_type: data.file_type,
      },
      bucket: 'user-knowledge',
    }
  }

  return null
}

/** Update source record processing status */
async function updateSourceStatus(
  supabase: ReturnType<typeof createClient>,
  source_type: SourceType,
  source_id: string,
  status: 'processing' | 'completed' | 'failed',
  extra: Record<string, unknown> = {}
) {
  const now = new Date().toISOString()
  const table = source_type === 'knowledge_file' ? 'knowledge_files'
    : source_type === 'unified_document' ? 'unified_documents'
    : 'user_knowledge_files'

  const payload: Record<string, unknown> = {
    processing_status: status,
    ...extra,
  }
  if (status === 'completed' || status === 'failed') {
    payload.processed_at = now
  }

  await supabase.from(table).update(payload).eq('id', source_id)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  // Auth: accept service role or admin user
  const authHeader = req.headers.get('Authorization') ?? ''
  const isServiceRole = authHeader.includes(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? 'NEVER_MATCH')
  if (!isServiceRole) {
    const adminCheck = await requireAdmin(req, supabase, corsHeaders)
    if (adminCheck instanceof Response) return adminCheck
  }

  let source_type: SourceType
  let source_id: string
  let force_reparse: boolean

  try {
    const body = await req.json()
    source_type = body.source_type as SourceType
    source_id = body.source_id as string
    force_reparse = Boolean(body.force_reparse)

    if (!source_type || !source_id) {
      return new Response(
        JSON.stringify({ error: 'source_type and source_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid request body' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const UNSTRUCTURED_API_KEY = Deno.env.get('UNSTRUCTURED_API_KEY')
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  let parsedDocId: string | null = null

  try {
    // ── 1. Check if already parsed (unless force_reparse) ──────────────────
    if (!force_reparse) {
      const { data: existing } = await supabase
        .from('parsed_documents')
        .select('id, parse_status, parse_version')
        .eq('source_type', source_type)
        .eq('source_id', source_id)
        .eq('parse_status', 'completed')
        .maybeSingle()

      if (existing && existing.parse_version === PARSE_VERSION) {
        return new Response(
          JSON.stringify({
            success: true,
            skipped: true,
            reason: 'Already parsed at current version',
            parsed_document_id: existing.id,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // ── 2. Resolve source ──────────────────────────────────────────────────
    const resolved = await resolveSource(supabase, source_type, source_id)
    if (!resolved) {
      return new Response(
        JSON.stringify({ error: `Source not found: ${source_type}/${source_id}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    const { record, bucket } = resolved

    if (!record.storage_path) {
      return new Response(
        JSON.stringify({ error: 'Source record has no storage_path' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── 3. Mark processing ─────────────────────────────────────────────────
    await updateSourceStatus(supabase, source_type, source_id, 'processing')

    // Upsert a parsed_documents row and mark it processing
    const { data: parsedDoc, error: upsertErr } = await supabase
      .from('parsed_documents')
      .upsert(
        {
          source_type,
          source_id,
          file_name: record.file_name,
          mime_type: record.file_type ?? null,
          parse_status: 'processing',
          parse_version: PARSE_VERSION,
          parse_errors: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'source_type,source_id' }
      )
      .select('id')
      .single()

    if (upsertErr || !parsedDoc) {
      throw new Error(`Failed to create parsed_documents row: ${upsertErr?.message}`)
    }
    parsedDocId = parsedDoc.id

    // ── 4. Download file ───────────────────────────────────────────────────
    const { data: fileBlob, error: downloadErr } = await supabase.storage
      .from(bucket)
      .download(record.storage_path)

    if (downloadErr || !fileBlob) {
      throw new Error(`Failed to download file: ${downloadErr?.message ?? 'No data returned'}`)
    }

    // ── 5. Parse document ──────────────────────────────────────────────────
    const parsed = await parseDocument(fileBlob, record.file_name, {
      unstructuredApiKey: UNSTRUCTURED_API_KEY,
      openAiApiKey: OPENAI_API_KEY,
    })

    // ── 6. Store structured extraction results ─────────────────────────────

    // Delete old pages/tables/images for this document
    await supabase.from('document_pages').delete().eq('document_id', parsedDocId)
    await supabase.from('document_tables').delete().eq('document_id', parsedDocId)
    await supabase.from('document_images').delete().eq('document_id', parsedDocId)

    // Insert pages
    if (parsed.pages.length > 0) {
      await supabase.from('document_pages').insert(
        parsed.pages.map((p) => ({
          document_id: parsedDocId,
          page_number: p.pageNumber,
          content: p.content,
          metadata: {},
        }))
      )
    }

    // Insert tables
    if (parsed.tables.length > 0) {
      await supabase.from('document_tables').insert(
        parsed.tables.map((t) => ({
          document_id: parsedDocId,
          page_number: t.pageNumber ?? null,
          table_index: t.tableIndex,
          headers: t.headers,
          rows: t.rows,
          markdown_repr: t.markdown,
        }))
      )
    }

    // Insert images
    if (parsed.images.length > 0) {
      await supabase.from('document_images').insert(
        parsed.images.map((img) => ({
          document_id: parsedDocId,
          page_number: img.pageNumber ?? null,
          image_index: img.imageIndex,
          caption: img.caption ?? null,
          ocr_text: img.ocrText ?? null,
          description: img.description ?? null,
        }))
      )
    }

    // Update parsed_documents row with results
    await supabase
      .from('parsed_documents')
      .update({
        parse_status: 'completed',
        parse_version: PARSE_VERSION,
        mime_type: parsed.mimeType,
        page_count: parsed.pages.length,
        table_count: parsed.tables.length,
        image_count: parsed.images.length,
        word_count: parsed.markdown.split(/\s+/).length,
        parse_errors: null,
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', parsedDocId)

    // ── 7. Invoke generate-embeddings ──────────────────────────────────────
    const embeddingPayload = {
      entity_type: source_type,
      entity_id: source_id,
      content: parsed.markdown,
      source_id: record.source_id ?? null,
      user_id: record.user_id ?? record.owner_id ?? null,
      unified_document_id: source_type === 'unified_document' ? source_id : null,
      metadata: {
        file_name: record.file_name,
        title: record.title ?? record.file_name,
        source_id: record.source_id,
        mime_type: parsed.mimeType,
        page_count: parsed.pages.length,
        parse_version: PARSE_VERSION,
      },
      page_citations: parsed.citations ?? null,
    }

    const embedRes = await fetch(`${SUPABASE_URL}/functions/v1/generate-embeddings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(embeddingPayload),
    })

    const embedResult = embedRes.ok ? await embedRes.json() : null

    // ── 8. Update source record ────────────────────────────────────────────
    await updateSourceStatus(supabase, source_type, source_id, 'completed', {
      chunk_count: embedResult?.embeddings_created ?? 0,
      parse_version: PARSE_VERSION,
      processing_error: null,
    })

    return new Response(
      JSON.stringify({
        success: true,
        parsed_document_id: parsedDocId,
        page_count: parsed.pages.length,
        table_count: parsed.tables.length,
        image_count: parsed.images.length,
        embeddings_created: embedResult?.embeddings_created ?? 0,
        chunks_processed: embedResult?.chunks_processed ?? 0,
        parse_version: PARSE_VERSION,
        mime_type: parsed.mimeType,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`kb-document-parser error [${source_type}/${source_id}]:`, message)

    // Mark failed
    if (parsedDocId) {
      await supabase
        .from('parsed_documents')
        .update({
          parse_status: 'failed',
          parse_errors: { message, timestamp: new Date().toISOString() },
          updated_at: new Date().toISOString(),
        })
        .eq('id', parsedDocId)
    }

    await updateSourceStatus(supabase, source_type, source_id, 'failed', {
      processing_error: message,
    }).catch(() => {})

    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
