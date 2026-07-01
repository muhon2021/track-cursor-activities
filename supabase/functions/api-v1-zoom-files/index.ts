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
    const fileId = pathParts[pathParts.length - 1]
    const isListEndpoint = !fileId || fileId === 'api-v1-zoom-files'

    // GET - List or get single meeting file
    if (req.method === 'GET') {
      if (!isListEndpoint) {
        // GET /:id - Single meeting_file by id
        const { data, error } = await supabaseClient
          .from('meeting_files')
          .select('*, meetings(id, title)')
          .eq('id', fileId)
          .single()

        if (error) {
          if (error.code === 'PGRST116') {
            return new Response(
              JSON.stringify({ error: 'Meeting file not found' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
            )
          }
          throw error
        }

        return new Response(
          JSON.stringify(data),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } else {
        // GET / - List meeting_files with pagination and filtering
        const page = parseInt(url.searchParams.get('page') || '1', 10)
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100)
        const provider = url.searchParams.get('provider')
        const meetingId = url.searchParams.get('meeting_id')
        const assignmentStatus = url.searchParams.get('assignment_status')

        const offset = (page - 1) * limit

        let query = supabaseClient
          .from('meeting_files')
          .select('*, meetings(id, title)', { count: 'exact' })

        // Apply filters
        if (provider) {
          query = query.eq('provider', provider)
        }
        if (meetingId) {
          query = query.eq('meeting_id', meetingId)
        }
        if (assignmentStatus) {
          // Map assignment_status to processing_status or meeting_id presence
          if (assignmentStatus === 'assigned') {
            query = query.not('meeting_id', 'is', null)
          } else if (assignmentStatus === 'unassigned') {
            query = query.is('meeting_id', null)
          } else {
            query = query.eq('processing_status', assignmentStatus)
          }
        }

        const { data, error, count } = await query
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1)

        if (error) throw error

        const totalPages = count ? Math.ceil(count / limit) : 0

        return new Response(
          JSON.stringify({
            files: data,
            pagination: {
              page,
              limit,
              total: count || 0,
              total_pages: totalPages,
            },
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // PATCH /:id - Update meeting_file
    if (req.method === 'PATCH') {
      if (isListEndpoint) {
        return new Response(
          JSON.stringify({ error: 'File ID is required for PATCH' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      const body = await req.json()

      // Only allow updating specific fields
      const allowedFields = [
        'meeting_id', 'processing_status', 'is_processed',
        'metadata', 'file_name', 'storage_path',
      ]
      const updateData: Record<string, unknown> = {}
      for (const field of allowedFields) {
        if (field in body) {
          updateData[field] = body[field]
        }
      }

      if (Object.keys(updateData).length === 0) {
        return new Response(
          JSON.stringify({ error: 'No valid fields to update' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      const { data, error } = await supabaseClient
        .from('meeting_files')
        .update(updateData)
        .eq('id', fileId)
        .select()
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return new Response(
            JSON.stringify({ error: 'Meeting file not found' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
          )
        }
        throw error
      }

      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // DELETE /:id - Delete meeting_file
    if (req.method === 'DELETE') {
      if (isListEndpoint) {
        return new Response(
          JSON.stringify({ error: 'File ID is required for DELETE' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      const { error } = await supabaseClient
        .from('meeting_files')
        .delete()
        .eq('id', fileId)

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
    console.error('API zoom files error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
