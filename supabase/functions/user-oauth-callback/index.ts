/**
 * User OAuth Callback Edge Function
 * Sprint 10: User Integration Connections
 * Handles OAuth callback and exchanges code for tokens
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
  expires_in?: number;
  token_type: string;
  scope?: string;
}

interface UserInfo {
  email?: string;
  name?: string;
  picture?: string;
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

/** Outlook: single-tenant token URL when tenant* is stored in org config */
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

const getUserInfo = async (provider: string, accessToken: string): Promise<UserInfo> => {
  let url = "";
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  };

  switch (provider) {
    case "google":
    case "google-meet":
    case "google-drive":
      url = "https://www.googleapis.com/oauth2/v2/userinfo";
      break;
    case "zoom":
      url = "https://api.zoom.us/v2/users/me";
      break;
    case "microsoft":
    case "outlook":
      url = "https://graph.microsoft.com/v1.0/me";
      break;
    case "clickup":
      url = "https://api.clickup.com/api/v2/user";
      break;
    default:
      return {};
  }

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      console.error(`Failed to fetch user info from ${provider}:`, await response.text());
      return {};
    }

    const data = await response.json();

    // Normalize the response
    switch (provider) {
      case "google":
      case "google-meet":
      case "google-drive":
        return {
          email: data.email,
          name: data.name,
          picture: data.picture,
        };
      case "zoom":
        return {
          email: data.email,
          name: `${data.first_name} ${data.last_name}`.trim(),
          picture: data.pic_url,
        };
      case "microsoft":
      case "outlook":
        return {
          email: data.mail || data.userPrincipalName,
          name: data.displayName,
          picture: undefined, // MS Graph requires separate call for photo
        };
      case "clickup":
        return {
          email: data.user?.email ?? undefined,
          name: data.user?.username ?? data.user?.full_name ?? undefined,
          picture: undefined,
        };
      default:
        return {};
    }
  } catch (error) {
    console.error(`Error fetching user info from ${provider}:`, error);
    return {};
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const appUrl = Deno.env.get("APP_URL") || "https://controltowerdemo.collabai.software";

    // Get callback parameters
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");
    const errorDescription = url.searchParams.get("error_description");

    // Handle error from provider
    if (error) {
      console.error("OAuth error:", error, errorDescription);
      return Response.redirect(`${appUrl}/settings?error=${encodeURIComponent(errorDescription || error)}`);
    }

    if (!code || !state) {
      return Response.redirect(`${appUrl}/settings?error=${encodeURIComponent("Missing code or state parameter")}`);
    }

    // Verify state and get stored data
    const { data: stateData, error: stateError } = await supabase
      .from("oauth_states")
      .select("*")
      .eq("state", state)
      .single();

    if (stateError || !stateData) {
      return Response.redirect(`${appUrl}/settings?error=${encodeURIComponent("Invalid or expired state")}`);
    }

    // Check if state is expired
    if (new Date(stateData.expires_at) < new Date()) {
      // Delete expired state
      await supabase.from("oauth_states").delete().eq("state", state);
      return Response.redirect(
        `${appUrl}/settings?error=${encodeURIComponent("OAuth session expired. Please try again.")}`,
      );
    }

    const { user_id, provider, redirect_uri } = stateData;

    // Organization integration for this user (organization_integrations.user_id)
    const { data: orgIntegration, error: orgError } = await supabase
      .from("organization_integrations")
      .select("*, integration_providers!inner(*)")
      .eq("integration_providers.slug", provider)
      .eq("user_id", user_id)
      .eq("enabled", true)
      .eq("connection_status", "connected")
      .single();

    if (orgError || !orgIntegration) {
      return Response.redirect(`${appUrl}/settings?error=${encodeURIComponent("Provider configuration not found")}`);
    }

    // Get credentials from config JSONB field (fallback to credentials for backward compatibility)
    const config = orgIntegration.config || orgIntegration.credentials || {};
    const { client_id, client_secret } = config;

    if (!client_id || !client_secret) {
      return Response.redirect(
        `${appUrl}/settings?error=${encodeURIComponent("Provider not properly configured. Please add Client ID and Client Secret in the integration settings.")}`,
      );
    }

    // Exchange code for tokens
    const tokenCfg = config as Record<string, unknown>;
    const tokenEndpoint = provider === "outlook" ? getOutlookTokenEndpoint(tokenCfg) : getTokenEndpoint(provider);

    const tokenParams = new URLSearchParams({
      code,
      client_id,
      client_secret,
      redirect_uri: `${supabaseUrl}/functions/v1/user-oauth-callback`,
      grant_type: "authorization_code",
    });

    const tokenResponse = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token exchange failed:", errorText);
      return Response.redirect(`${appUrl}/settings?error=${encodeURIComponent("Failed to exchange code for token")}`);
    }

    const tokens: TokenResponse = await tokenResponse.json();

    // Get user info from provider
    const userInfo = await getUserInfo(provider, tokens.access_token);

    // Calculate expiration time
    // Some providers (e.g. ClickUp) do not return expires_in; in that case store NULL and treat as non-expiring.
    let expiresAt: string | null = null;
    if (tokens.expires_in && tokens.expires_in > 0) {
      expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    }

    // Store tokens in user_oauth_tokens
    const { error: upsertError } = await supabase.from("user_oauth_tokens").upsert(
      {
        user_id,
        provider_slug: provider,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
        scopes: tokens.scope?.split(" ") || [],
        account_email: userInfo.email,
        account_name: userInfo.name,
        account_avatar_url: userInfo.picture,
        is_active: true,
        error_message: null,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,provider_slug",
      },
    );

    if (upsertError) {
      console.error("Failed to store tokens:", upsertError);
      return Response.redirect(`${appUrl}/settings?error=${encodeURIComponent("Failed to save connection")}`);
    }

    // Delete the used state
    await supabase.from("oauth_states").delete().eq("state", state);

    // Redirect back to app with success. Use redirect_uri from state when the client sent one (e.g. user
    // connected from Create Meeting dialog → return to /meetings/schedule). When connecting from admin,
    // redirect_uri is the default (appUrl/settings), so we ignore it and use provider-specific admin page.
    const defaultSettingsRedirect = `${appUrl}/settings`;
    const hasValidRedirect =
      redirect_uri &&
      redirect_uri.trim() !== "" &&
      !redirect_uri.includes("undefined") &&
      redirect_uri !== defaultSettingsRedirect;
    let finalRedirect: string;
    if (hasValidRedirect) {
      finalRedirect = redirect_uri!.startsWith("http")
        ? redirect_uri!
        : `${appUrl}${redirect_uri!.startsWith("/") ? "" : "/"}${redirect_uri}`;
    } else if (provider === "zoom") {
      finalRedirect = `${appUrl}/admin/integrations/zoom`;
    } else if (provider === "google-meet") {
      finalRedirect = `${appUrl}/admin/integrations/google-meet`;
    } else if (provider === "google-drive") {
      finalRedirect = `${appUrl}/admin/integrations/google-drive`;
    } else if (provider === "outlook") {
      finalRedirect = `${appUrl}/admin/integrations/outlook`;
    } else {
      // For ClickUp and any other providers without a dedicated admin page,
      // send users back to the main Settings page where Connected Services lives.
      finalRedirect = `${appUrl}/settings`;
    }
    return Response.redirect(`${finalRedirect}?connected=${provider}`);
  } catch (error: unknown) {
    console.error("User OAuth callback error:", error);
    const appUrl = Deno.env.get("APP_URL") || "https://controltowerdemo.collabai.software";
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.redirect(`${appUrl}/settings?error=${encodeURIComponent(message)}`);
  }
});
