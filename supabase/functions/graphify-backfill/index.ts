import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireAdmin } from '../_shared/admin-auth.ts'
import { DEFAULT_TENANT_ID } from '../_shared/graphify-types.ts'
import { syncFkRelationships } from '../_shared/graphify-relationships.ts'
import { invalidateTenantTraversalCache } from '../_shared/graphify-traverse-cache.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function isServiceRoleRequest(req: Request, serviceKey: string): boolean {
  const authHeader = req.headers.get('Authorization') ?? ''
  const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim()
  const apiKey = (req.headers.get('apikey') ?? '').trim()
  if (serviceKey && (bearerToken === serviceKey || apiKey === serviceKey)) {
    return true
  }
  const token = bearerToken || apiKey
  if (!token.includes('.')) return false
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.role === 'service_role'
  } catch {
    return false
  }
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

    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    let userId: string | null = null
    if (isServiceRoleRequest(req, serviceKey)) {
      // Internal setup (e.g. scripts/phase0-graphify-setup.mjs)
      userId = null
    } else {
      const adminCheck = await requireAdmin(req, supabaseAdmin, corsHeaders)
      if (adminCheck instanceof Response) return adminCheck
      userId = adminCheck.userId
    }

    const tenantId = DEFAULT_TENANT_ID

    const { data: job, error: jobError } = await supabaseAdmin
      .from('graphify_sync_jobs')
      .insert({
        tenant_id: tenantId,
        job_type: 'backfill',
        status: 'running',
        started_at: new Date().toISOString(),
        triggered_by: userId,
      })
      .select('id')
      .single()

    if (jobError) throw jobError

    const stats = await syncFkRelationships(supabaseAdmin, tenantId, { linksOnly: false, phase: 'all' })

    await invalidateTenantTraversalCache(supabaseAdmin, tenantId)

    await supabaseAdmin
      .from('graphify_sync_jobs')
      .update({
        status: stats.errors.length > 0 ? 'failed' : 'completed',
        entities_synced: stats.entities_synced,
        relationships_synced: stats.relationships_synced,
        error_message: stats.errors.length ? stats.errors.slice(0, 5).join('; ') : null,
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id)

    return new Response(
      JSON.stringify({
        success: true,
        job_id: job.id,
        ...stats,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    console.error('[graphify-backfill]', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
