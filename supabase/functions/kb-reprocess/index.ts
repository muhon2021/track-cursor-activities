/**
 * kb-reprocess — reprocessing framework for the document parsing pipeline.
 *
 * Actions:
 *   reprocess_one     — reparse a single document by parsed_document id or source ref
 *   reprocess_source  — reparse all documents for a given source_id
 *   reprocess_all     — reparse all failed documents
 *   reprocess_version — reparse all documents below a target parse_version
 *
 * Uses kb-document-parser with force_reparse: true.
 * Progress is logged to kb_reembed_jobs (reuses existing job table).
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireAdmin } from '../_shared/admin-auth.ts'
import { PARSE_VERSION } from '../_shared/parsers/types.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type ReprocessAction = 'reprocess_one' | 'reprocess_source' | 'reprocess_all' | 'reprocess_version'

interface ReprocessRequest {
  action: ReprocessAction
  /** For reprocess_one: the parsed_document ID or source ref */
  document_id?: string
  source_type?: string
  source_id?: string
  /** For reprocess_version: only reprocess docs below this version (defaults to current PARSE_VERSION) */
  target_version?: string
  /** Max items to process in one call (default 20, max 100) */
  batch_size?: number
  /** Run in background (fire and forget) — returns job_id immediately */
  background?: boolean
}

interface ParsedDocumentRow {
  id: string
  source_type: string
  source_id: string
  parse_status: string
  parse_version: string
}

async function dispatchToParser(
  supabaseUrl: string,
  serviceKey: string,
  source_type: string,
  source_id: string
): Promise<{ success: boolean; error?: string; parsed_document_id?: string }> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/kb-document-parser`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ source_type, source_id, force_reparse: true }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }))
      return { success: false, error: err.error ?? `HTTP ${res.status}` }
    }

    const data = await res.json()
    return { success: true, parsed_document_id: data.parsed_document_id }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

async function createJobRecord(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  action: ReprocessAction,
  totalItems: number
): Promise<string | null> {
  const { data } = await supabase
    .from('kb_reembed_jobs')
    .insert({
      created_by: userId,
      status: 'running',
      total_count: totalItems,
      processed_count: 0,
      failed_count: 0,
      metadata: { action, reprocess_action: action },
    })
    .select('id')
    .maybeSingle()

  return data?.id ?? null
}

async function updateJobRecord(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  processed: number,
  failed: number,
  total: number,
  status: 'running' | 'completed' | 'failed'
) {
  await supabase
    .from('kb_reembed_jobs')
    .update({
      status,
      processed_count: processed,
      failed_count: failed,
      total_count: total,
      completed_at: status !== 'running' ? new Date().toISOString() : null,
    })
    .eq('id', jobId)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const adminCheck = await requireAdmin(req, supabase, corsHeaders)
  if (adminCheck instanceof Response) return adminCheck
  const { userId } = adminCheck

  let body: ReprocessRequest
  try {
    body = await req.json() as ReprocessRequest
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { action, batch_size = 20 } = body
  const maxBatch = Math.min(Math.max(1, batch_size), 100)

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  // ── Resolve documents to reprocess ──────────────────────────────────────

  let docs: ParsedDocumentRow[] = []

  if (action === 'reprocess_one') {
    if (body.document_id) {
      const { data } = await supabase
        .from('parsed_documents')
        .select('id, source_type, source_id, parse_status, parse_version')
        .eq('id', body.document_id)
        .maybeSingle()
      if (data) docs = [data]
    } else if (body.source_type && body.source_id) {
      const { data } = await supabase
        .from('parsed_documents')
        .select('id, source_type, source_id, parse_status, parse_version')
        .eq('source_type', body.source_type)
        .eq('source_id', body.source_id)
        .maybeSingle()
      if (data) docs = [data]
    } else {
      return new Response(JSON.stringify({ error: 'reprocess_one requires document_id or source_type+source_id' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  } else if (action === 'reprocess_source') {
    if (!body.source_id) {
      return new Response(JSON.stringify({ error: 'reprocess_source requires source_id' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const { data } = await supabase
      .from('parsed_documents')
      .select('id, source_type, source_id, parse_status, parse_version')
      .eq('source_id', body.source_id)
      .limit(maxBatch)
    docs = data ?? []
  } else if (action === 'reprocess_all') {
    const { data } = await supabase
      .from('parsed_documents')
      .select('id, source_type, source_id, parse_status, parse_version')
      .eq('parse_status', 'failed')
      .limit(maxBatch)
    docs = data ?? []
  } else if (action === 'reprocess_version') {
    const targetVersion = body.target_version ?? PARSE_VERSION
    const { data } = await supabase
      .from('parsed_documents')
      .select('id, source_type, source_id, parse_status, parse_version')
      .neq('parse_version', targetVersion)
      .limit(maxBatch)
    docs = data ?? []
  } else {
    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (docs.length === 0) {
    return new Response(JSON.stringify({ success: true, message: 'No documents to reprocess', processed: 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // ── Create job record ────────────────────────────────────────────────────
  const jobId = await createJobRecord(supabase, userId, action, docs.length)

  // ── Fire-and-forget mode ─────────────────────────────────────────────────
  if (body.background && jobId) {
    // Return job_id immediately; process runs asynchronously
    ;(async () => {
      let processed = 0
      let failed = 0
      for (const doc of docs) {
        const result = await dispatchToParser(SUPABASE_URL, SERVICE_KEY, doc.source_type, doc.source_id)
        if (result.success) processed++; else failed++
        await new Promise((r) => setTimeout(r, 500))
      }
      if (jobId) await updateJobRecord(supabase, jobId, processed, failed, docs.length, 'completed')
    })()

    return new Response(
      JSON.stringify({ success: true, job_id: jobId, total_queued: docs.length, background: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // ── Synchronous processing ────────────────────────────────────────────────
  const results: Array<{ source_id: string; success: boolean; error?: string }> = []

  for (const doc of docs) {
    const result = await dispatchToParser(SUPABASE_URL, SERVICE_KEY, doc.source_type, doc.source_id)
    results.push({ source_id: doc.source_id, ...result })
    await new Promise((r) => setTimeout(r, 300))
  }

  const succeeded = results.filter((r) => r.success).length
  const failedCount = results.length - succeeded

  if (jobId) {
    await updateJobRecord(supabase, jobId, succeeded, failedCount, docs.length, 'completed')
  }

  await supabase.from('activity_logs').insert({
    user_id: userId,
    action: `kb_${action}`,
    resource_type: 'knowledge_sync',
    details: { total: docs.length, succeeded, failed: failedCount },
  })

  return new Response(
    JSON.stringify({
      success: true,
      job_id: jobId,
      total: docs.length,
      succeeded,
      failed: failedCount,
      results,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
