/**
 * Knowledge Base — central admin API for categories, sources, and files.
 * Used by hooks for KB management.
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

    const url = new URL(req.url)
    const pathParts = url.pathname.replace('/knowledge-base', '').replace(/^\/+/, '').split('/').filter(Boolean)
    const action = pathParts[0] ?? url.searchParams.get('action') ?? 'list'
    const resource = pathParts[1]

    let body: Record<string, unknown> = {}
    if (req.method !== 'GET' && req.body) {
      try {
        body = await req.json()
      } catch {
        // ignore
      }
    }

    // Categories
    if (action === 'categories' || resource === 'categories') {
      if (req.method === 'GET') {
        const { data, error } = await supabaseClient
          .from('knowledge_categories')
          .select('*')
          .order('sort_order', { ascending: true })
        if (error) throw error
        return new Response(JSON.stringify(data ?? []), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      if (req.method === 'POST') {
        const { data, error } = await supabaseClient
          .from('knowledge_categories')
          .insert(body)
          .select()
          .single()
        if (error) throw error
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      if (req.method === 'PATCH' && body.id) {
        const { id, ...updates } = body as { id: string; [k: string]: unknown }
        const { data, error } = await supabaseClient
          .from('knowledge_categories')
          .update(updates)
          .eq('id', id)
          .select()
          .single()
        if (error) throw error
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      if (req.method === 'DELETE' && (body.id || resource)) {
        const id = body.id ?? resource
        const { error } = await supabaseClient.from('knowledge_categories').delete().eq('id', id)
        if (error) throw error
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    // Sources
    if (action === 'sources' || resource === 'sources') {
      if (req.method === 'GET') {
        let q = supabaseClient.from('knowledge_sources').select('*')
        const { data, error } = await q.order('created_at', { ascending: false })
        if (error) throw error
        return new Response(JSON.stringify(data ?? []), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      if (req.method === 'POST') {
        const { data, error } = await supabaseClient
          .from('knowledge_sources')
          .insert(body)
          .select()
          .single()
        if (error) throw error
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      if (req.method === 'PATCH' && body.id) {
        const { id, ...updates } = body as { id: string; [k: string]: unknown }
        const { data, error } = await supabaseClient
          .from('knowledge_sources')
          .update(updates)
          .eq('id', id)
          .select()
          .single()
        if (error) throw error
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      if (req.method === 'DELETE' && (body.id || resource)) {
        const id = body.id ?? resource
        const { error } = await supabaseClient.from('knowledge_sources').delete().eq('id', id)
        if (error) throw error
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    // Files
    if (action === 'files' || resource === 'files') {
      if (req.method === 'GET') {
        const categoryId = url.searchParams.get('category_id')
        const sourceId = url.searchParams.get('source_id')
        const status = url.searchParams.get('processing_status')
        let q = supabaseClient.from('knowledge_files').select('*')
        if (categoryId) q = q.eq('category_id', categoryId)
        if (sourceId) q = q.eq('source_id', sourceId)
        if (status) q = q.eq('processing_status', status)
        const { data, error } = await q.order('created_at', { ascending: false }).limit(500)
        if (error) throw error
        return new Response(JSON.stringify(data ?? []), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      if (req.method === 'POST') {
        const { data, error } = await supabaseClient
          .from('knowledge_files')
          .insert(body)
          .select()
          .single()
        if (error) throw error
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      if (req.method === 'PATCH' && body.id) {
        const { id, ...updates } = body as { id: string; [k: string]: unknown }
        const { data, error } = await supabaseClient
          .from('knowledge_files')
          .update(updates)
          .eq('id', id)
          .select()
          .single()
        if (error) throw error
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      if (req.method === 'DELETE' && (body.id || resource)) {
        const id = body.id ?? resource
        const { error } = await supabaseClient.from('knowledge_files').delete().eq('id', id)
        if (error) throw error
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    // Stats
    if (action === 'stats' || action === 'list') {
      const [catRes, fileRes, sourceRes] = await Promise.all([
        supabaseClient.from('knowledge_categories').select('id', { count: 'exact', head: true }),
        supabaseClient.from('knowledge_files').select('id', { count: 'exact', head: true }),
        supabaseClient.from('knowledge_sources').select('id', { count: 'exact', head: true }),
      ])
      return new Response(
        JSON.stringify({
          totalCategories: catRes.count ?? 0,
          totalFiles: fileRes.count ?? 0,
          totalSources: sourceRes.count ?? 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Unknown action', action }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  } catch (error: unknown) {
    console.error('Knowledge base error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
