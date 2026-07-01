/**
 * Google Drive Upload Edge Function
 *
 * Uploads a file to Google Drive using the user's OAuth token.
 * Supports both base64-encoded content and Storage bucket references.
 *
 * Input:  { user_id, file_name, mime_type, content_base64?, storage_path?, folder_id?, description? }
 * Output: { success, file: { id, name, webViewLink, size } }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink,createdTime'

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

  // Persist new access token
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

  // Check if token is expired (with 5-min buffer)
  const expiresAt = tokenRow.expires_at ? new Date(tokenRow.expires_at) : null
  const isExpired = !expiresAt || expiresAt.getTime() < Date.now() + 5 * 60 * 1000

  if (isExpired && tokenRow.refresh_token) {
    return await refreshGoogleToken(supabase, { id: tokenRow.id, refresh_token: tokenRow.refresh_token })
  }

  return tokenRow.access_token
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

    const {
      user_id,
      file_name,
      mime_type,
      content_base64,
      storage_path,
      folder_id,
      description,
    } = await req.json()

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    if (!file_name) {
      return new Response(
        JSON.stringify({ error: 'file_name is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    if (!content_base64 && !storage_path) {
      return new Response(
        JSON.stringify({ error: 'content_base64 or storage_path is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Get valid Google access token
    const accessToken = await getValidAccessToken(supabaseClient, user_id)

    // Resolve file content
    let fileBytes: Uint8Array
    if (content_base64) {
      // Decode base64 content
      const binaryStr = atob(content_base64)
      fileBytes = new Uint8Array(binaryStr.length)
      for (let i = 0; i < binaryStr.length; i++) {
        fileBytes[i] = binaryStr.charCodeAt(i)
      }
    } else if (storage_path) {
      // Download from Supabase Storage
      const { data, error: downloadError } = await supabaseClient.storage
        .from('knowledge-files')
        .download(storage_path)

      if (downloadError || !data) {
        throw new Error(`Failed to download from storage: ${downloadError?.message || 'File not found'}`)
      }

      fileBytes = new Uint8Array(await data.arrayBuffer())
    } else {
      throw new Error('No file content provided')
    }

    // Build multipart upload request
    const fileMeta: Record<string, unknown> = {
      name: file_name,
      mimeType: mime_type || 'application/octet-stream',
    }
    if (folder_id) {
      fileMeta.parents = [folder_id]
    }
    if (description) {
      fileMeta.description = description
    }

    const boundary = '---supabase-drive-upload-boundary'
    const metadataPart = JSON.stringify(fileMeta)

    const encoder = new TextEncoder()
    const parts = [
      encoder.encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadataPart}\r\n`),
      encoder.encode(`--${boundary}\r\nContent-Type: ${fileMeta.mimeType}\r\n\r\n`),
      fileBytes,
      encoder.encode(`\r\n--${boundary}--`),
    ]

    // Combine parts into a single body
    const totalLength = parts.reduce((sum, p) => sum + p.length, 0)
    const body = new Uint8Array(totalLength)
    let offset = 0
    for (const part of parts) {
      body.set(part, offset)
      offset += part.length
    }

    // Upload to Google Drive
    const uploadResponse = await fetch(DRIVE_UPLOAD_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': String(totalLength),
      },
      body: body,
    })

    if (!uploadResponse.ok) {
      const errText = await uploadResponse.text()

      // Mark token as errored if auth failed
      if (uploadResponse.status === 401 || uploadResponse.status === 403) {
        await supabaseClient
          .from('user_oauth_tokens')
          .update({
            error_message: `Upload auth failed: ${uploadResponse.status}`,
            error_at: new Date().toISOString(),
          })
          .eq('user_id', user_id)
          .eq('provider_slug', 'google')
      }

      throw new Error(`Google Drive upload failed (${uploadResponse.status}): ${errText}`)
    }

    const driveFile = await uploadResponse.json()

    // Update last_used_at on the token
    await supabaseClient
      .from('user_oauth_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('user_id', user_id)
      .eq('provider_slug', 'google')

    return new Response(
      JSON.stringify({
        success: true,
        file: {
          id: driveFile.id,
          name: driveFile.name,
          mimeType: driveFile.mimeType,
          size: driveFile.size,
          webViewLink: driveFile.webViewLink,
          createdTime: driveFile.createdTime,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    console.error('Google Drive upload error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
