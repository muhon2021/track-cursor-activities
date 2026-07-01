import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireAdmin } from '../_shared/admin-auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const body = await req.json()
    const { action, user_id, memory_id, email, department } = body

    if (!user_id) {
      return new Response(JSON.stringify({ error: 'user_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'list') {
      const { data, error } = await supabase.rpc('admin_list_user_memories', { p_user_id: user_id })
      if (error) throw error
      await supabase.from('activity_logs').insert({
        user_id: userId,
        action: 'memory_admin_view',
        resource_type: 'agent_memories',
        resource_id: user_id,
        details: { count: data?.length ?? 0 },
      })
      return new Response(JSON.stringify({ success: true, memories: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'export') {
      const { data, error } = await supabase.rpc('admin_export_user_memories', { p_user_id: user_id })
      if (error) throw error
      await supabase.from('activity_logs').insert({
        user_id: userId,
        action: 'memory_admin_export',
        resource_type: 'agent_memories',
        resource_id: user_id,
      })
      return new Response(JSON.stringify({ success: true, export: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'delete' && memory_id) {
      const { error } = await supabase
        .from('agent_memories')
        .update({ deleted_at: new Date().toISOString(), deleted_by: userId, is_active: false })
        .eq('id', memory_id)
        .eq('user_id', user_id)
      if (error) throw error
      await supabase.from('activity_logs').insert({
        user_id: userId,
        action: 'memory_admin_delete',
        resource_type: 'agent_memories',
        resource_id: memory_id,
        details: { target_user_id: user_id },
      })
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'search') {
      let query = supabase.from('profiles').select('id, email, full_name').limit(50)
      if (email) query = query.ilike('email', `%${email}%`)
      const { data: profiles } = await query

      const results = []
      for (const p of profiles ?? []) {
        const { data: ep } = await supabase
          .from('employee_profiles')
          .select('department_id, departments(name)')
          .eq('user_id', p.id)
          .maybeSingle()
        const deptName = (ep?.departments as { name?: string } | null)?.name
        if (department && deptName && !deptName.toLowerCase().includes(department.toLowerCase())) continue
        const { count } = await supabase
          .from('agent_memories')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', p.id)
          .is('deleted_at', null)
        results.push({ ...p, department: deptName, memory_count: count ?? 0 })
      }
      return new Response(JSON.stringify({ success: true, users: results }), {
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
