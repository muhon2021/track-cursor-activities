import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PROVIDER_SLUG = 'google-drive'
const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Manual JWT validation for ES256 compatibility
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)
    if (authError || !user) {
      console.error('[google-drive-sync] JWT validation failed:', authError)
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Service role client for all DB operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const body = await req.json().catch(() => ({}))
    const { folder_id, source_id } = body

    // Fetch the stored OAuth token for this user
    const { data: tokenData, error: tokenError } = await supabaseClient
      .from('user_oauth_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', user.id)
      .eq('provider_slug', PROVIDER_SLUG)
      .eq('is_active', true)
      .single()

    if (tokenError || !tokenData) {
      console.error('[google-drive-sync] No token found:', tokenError)
      return new Response(
        JSON.stringify({ error: 'Google Drive not connected. Please connect your Google Drive account first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let access_token = tokenData.access_token

    // Refresh token if expired
    const expiresAt = new Date(tokenData.expires_at)
    if (expiresAt <= new Date() && tokenData.refresh_token) {
      console.log('[google-drive-sync] Token expired, refreshing...')

      const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
      const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')

      if (!clientId || !clientSecret) {
        return new Response(
          JSON.stringify({ error: 'Google OAuth credentials not configured on server' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const refreshResponse = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: tokenData.refresh_token,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      })

      if (!refreshResponse.ok) {
        const errorText = await refreshResponse.text()
        console.error('[google-drive-sync] Token refresh failed:', errorText)
        return new Response(
          JSON.stringify({ error: 'Google Drive token expired. Please reconnect your Google Drive account.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const refreshData = await refreshResponse.json()
      access_token = refreshData.access_token

      await supabaseClient
        .from('user_oauth_tokens')
        .update({
          access_token: refreshData.access_token,
          refresh_token: refreshData.refresh_token || tokenData.refresh_token,
          expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
          last_refreshed_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .eq('provider_slug', PROVIDER_SLUG)

      console.log('[google-drive-sync] Token refreshed successfully')
    }

    // Fetch files from Google Drive with pagination
    const allFiles: Record<string, unknown>[] = []
    let nextPageToken: string | undefined

    do {
      const params = new URLSearchParams({
        pageSize: '100',
        fields: 'nextPageToken,files(id,name,mimeType,size,webViewLink,modifiedTime)',
        q: folder_id
          ? `'${folder_id}' in parents and trashed = false`
          : 'trashed = false',
      })
      if (nextPageToken) params.set('pageToken', nextPageToken)

      const filesResponse = await fetch(`${DRIVE_FILES_URL}?${params}`, {
        headers: { Authorization: `Bearer ${access_token}` },
      })

      if (!filesResponse.ok) {
        const errorText = await filesResponse.text()
        console.error('[google-drive-sync] Drive API error:', filesResponse.status, errorText)
        return new Response(
          JSON.stringify({ error: `Failed to fetch Google Drive files: ${filesResponse.status}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const filesData = await filesResponse.json()
      allFiles.push(...(filesData.files || []))
      nextPageToken = filesData.nextPageToken
    } while (nextPageToken)

    console.log(`[google-drive-sync] Fetched ${allFiles.length} files from Drive`)

    // Upsert each file into knowledge_files, skip folders
    let syncedCount = 0
    let skippedCount = 0

    for (const file of allFiles) {
      const mimeType = file.mimeType as string

      // Folders are not processable files
      if (mimeType === 'application/vnd.google-apps.folder') {
        skippedCount++
        continue
      }

      // Check if this Drive file was already synced
      const { data: existing } = await supabaseClient
        .from('knowledge_files')
        .select('id')
        .filter('metadata->>drive_file_id', 'eq', file.id as string)
        .maybeSingle()

      const fileRecord = {
        file_name: file.name as string,
        title: file.name as string,
        file_type: mimeType,
        file_size: file.size ? parseInt(file.size as string, 10) : null,
        source_id: source_id ?? null,
        uploaded_by: user.id,
        processing_status: 'pending',
        metadata: {
          drive_file_id: file.id,
          mime_type: mimeType,
          web_view_link: file.webViewLink,
          drive_modified_at: file.modifiedTime,
          synced_from: 'google-drive',
        },
      }

      if (existing) {
        await supabaseClient
          .from('knowledge_files')
          .update({ ...fileRecord, processing_status: 'pending' })
          .eq('id', existing.id)
      } else {
        await supabaseClient
          .from('knowledge_files')
          .insert(fileRecord)
      }

      syncedCount++
    }

    console.log('[google-drive-sync]', {
      userId: user.id,
      total_found: allFiles.length,
      synced: syncedCount,
      skipped: skippedCount,
    })

    return new Response(
      JSON.stringify({
        success: true,
        message: `Synced ${syncedCount} files from Google Drive`,
        synced_count: syncedCount,
        skipped_count: skippedCount,
        total_found: allFiles.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    console.error('[google-drive-sync] Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
