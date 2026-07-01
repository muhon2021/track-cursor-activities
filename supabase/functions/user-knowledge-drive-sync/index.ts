/**
 * User Knowledge Drive Sync Edge Function
 *
 * Syncs files from a user's Google Drive folder into their knowledge base.
 * 1. Gets user's Google OAuth token (refreshes if needed)
 * 2. Lists files from the specified Drive folder
 * 3. Creates/updates user_knowledge_files records
 * 4. Updates user_knowledge_sources sync status
 *
 * Input:  { user_id, source_id, folder_id? }
 * Output: { success, synced: number, skipped: number, failed: number, files: SyncedFile[] }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files'

// File types we can process for the knowledge base
const SUPPORTED_MIME_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/vnd.google-apps.document',
  'application/vnd.google-apps.spreadsheet',
  'application/vnd.google-apps.presentation',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/json',
])

// deno-lint-ignore no-explicit-any
type AnySupabase = ReturnType<typeof createClient<any, any, any>>

/** Refresh an expired Google OAuth token */
async function refreshGoogleToken(
  supabase: AnySupabase,
  tokenRow: { id: string; refresh_token: string }
): Promise<string> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth client credentials not configured')
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokenRow.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Token refresh failed: ${errText}`)
  }

  const tokens = await response.json()
  const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString()

  await supabase
    .from('user_oauth_tokens')
    .update({
      access_token: tokens.access_token,
      expires_at: expiresAt,
      last_refreshed_at: new Date().toISOString(),
      error_message: null,
      error_at: null,
    })
    .eq('id', tokenRow.id)

  return tokens.access_token
}

interface TokenRow {
  id: string
  access_token: string
  refresh_token: string
  expires_at: string | null
  is_active: boolean
}

/** Get a valid Google access token for the user */
async function getValidAccessToken(
  supabase: AnySupabase,
  userId: string
): Promise<string> {
  const { data, error } = await supabase
    .from('user_oauth_tokens')
    .select('id, access_token, refresh_token, expires_at, is_active')
    .eq('user_id', userId)
    .eq('provider_slug', 'google')
    .eq('is_active', true)
    .single()

  if (error || !data) {
    throw new Error('No Google OAuth token found. Please connect your Google account first.')
  }

  const tokenRow = data as TokenRow

  const expiresAt = tokenRow.expires_at ? new Date(tokenRow.expires_at) : null
  const isExpired = !expiresAt || expiresAt.getTime() < Date.now() + 5 * 60 * 1000

  if (isExpired && tokenRow.refresh_token) {
    return await refreshGoogleToken(supabase, { id: tokenRow.id, refresh_token: tokenRow.refresh_token })
  }

  return tokenRow.access_token
}

interface DriveFile {
  id: string
  name: string
  mimeType: string
  size?: string
  modifiedTime: string
  webViewLink?: string
}

/** List files from a Google Drive folder */
async function listDriveFiles(
  accessToken: string,
  folderId: string
): Promise<DriveFile[]> {
  const allFiles: DriveFile[] = []
  let pageToken: string | undefined

  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken,files(id,name,mimeType,size,modifiedTime,webViewLink)',
      pageSize: '100',
      orderBy: 'modifiedTime desc',
    })
    if (pageToken) params.set('pageToken', pageToken)

    const response = await fetch(`${DRIVE_FILES_URL}?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Google Drive list failed (${response.status}): ${errText}`)
    }

    const data = await response.json()
    allFiles.push(...(data.files || []))
    pageToken = data.nextPageToken
  } while (pageToken)

  return allFiles
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

    const { user_id, source_id, folder_id } = await req.json()

    if (!user_id || !source_id) {
      return new Response(
        JSON.stringify({ error: 'user_id and source_id are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Resolve folder_id: prefer param, fallback to source's source_identifier
    let targetFolderId = folder_id
    if (!targetFolderId) {
      const { data: source } = await supabaseClient
        .from('user_knowledge_sources')
        .select('source_identifier, sync_config')
        .eq('id', source_id)
        .eq('user_id', user_id)
        .single()

      targetFolderId = source?.source_identifier || source?.sync_config?.folder_id
    }

    if (!targetFolderId) {
      return new Response(
        JSON.stringify({ error: 'folder_id is required (either in request or source config)' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Update sync status to running
    await supabaseClient
      .from('user_knowledge_sources')
      .update({
        sync_status: 'syncing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', source_id)

    // Get valid Google access token
    const accessToken = await getValidAccessToken(supabaseClient, user_id)

    // List files from Drive folder
    const driveFiles = await listDriveFiles(accessToken, targetFolderId)

    // Get existing knowledge files for this source (to detect already-synced files)
    const { data: existingFiles } = await supabaseClient
      .from('user_knowledge_files')
      .select('id, source_id, metadata')
      .eq('user_id', user_id)
      .eq('source_id', source_id)

    const existingDriveIds = new Set(
      (existingFiles || [])
        .map((f: { metadata: Record<string, unknown> }) => f.metadata?.drive_file_id)
        .filter(Boolean)
    )

    let synced = 0
    let skipped = 0
    let failed = 0
    const syncedFiles: { name: string; drive_id: string; status: string }[] = []

    for (const file of driveFiles) {
      // Skip unsupported file types
      if (!SUPPORTED_MIME_TYPES.has(file.mimeType)) {
        skipped++
        syncedFiles.push({ name: file.name, drive_id: file.id, status: 'unsupported_type' })
        continue
      }

      // Skip already-synced files
      if (existingDriveIds.has(file.id)) {
        skipped++
        syncedFiles.push({ name: file.name, drive_id: file.id, status: 'already_synced' })
        continue
      }

      // Create knowledge file record
      try {
        const { error: insertError } = await supabaseClient
          .from('user_knowledge_files')
          .insert({
            user_id,
            source_id,
            title: file.name,
            file_name: file.name,
            file_type: file.mimeType,
            file_size: file.size ? parseInt(file.size) : null,
            processing_status: 'pending',
            metadata: {
              drive_file_id: file.id,
              drive_modified_time: file.modifiedTime,
              drive_web_link: file.webViewLink,
              synced_at: new Date().toISOString(),
            },
          })

        if (insertError) {
          console.error(`Failed to insert file ${file.name}:`, insertError)
          failed++
          syncedFiles.push({ name: file.name, drive_id: file.id, status: 'insert_failed' })
        } else {
          synced++
          syncedFiles.push({ name: file.name, drive_id: file.id, status: 'synced' })
        }
      } catch (err) {
        console.error(`Error syncing file ${file.name}:`, err)
        failed++
        syncedFiles.push({ name: file.name, drive_id: file.id, status: 'error' })
      }
    }

    // Update source sync status
    await supabaseClient
      .from('user_knowledge_sources')
      .update({
        sync_status: failed > 0 && synced === 0 ? 'failed' : 'completed',
        last_synced_at: new Date().toISOString(),
        file_count: (existingFiles?.length || 0) + synced,
        updated_at: new Date().toISOString(),
      })
      .eq('id', source_id)

    // Update last_used_at on the token
    await supabaseClient
      .from('user_oauth_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('user_id', user_id)
      .eq('provider_slug', 'google')

    return new Response(
      JSON.stringify({
        success: true,
        total_drive_files: driveFiles.length,
        synced,
        skipped,
        failed,
        files: syncedFiles,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    console.error('User knowledge drive sync error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
