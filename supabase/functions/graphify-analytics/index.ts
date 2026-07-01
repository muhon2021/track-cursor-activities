import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireAdmin } from '../_shared/admin-auth.ts'
import { getGraphifyAnalytics } from '../_shared/graphify-analytics.ts'
import { DEFAULT_TENANT_ID } from '../_shared/graphify-types.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const adminCheck = await requireAdmin(req, supabaseAdmin, corsHeaders)
    if (adminCheck instanceof Response) return adminCheck

    const body = await req.json().catch(() => ({}))
    const days = Math.min(Math.max(1, Number(body?.days) || 30), 90)

    const analytics = await getGraphifyAnalytics(supabaseAdmin, DEFAULT_TENANT_ID, days)

    return new Response(JSON.stringify({ success: true, analytics }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    console.error('[graphify-analytics]', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
