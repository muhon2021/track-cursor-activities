/**
 * client-documents — client-specific document management.
 * Create/update/link documents to clients for client knowledge views.
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

    const body = req.method !== 'GET' ? await req.json().catch(() => ({})) : {}
    const clientId = body.client_id ?? new URL(req.url).searchParams.get('client_id')

    if (!clientId) {
      return new Response(
        JSON.stringify({ error: 'client_id is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    if (req.method === 'GET') {
      const { data, error } = await supabaseClient
        .from('unified_documents')
        .select('*')
        .eq('owner_type', 'client')
        .eq('owner_id', clientId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return new Response(JSON.stringify(data ?? []), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (req.method === 'POST') {
      const { data, error } = await supabaseClient
        .from('unified_documents')
        .insert({
          owner_type: 'client',
          owner_id: clientId,
          ...body,
        })
        .select()
        .single()
      if (error) throw error
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 })
    }

    if (req.method === 'PATCH' && body.id) {
      const { id, ...updates } = body as { id: string; [k: string]: unknown }
      const { data, error } = await supabaseClient
        .from('unified_documents')
        .update(updates)
        .eq('id', id)
        .eq('owner_type', 'client')
        .eq('owner_id', clientId)
        .select()
        .single()
      if (error) throw error
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (req.method === 'DELETE' && body.id) {
      const { error } = await supabaseClient
        .from('unified_documents')
        .delete()
        .eq('id', body.id)
        .eq('owner_type', 'client')
        .eq('owner_id', clientId)
      if (error) throw error
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(
      JSON.stringify({ error: 'Method or body not supported' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  } catch (error: unknown) {
    console.error('client-documents error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
