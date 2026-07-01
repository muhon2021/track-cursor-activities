/**
 * kb-sync-action
 *
 * Admin action endpoint for knowledge sync operations.
 * Actions:
 *   retry    — reset processing_status to pending
 *   requeue  — reset + insert into embedding_queue
 *   parse    — invoke kb-document-parser directly for immediate reprocessing
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireAdmin } from '../_shared/admin-auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncItem {
  entity_type: 'knowledge_file' | 'unified_document'
  entity_id: string
}

async function applySyncAction(
  supabase: ReturnType<typeof createClient>,
  item: SyncItem,
  action: 'retry' | 'requeue'
) {
  const now = new Date().toISOString()

  if (item.entity_type === 'knowledge_file') {
    await supabase
      .from('knowledge_files')
      .update({
        processing_status: 'pending',
        processing_error: null,
        last_sync_attempt_at: now,
      })
      .eq('id', item.entity_id)

    if (action === 'requeue') {
      await supabase.from('embedding_queue').insert({
        entity_type: 'knowledge_file',
        entity_id: item.entity_id,
        status: 'pending',
        priority: 5,
      })
    }
  } else if (item.entity_type === 'unified_document') {
    await supabase
      .from('unified_documents')
      .update({
        processing_status: 'pending',
        last_sync_attempt_at: now,
      })
      .eq('id', item.entity_id)

    if (action === 'requeue') {
      await supabase.from('embedding_queue').insert({
        entity_type: 'unified_document',
        entity_id: item.entity_id,
        status: 'pending',
        priority: 5,
      })
    }
  }
}

async function applyParseAction(
  supabase: ReturnType<typeof createClient>,
  item: SyncItem,
  supabaseUrl: string,
  serviceKey: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/kb-document-parser`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source_type: item.entity_type,
        source_id: item.entity_id,
        force_reparse: true,
      }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: response.statusText }))
      return { success: false, error: err.error ?? 'Parser returned non-200' }
    }

    return { success: true }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
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

    const { action, items } = await req.json() as { action: 'retry' | 'requeue' | 'parse'; items: SyncItem[] }

    if (!action || !Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: 'action and items[] required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    const results: Array<{ entity_id: string; success: boolean; error?: string }> = []

    for (const item of items) {
      if (action === 'parse') {
        const result = await applyParseAction(supabase, item, SUPABASE_URL, SERVICE_KEY)
        results.push({ entity_id: item.entity_id, ...result })
      } else {
        await applySyncAction(supabase, item, action)
        results.push({ entity_id: item.entity_id, success: true })
      }
    }

    await supabase.from('activity_logs').insert({
      user_id: userId,
      action: `kb_sync_${action}`,
      resource_type: 'knowledge_sync',
      details: { count: items.length, items },
    })

    const successCount = results.filter((r) => r.success).length

    return new Response(JSON.stringify({
      success: true,
      processed: items.length,
      succeeded: successCount,
      failed: items.length - successCount,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
