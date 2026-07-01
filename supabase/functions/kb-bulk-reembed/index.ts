import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireAdmin } from '../_shared/admin-auth.ts'
import { resolveEntityContent } from '../_shared/entity-content-resolver.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BATCH_SIZE = 5

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

    const body = await req.json()
    const { action, job_id, source_id } = body

    if (action === 'start') {
      if (!source_id) {
        return new Response(JSON.stringify({ error: 'source_id required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data: files } = await supabase
        .from('knowledge_files')
        .select('id')
        .eq('source_id', source_id)

      const { data: job, error: jobErr } = await supabase
        .from('kb_reembed_jobs')
        .insert({
          source_id,
          status: 'pending',
          total_documents: files?.length ?? 0,
          created_by: userId,
        })
        .select()
        .single()

      if (jobErr) throw jobErr

      if (files?.length) {
        await supabase.from('kb_reembed_job_items').insert(
          files.map((f) => ({
            job_id: job.id,
            entity_type: 'knowledge_file',
            entity_id: f.id,
            status: 'pending',
          }))
        )
      }

      await supabase.from('kb_reembed_jobs').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', job.id)

      // Kick off processing
      supabase.functions.invoke('kb-bulk-reembed', { body: { action: 'process', job_id: job.id } }).catch(console.error)

      return new Response(JSON.stringify({ success: true, job }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'pause' && job_id) {
      await supabase.from('kb_reembed_jobs').update({ status: 'paused' }).eq('id', job_id)
      return new Response(JSON.stringify({ success: true, status: 'paused' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'resume' && job_id) {
      await supabase.from('kb_reembed_jobs').update({ status: 'running' }).eq('id', job_id)
      supabase.functions.invoke('kb-bulk-reembed', { body: { action: 'process', job_id } }).catch(console.error)
      return new Response(JSON.stringify({ success: true, status: 'running' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'cancel' && job_id) {
      await supabase.from('kb_reembed_jobs').update({ status: 'cancelled', completed_at: new Date().toISOString() }).eq('id', job_id)
      return new Response(JSON.stringify({ success: true, status: 'cancelled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'status' && job_id) {
      const { data: job } = await supabase.from('kb_reembed_jobs').select('*').eq('id', job_id).single()
      const { count: failed } = await supabase.from('kb_reembed_job_items').select('*', { count: 'exact', head: true }).eq('job_id', job_id).eq('status', 'failed')
      return new Response(JSON.stringify({ success: true, job, failed_count: failed }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'process' && job_id) {
      const { data: job } = await supabase.from('kb_reembed_jobs').select('*').eq('id', job_id).single()
      if (!job || job.status === 'cancelled' || job.status === 'paused') {
        return new Response(JSON.stringify({ success: true, message: 'Job not running' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data: items } = await supabase
        .from('kb_reembed_job_items')
        .select('*')
        .eq('job_id', job_id)
        .eq('status', 'pending')
        .limit(BATCH_SIZE)

      let processed = job.processed_documents ?? 0
      let failed = job.failed_documents ?? 0

      for (const item of items ?? []) {
        const { data: currentJob } = await supabase.from('kb_reembed_jobs').select('status').eq('id', job_id).single()
        if (currentJob?.status === 'paused' || currentJob?.status === 'cancelled') break

        await supabase.from('kb_reembed_job_items').update({ status: 'running' }).eq('id', item.id)

        try {
          const resolved = await resolveEntityContent(supabase, item.entity_type, item.entity_id)
          if (!resolved?.content) throw new Error('No content found')

          const { error: embedErr } = await supabase.functions.invoke('generate-embeddings', {
            body: {
              entity_type: item.entity_type,
              entity_id: item.entity_id,
              content: resolved.content,
              metadata: resolved.metadata,
              user_id: resolved.user_id,
              source_id: job.source_id,
              unified_document_id: resolved.unified_document_id,
            },
          })
          if (embedErr) throw embedErr

          await supabase.from('kb_reembed_job_items').update({
            status: 'completed',
            processed_at: new Date().toISOString(),
          }).eq('id', item.id)
          processed++
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          await supabase.from('kb_reembed_job_items').update({
            status: 'failed',
            error: msg,
            processed_at: new Date().toISOString(),
          }).eq('id', item.id)
          failed++
        }
      }

      const total = job.total_documents ?? 0
      const isComplete = processed + failed >= total
      await supabase.from('kb_reembed_jobs').update({
        processed_documents: processed,
        failed_documents: failed,
        status: isComplete ? 'completed' : 'running',
        completed_at: isComplete ? new Date().toISOString() : null,
      }).eq('id', job_id)

      if (!isComplete) {
        supabase.functions.invoke('kb-bulk-reembed', { body: { action: 'process', job_id } }).catch(console.error)
      }

      return new Response(JSON.stringify({ success: true, processed, failed, complete: isComplete }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
