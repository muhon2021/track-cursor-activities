/**
 * Tasks API Edge Function
 *
 * CRUD operations for the tasks (action items) system.
 * Supports GET (list/detail), POST (create), PATCH (update), DELETE.
 *
 * Table: tasks
 * Called by: External API clients, mobile apps
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
    const pathParts = url.pathname.split('/').filter(Boolean)
    const taskId = pathParts.length > 2 ? pathParts[pathParts.length - 1] : null

    // GET - List or get single task
    if (req.method === 'GET') {
      if (taskId && taskId !== 'tasks') {
        const { data, error } = await supabaseClient
          .from('tasks')
          .select('*, assignee:assigned_to(id, full_name, email), creator:created_by(id, full_name)')
          .eq('id', taskId)
          .single()

        if (error) throw error

        return new Response(
          JSON.stringify(data),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } else {
        // Parse query params for filters
        const status = url.searchParams.get('status')
        const assignedTo = url.searchParams.get('assigned_to')
        const streamId = url.searchParams.get('stream_id')
        const limit = parseInt(url.searchParams.get('limit') || '100')
        const offset = parseInt(url.searchParams.get('offset') || '0')

        let query = supabaseClient
          .from('tasks')
          .select('*, assignee:assigned_to(id, full_name, email), creator:created_by(id, full_name)', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1)

        if (status) query = query.eq('status', status)
        if (assignedTo) query = query.eq('assigned_to', assignedTo)
        if (streamId) query = query.eq('stream_id', streamId)

        const { data, error, count } = await query

        if (error) throw error

        return new Response(
          JSON.stringify({ tasks: data, total: count }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // POST - Create task
    if (req.method === 'POST') {
      const body = await req.json()
      const { data, error } = await supabaseClient
        .from('tasks')
        .insert([{
          title: body.title,
          description: body.description || null,
          status: body.status || 'todo',
          priority: body.priority || 'medium',
          assigned_to: body.assigned_to || null,
          created_by: body.created_by || null,
          stream_id: body.stream_id || null,
          category: body.category || null,
          due_date: body.due_date || null,
          metadata: body.metadata || {},
        }])
        .select()
        .single()

      if (error) throw error

      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 }
      )
    }

    // PATCH - Update task
    if (req.method === 'PATCH' && taskId) {
      const body = await req.json()
      const { data, error } = await supabaseClient
        .from('tasks')
        .update({
          ...body,
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId)
        .select()
        .single()

      if (error) throw error

      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // DELETE - Delete task
    if (req.method === 'DELETE' && taskId) {
      const { error } = await supabaseClient
        .from('tasks')
        .delete()
        .eq('id', taskId)

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
    console.error('API tasks error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
