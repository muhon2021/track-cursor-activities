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
    const pathParts = url.pathname.split('/').filter(Boolean)
    const meetingId = pathParts[pathParts.length - 1]

    // GET - List or get single meeting
    if (req.method === 'GET') {
      if (meetingId && meetingId !== 'meetings') {
        const { data, error } = await supabaseClient
          .from('meetings')
          .select('*, clients(name, email)')
          .eq('id', meetingId)
          .single()

        if (error) throw error

        return new Response(
          JSON.stringify(data),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } else {
        const { data, error } = await supabaseClient
          .from('meetings')
          .select('*, clients(name)')
          .order('scheduled_at', { ascending: false })
          .limit(50)

        if (error) throw error

        return new Response(
          JSON.stringify({ meetings: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // POST - Create meeting
    if (req.method === 'POST') {
      const body = await req.json()
      const { data, error } = await supabaseClient
        .from('meetings')
        .insert([body])
        .select()
        .single()

      if (error) throw error

      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 }
      )
    }

    // PATCH - Update meeting
    if (req.method === 'PATCH' && meetingId) {
      const body = await req.json()
      const { data, error } = await supabaseClient
        .from('meetings')
        .update(body)
        .eq('id', meetingId)
        .select()
        .single()

      if (error) throw error

      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // DELETE - Delete meeting
    if (req.method === 'DELETE' && meetingId) {
      const { error } = await supabaseClient
        .from('meetings')
        .delete()
        .eq('id', meetingId)

      if (error) throw error

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 405 }
    )
  } catch (error: unknown) {
    console.error('API meetings error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
