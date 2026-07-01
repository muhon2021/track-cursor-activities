/**
 * api-v1-documents — REST-style API over unified_documents.
 * Used by project, client, and user knowledge modules.
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
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const anonClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authHeader } } })
    const { data: userData, error: userErr } = await anonClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const url = new URL(req.url)
    const pathMatch = url.pathname.match(/\/api-v1-documents\/?(.*)/)
    const path = (pathMatch?.[1] ?? '').replace(/^\/+/, '')
    const segments = path ? path.split('/') : []
    const id = segments[0] && segments[0] !== 'list' ? segments[0] : null

    let body: Record<string, unknown> = {}
    if (req.method !== 'GET' && req.body) {
      try {
        body = await req.json()
      } catch {
        // ignore
      }
    }

    // List: GET with query params owner_type, owner_id, processing_status
    if (req.method === 'GET' && !id) {
      const ownerType = url.searchParams.get('owner_type')
      const ownerId = url.searchParams.get('owner_id')
      const status = url.searchParams.get('processing_status')
      const limit = Math.min(Number(url.searchParams.get('limit')) || 100, 500)
      let q = supabaseClient.from('unified_documents').select('*')
      if (ownerType) q = q.eq('owner_type', ownerType)
      if (ownerId) q = q.eq('owner_id', ownerId)
      if (status) q = q.eq('processing_status', status)
      const { data, error } = await q.order('created_at', { ascending: false }).limit(limit)
      if (error) throw error
      return new Response(JSON.stringify(data ?? []), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Get one: GET /:id
    if (req.method === 'GET' && id) {
      const { data, error } = await supabaseClient
        .from('unified_documents')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      if (!data) {
        return new Response(JSON.stringify({ error: 'Not found' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 })
      }
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Create: POST
    if (req.method === 'POST' && !id) {
      const { data, error } = await supabaseClient
        .from('unified_documents')
        .insert(body)
        .select()
        .single()
      if (error) throw error
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 })
    }

    // Update: PATCH /:id
    if (req.method === 'PATCH' && id) {
      const { id: _omit, ...updates } = body as { id?: string; [k: string]: unknown }
      const { data, error } = await supabaseClient
        .from('unified_documents')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Delete: DELETE /:id
    if (req.method === 'DELETE' && id) {
      const { error } = await supabaseClient.from('unified_documents').delete().eq('id', id)
      if (error) throw error
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(
      JSON.stringify({ error: 'Method or path not supported' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  } catch (error: unknown) {
    console.error('api-v1-documents error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
