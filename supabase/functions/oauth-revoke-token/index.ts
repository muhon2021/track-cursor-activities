/**
 * OAuth Revoke Token Edge Function
 *
 * Revokes an OAuth access token at the provider's revocation endpoint.
 * Used by oauth-token-manager for lightweight token revocation.
 *
 * Input:  { providerId, accessToken }
 * Output: { success: boolean, error?: string }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const REVOKE_ENDPOINTS: Record<string, string> = {
  google: 'https://oauth2.googleapis.com/revoke',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { providerId, accessToken } = await req.json()

    if (!providerId || !accessToken) {
      return new Response(
        JSON.stringify({ error: 'providerId and accessToken are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const revokeUrl = REVOKE_ENDPOINTS[providerId]

    if (!revokeUrl) {
      // Provider doesn't support token revocation — treat as success
      return new Response(
        JSON.stringify({
          success: true,
          message: `Provider '${providerId}' does not have a revocation endpoint`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Call the provider's revocation endpoint
    const response = await fetch(`${revokeUrl}?token=${encodeURIComponent(accessToken)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error(`Token revocation failed for ${providerId}:`, errText)

      // Some providers return errors for already-expired/revoked tokens — still treat as success
      if (response.status === 400) {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Token may already be revoked or expired',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: `Revocation failed (${response.status}): ${errText}`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    console.error('OAuth revoke token error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
