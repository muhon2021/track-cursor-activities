/**
 * User OAuth Refresh Edge Function
 * Sprint 10: User Integration Connections
 * Refreshes expired OAuth tokens
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

const getTokenEndpoint = (provider: string): string => {
  const endpoints: Record<string, string> = {
    google: "https://oauth2.googleapis.com/token",
    "google-meet": "https://oauth2.googleapis.com/token",
    "google-drive": "https://oauth2.googleapis.com/token",
    zoom: "https://zoom.us/oauth/token",
    microsoft: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    outlook: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    clickup: "https://api.clickup.com/api/v2/oauth/token",
  };
  return endpoints[provider] || "";
};

const getOutlookTokenEndpoint = (config: Record<string, unknown>): string => {
  const tenant =
    (config.tenant_id as string) ||
    (config.directory_id as string) ||
    (config.microsoft_tenant_id as string) ||
    (config.outlook_tenant_id as string);
  const t = tenant?.trim();
  if (t) return `https://login.microsoftonline.com/${t}/oauth2/v2.0/token`;
  return "https://login.microsoftonline.com/common/oauth2/v2.0/token";
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { provider } = await req.json();

    if (!provider) {
      return new Response(
        JSON.stringify({ error: "Provider is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's existing token
    const { data: userToken, error: tokenError } = await supabase
      .from("user_oauth_tokens")
      .select("*")
      .eq("user_id", user.id)
      .eq("provider_slug", provider)
      .single();

    if (tokenError || !userToken) {
      return new Response(
        JSON.stringify({ error: "No existing connection found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!userToken.refresh_token) {
      // No refresh token available - need to re-authenticate
      return new Response(
        JSON.stringify({
          error: "No refresh token available",
          requires_reauth: true,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Per-user organization_integrations row (client_id / client_secret in config JSONB)
    const { data: orgIntegration, error: orgError } = await supabase
      .from("organization_integrations")
      .select("*, integration_providers!inner(*)")
      .eq("integration_providers.slug", provider)
      .eq("user_id", user.id)
      .eq("enabled", true)
      .single();

    if (orgError || !orgIntegration) {
      return new Response(
        JSON.stringify({ error: "Provider configuration not found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rawConfig = (orgIntegration.config || orgIntegration.credentials || {}) as Record<string, string>;
    const { client_id, client_secret } = rawConfig;

    if (!client_id || !client_secret) {
      return new Response(
        JSON.stringify({ error: "Provider not properly configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tokenEndpoint = provider === "outlook"
      ? getOutlookTokenEndpoint(rawConfig as unknown as Record<string, unknown>)
      : getTokenEndpoint(provider);
    const refreshParams = new URLSearchParams({
      client_id,
      client_secret,
      refresh_token: userToken.refresh_token,
      grant_type: "refresh_token",
    });

    const tokenResponse = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: refreshParams.toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token refresh failed:", errorText);

      // Update token record with error
      await supabase
        .from("user_oauth_tokens")
        .update({
          error_message: "Token refresh failed. Please reconnect.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", userToken.id);

      return new Response(
        JSON.stringify({
          error: "Failed to refresh token",
          requires_reauth: true,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tokens: TokenResponse = await tokenResponse.json();

    // Calculate new expiration time
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Update the token record
    const { error: updateError } = await supabase
      .from("user_oauth_tokens")
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || userToken.refresh_token, // Some providers don't return new refresh token
        expires_at: expiresAt,
        scopes: tokens.scope?.split(" ") || userToken.scopes,
        is_active: true,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userToken.id);

    if (updateError) {
      console.error("Failed to update tokens:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to save refreshed token" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        expires_at: expiresAt,
        message: "Token refreshed successfully",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("User OAuth refresh error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
