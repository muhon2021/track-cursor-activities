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

    const { action, client_id, client_secret, user_id } = await req.json()

    if (!action) {
      return new Response(
        JSON.stringify({ error: 'action is required (status, connect, disconnect, refresh)' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Helper: find Zoom integration record
    const findZoomIntegration = async (filterUserId?: string) => {
      let query = supabaseClient
        .from('organization_integrations')
        .select('*, integration_providers!inner(slug)')
        .eq('integration_providers.slug', 'zoom')

      if (filterUserId) {
        query = query.eq('user_id', filterUserId)
      }

      const { data, error } = await query.maybeSingle()
      return { data, error }
    }

    // Helper: find Zoom provider ID
    const getZoomProviderId = async () => {
      const { data, error } = await supabaseClient
        .from('integration_providers')
        .select('id')
        .eq('slug', 'zoom')
        .maybeSingle()

      if (error || !data) {
        throw new Error('Zoom integration provider not found in the system')
      }
      return data.id
    }

    switch (action) {
      case 'status': {
        const { data: integration } = await findZoomIntegration(user_id)

        if (!integration) {
          return new Response(
            JSON.stringify({
              connected: false,
              token_valid: false,
              expires_at: null,
              last_refreshed: null,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const oauthTokens = integration.oauth_tokens as Record<string, unknown> | null
        const expiresAt = oauthTokens?.expires_at as string | null
        const tokenValid = expiresAt ? new Date(expiresAt) > new Date() : false

        return new Response(
          JSON.stringify({
            connected: integration.connection_status === 'connected',
            token_valid: tokenValid,
            expires_at: expiresAt || null,
            last_refreshed: integration.last_sync_at || null,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'connect': {
        if (!client_id || !client_secret) {
          return new Response(
            JSON.stringify({ error: 'client_id and client_secret are required for connect action' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          )
        }

        if (!user_id) {
          return new Response(
            JSON.stringify({ error: 'user_id is required for connect action' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          )
        }

        // Validate credentials by attempting OAuth token exchange (client_credentials)
        const tokenUrl = 'https://zoom.us/oauth/token'
        const credentials = btoa(`${client_id}:${client_secret}`)

        const tokenResponse = await fetch(tokenUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: 'grant_type=account_credentials&account_id=' + (Deno.env.get('ZOOM_ACCOUNT_ID') || ''),
        })

        if (!tokenResponse.ok) {
          const errorData = await tokenResponse.text()
          console.error('Zoom OAuth validation failed:', errorData)
          return new Response(
            JSON.stringify({ error: 'Failed to validate Zoom credentials', details: errorData }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          )
        }

        const tokenData = await tokenResponse.json()
        const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString()

        // Get the Zoom provider ID
        const providerId = await getZoomProviderId()

        // Upsert organization integration
        const { data: existing } = await findZoomIntegration(user_id)

        if (existing) {
          const { error: updateError } = await supabaseClient
            .from('organization_integrations')
            .update({
              config: { client_id, client_secret },
              oauth_tokens: {
                access_token: tokenData.access_token,
                refresh_token: tokenData.refresh_token || null,
                expires_at: expiresAt,
                token_type: tokenData.token_type,
                scope: tokenData.scope,
              },
              connection_status: 'connected',
              connection_message: 'Successfully connected to Zoom',
              last_tested_at: new Date().toISOString(),
              enabled: true,
            })
            .eq('id', existing.id)

          if (updateError) throw updateError
        } else {
          const { error: insertError } = await supabaseClient
            .from('organization_integrations')
            .insert({
              provider_id: providerId,
              user_id,
              config: { client_id, client_secret },
              oauth_tokens: {
                access_token: tokenData.access_token,
                refresh_token: tokenData.refresh_token || null,
                expires_at: expiresAt,
                token_type: tokenData.token_type,
                scope: tokenData.scope,
              },
              connection_status: 'connected',
              connection_message: 'Successfully connected to Zoom',
              last_tested_at: new Date().toISOString(),
              enabled: true,
            })

          if (insertError) throw insertError
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Zoom account connected successfully',
            connected: true,
            token_valid: true,
            expires_at: expiresAt,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'disconnect': {
        const { data: integration } = await findZoomIntegration(user_id)

        if (!integration) {
          return new Response(
            JSON.stringify({ error: 'No Zoom integration found to disconnect' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
          )
        }

        // Clear OAuth tokens and mark as disconnected
        const { error: updateError } = await supabaseClient
          .from('organization_integrations')
          .update({
            oauth_tokens: null,
            config: null,
            connection_status: 'disconnected',
            connection_message: 'Zoom integration disconnected',
            enabled: false,
          })
          .eq('id', integration.id)

        if (updateError) throw updateError

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Zoom account disconnected successfully',
            connected: false,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'refresh': {
        const { data: integration } = await findZoomIntegration(user_id)

        if (!integration) {
          return new Response(
            JSON.stringify({ error: 'No Zoom integration found' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
          )
        }

        const oauthTokens = integration.oauth_tokens as Record<string, unknown> | null
        const config = integration.config as Record<string, unknown> | null
        const refreshToken = oauthTokens?.refresh_token as string | null
        const storedClientId = config?.client_id as string | null
        const storedClientSecret = config?.client_secret as string | null

        if (!storedClientId || !storedClientSecret) {
          return new Response(
            JSON.stringify({ error: 'Zoom client credentials not found. Please reconnect.' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          )
        }

        const tokenUrl = 'https://zoom.us/oauth/token'
        const credentials = btoa(`${storedClientId}:${storedClientSecret}`)

        let tokenBody: string
        if (refreshToken) {
          tokenBody = `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`
        } else {
          // Fall back to account credentials flow if no refresh token
          tokenBody = 'grant_type=account_credentials&account_id=' + (Deno.env.get('ZOOM_ACCOUNT_ID') || '')
        }

        const tokenResponse = await fetch(tokenUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: tokenBody,
        })

        if (!tokenResponse.ok) {
          const errorData = await tokenResponse.text()
          console.error('Zoom token refresh failed:', errorData)
          return new Response(
            JSON.stringify({ error: 'Failed to refresh Zoom token', details: errorData }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          )
        }

        const tokenData = await tokenResponse.json()
        const newExpiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString()

        const { error: updateError } = await supabaseClient
          .from('organization_integrations')
          .update({
            oauth_tokens: {
              access_token: tokenData.access_token,
              refresh_token: tokenData.refresh_token || refreshToken,
              expires_at: newExpiresAt,
              token_type: tokenData.token_type,
              scope: tokenData.scope,
            },
            connection_status: 'connected',
            connection_message: 'Token refreshed successfully',
            last_sync_at: new Date().toISOString(),
            last_tested_at: new Date().toISOString(),
          })
          .eq('id', integration.id)

        if (updateError) throw updateError

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Zoom token refreshed successfully',
            token_valid: true,
            expires_at: newExpiresAt,
            last_refreshed: new Date().toISOString(),
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}. Supported actions: status, connect, disconnect, refresh` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
  } catch (error: unknown) {
    console.error('Manage Zoom account error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
