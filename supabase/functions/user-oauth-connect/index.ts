/**
 * User OAuth Connect Edge Function
 * Sprint 10: User Integration Connections
 * Initiates OAuth flow for user-level integrations
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// OAuth configurations for each provider
interface OAuthConfig {
  authUrl: string;
  scopes: string[];
  additionalParams?: Record<string, string>;
}

const getProviderConfig = (provider: string): OAuthConfig | null => {
  const configs: Record<string, OAuthConfig> = {
    google: {
      authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      scopes: [
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/calendar.readonly",
        "https://www.googleapis.com/auth/drive.readonly",
      ],
      additionalParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
    clickup: {
      authUrl: "https://app.clickup.com/api",
      // ClickUp does not currently use OAuth scopes; keep empty array for compatibility
      scopes: [],
    },
    "google-meet": {
      authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      scopes: [
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/calendar.events",
        "https://www.googleapis.com/auth/meetings.space.created",
      ],
      additionalParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
    "google-drive": {
      authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      scopes: [
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/drive.readonly",
      ],
      additionalParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
    zoom: {
      authUrl: "https://zoom.us/oauth/authorize",
      scopes: [
        "meeting:read:meeting",
        "meeting:write:meeting",
        "meeting:write:open_app",
        "meeting:write:registrant",
        "user:read:user",
        "cloud_recording:read:list_user_recordings",
        "cloud_recording:read:list_recording_files",
        "cloud_recording:read:list_recording_registrants",
        "meeting:read:meeting:admin",
        "meeting:write:meeting:admin",
        "meeting:write:registrant:admin",
        "user:read:user:admin",
        "user:read:email:admin",
      ],
    },
    microsoft: {
      authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
      scopes: ["openid", "email", "profile", "offline_access", "Calendars.Read", "OnlineMeetings.Read"],
      additionalParams: {
        response_mode: "query",
      },
    },
    /** Integration Hub Outlook / Microsoft Graph (mail + calendar); distinct from Teams MSAL flow */
    outlook: {
      authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
      scopes: [
        "openid",
        "email",
        "profile",
        "offline_access",
        "User.Read",
        "Mail.Read",
        "Mail.Send",
        "Calendars.ReadWrite",
      ],
      additionalParams: {
        response_mode: "query",
      },
    },
  };

  return configs[provider] || null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract token and validate with ES256 compatibility
    const token = authHeader.replace("Bearer ", "");

    // Create client with user's auth context for validation
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Validate JWT by passing token explicitly (required for ES256/Lovable Cloud)
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser(token);

    // Create admin client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { provider, redirect_uri, additional_scopes } = await req.json();

    if (!provider) {
      return new Response(JSON.stringify({ error: "Provider is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get provider configuration
    const providerConfig = getProviderConfig(provider);
    if (!providerConfig) {
      return new Response(JSON.stringify({ error: `Unsupported provider: ${provider}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // First get the provider ID from slug
    const { data: providerData, error: providerError } = await supabase
      .from("integration_providers")
      .select("id")
      .eq("slug", provider)
      .single();

    if (providerError || !providerData) {
      return new Response(JSON.stringify({ error: `Unknown provider: ${provider}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Per-user org integration row (this project stores user_id on organization_integrations)
    const { data: orgIntegration, error: orgError } = await supabase
      .from("organization_integrations")
      .select("*")
      .eq("provider_id", providerData.id)
      .eq("user_id", user.id)
      .eq("enabled", true)
      .eq("connection_status", "connected")
      .single();

    if (orgError || !orgIntegration) {
      console.log("Org integration check failed:", { orgError, provider, providerId: providerData.id });
      return new Response(JSON.stringify({ error: `Provider ${provider} is not enabled for this organization` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get client credentials from organization integration
    // Note: credentials are stored in config JSONB field
    const clientId = orgIntegration.config?.client_id || orgIntegration.credentials?.client_id;
    if (!clientId) {
      return new Response(
        JSON.stringify({
          error: `Provider ${provider} is not properly configured. Please add Client ID in the integration settings.`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Generate state parameter for security
    const state = crypto.randomUUID();

    // Store state in database for verification
    const defaultAppUrl = Deno.env.get("APP_URL") || "https://controltowerdemo.collabai.software";
    await supabase.from("oauth_states").insert({
      state,
      user_id: user.id,
      provider,
      redirect_uri: redirect_uri || `${defaultAppUrl}/settings`,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
    });

    // Build scopes
    const scopes = [...providerConfig.scopes];
    if (additional_scopes && Array.isArray(additional_scopes)) {
      scopes.push(...additional_scopes);
    }

    let authorizeBaseUrl = providerConfig.authUrl;
    if (provider === "outlook") {
      const cfg = (orgIntegration.config || {}) as Record<string, string | undefined>;
      const tenant =
        cfg.tenant_id ||
        cfg.directory_id ||
        cfg.microsoft_tenant_id ||
        cfg.outlook_tenant_id ||
        Deno.env.get("AZURE_AD_TENANT_ID") ||
        Deno.env.get("MICROSOFT_DIRECTORY_ID");
      const t = tenant?.trim();
      if (t) {
        authorizeBaseUrl = `https://login.microsoftonline.com/${t}/oauth2/v2.0/authorize`;
      }
    }

    // Build the authorization URL
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: `${supabaseUrl}/functions/v1/user-oauth-callback`,
      response_type: "code",
      scope: scopes.join(" "),
      state,
      ...providerConfig.additionalParams,
    });

    const authorizationUrl = `${authorizeBaseUrl}?${params.toString()}`;

    return new Response(
      JSON.stringify({
        authorization_url: authorizationUrl,
        state,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("User OAuth connect error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});