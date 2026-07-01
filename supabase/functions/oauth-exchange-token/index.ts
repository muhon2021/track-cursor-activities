import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Parse and validate request body
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid JSON in request body' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const { code, providerId, redirectUri } = requestBody;

    if (!code || !providerId || !redirectUri) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Missing required parameters: code, providerId, or redirectUri'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }

    // Fetch provider details including OAuth config
    const { data: provider, error: providerError } = await supabaseClient
      .from('integration_providers')
      .select('id, name, slug, oauth_config')
      .eq('id', providerId)
      .single();

    if (providerError || !provider || !provider.oauth_config) {
      console.error('Provider fetch error:', providerError);
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Provider not found or OAuth not configured'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404
        }
      );
    }

    const oauthConfig = provider.oauth_config as {
      token_url: string;
      client_id?: string;
      client_secret?: string;
      grant_type?: string;
    };

    // Get client credentials from environment variables or OAuth config
    // In production, store these in Supabase secrets or Vault
    const clientId = oauthConfig.client_id || Deno.env.get(`${provider.slug.toUpperCase()}_CLIENT_ID`);
    const clientSecret = oauthConfig.client_secret || Deno.env.get(`${provider.slug.toUpperCase()}_CLIENT_SECRET`);

    if (!clientId || !clientSecret) {
      console.error('Missing OAuth credentials for provider:', provider.slug);
      return new Response(
        JSON.stringify({
          success: false,
          message: 'OAuth client credentials not configured for this provider'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      );
    }

    // Exchange authorization code for tokens
    const tokenRequestBody = new URLSearchParams({
      grant_type: oauthConfig.grant_type || 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    });

    console.log('Exchanging code for tokens with:', provider.slug);

    const tokenResponse = await fetch(oauthConfig.token_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: tokenRequestBody.toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      return new Response(
        JSON.stringify({
          success: false,
          message: `Token exchange failed: ${tokenResponse.statusText}`,
          details: errorText,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: tokenResponse.status
        }
      );
    }

    const tokenData = await tokenResponse.json();

    // Extract tokens from response
    const {
      access_token,
      refresh_token,
      expires_in,
      token_type,
      scope,
    } = tokenData;

    if (!access_token) {
      console.error('No access token in response:', tokenData);
      return new Response(
        JSON.stringify({
          success: false,
          message: 'No access token received from provider'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      );
    }

    // Calculate token expiration
    const expiresAt = expires_in
      ? new Date(Date.now() + expires_in * 1000).toISOString()
      : null;

    // Get the authorization header to extract user info
    const authHeader = req.headers.get('Authorization');

    // Get user from JWT token
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader?.replace('Bearer ', '') || ''
    );

    if (userError || !user) {
      console.error('User authentication error:', userError);
      return new Response(
        JSON.stringify({
          success: false,
          message: 'User authentication failed'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401
        }
      );
    }

    // Get user's organization
    const { data: userData } = await supabaseClient
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    const organizationId = userData?.organization_id;

    // Store or update the integration with OAuth tokens
    const { data: existingIntegration } = await supabaseClient
      .from('organization_integrations')
      .select('id')
      .eq('provider_id', providerId)
      .eq('organization_id', organizationId)
      .single();

    const integrationData = {
      organization_id: organizationId,
      provider_id: providerId,
      enabled: true,
      config: {},
      oauth_tokens: {
        access_token,
        refresh_token: refresh_token || null,
        token_type: token_type || 'Bearer',
        expires_at: expiresAt,
        scope: scope || null,
      },
      connection_status: 'connected',
      connection_message: 'Successfully connected via OAuth',
      last_tested_at: new Date().toISOString(),
    };

    let integrationResult;

    if (existingIntegration) {
      // Update existing integration
      integrationResult = await supabaseClient
        .from('organization_integrations')
        .update(integrationData)
        .eq('id', existingIntegration.id)
        .select()
        .single();
    } else {
      // Create new integration
      integrationResult = await supabaseClient
        .from('organization_integrations')
        .insert(integrationData)
        .select()
        .single();
    }

    if (integrationResult.error) {
      console.error('Integration save error:', integrationResult.error);
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Failed to save integration credentials',
          details: integrationResult.error.message,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      );
    }

    // Success!
    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully connected to ${provider.name}`,
        integration: integrationResult.data,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error: unknown) {
    console.error('Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        success: false,
        message: `Unexpected error: ${message}`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
