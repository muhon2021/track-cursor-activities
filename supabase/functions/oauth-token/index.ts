/**
 * OAuth Token Endpoint
 *
 * Exchanges authorization codes for access tokens.
 * Also handles refresh token grants.
 *
 * Endpoint: POST /functions/v1/oauth-token
 *
 * Body (application/x-www-form-urlencoded or application/json):
 * - grant_type (required): 'authorization_code' or 'refresh_token'
 * - code (required for authorization_code): The authorization code
 * - refresh_token (required for refresh_token): The refresh token
 * - redirect_uri (required for authorization_code): Must match the one from /authorize
 * - client_id (required): OAuth client identifier
 * - client_secret (required): OAuth client secret
 * - code_verifier (optional): PKCE code verifier
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { encode as hexEncode } from "https://deno.land/std@0.168.0/encoding/hex.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body (support both JSON and form-urlencoded)
    const contentType = req.headers.get("content-type") || "";
    let params: Record<string, string> = {};

    if (contentType.includes("application/json")) {
      params = await req.json();
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const body = await req.text();
      const urlParams = new URLSearchParams(body);
      urlParams.forEach((value, key) => {
        params[key] = value;
      });
    } else {
      return new Response(
        JSON.stringify({
          error: "invalid_request",
          error_description: "Content-Type must be application/json or application/x-www-form-urlencoded",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate required parameters
    const { grant_type, client_id, client_secret } = params;

    if (!grant_type || !client_id || !client_secret) {
      return new Response(
        JSON.stringify({
          error: "invalid_request",
          error_description: "Missing required parameters: grant_type, client_id, client_secret",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Authenticate Client ───────────────────────────────────────

    const { data: client, error: clientError } = await supabase
      .from("oauth_clients")
      .select("*")
      .eq("client_id", client_id)
      .eq("enabled", true)
      .single();

    if (clientError || !client) {
      return new Response(
        JSON.stringify({
          error: "invalid_client",
          error_description: "Invalid or disabled client",
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify client_secret using pgcrypto crypt
    const { data: secretCheck } = await supabase.rpc("verify_client_secret", {
      p_client_id: client_id,
      p_secret: client_secret,
    });

    if (!secretCheck) {
      return new Response(
        JSON.stringify({
          error: "invalid_client",
          error_description: "Invalid client credentials",
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate grant_type is allowed
    if (!client.grant_types.includes(grant_type)) {
      return new Response(
        JSON.stringify({
          error: "unsupported_grant_type",
          error_description: `Grant type '${grant_type}' is not allowed for this client`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Handle Grant Type ─────────────────────────────────────────

    if (grant_type === "authorization_code") {
      return await handleAuthorizationCodeGrant(supabase, client, params);
    } else if (grant_type === "refresh_token") {
      return await handleRefreshTokenGrant(supabase, client, params);
    } else {
      return new Response(
        JSON.stringify({
          error: "unsupported_grant_type",
          error_description: `Grant type '${grant_type}' is not supported`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: unknown) {
    console.error("OAuth token error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({
        error: "server_error",
        error_description: message,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Handle authorization_code grant
 */
async function handleAuthorizationCodeGrant(
  supabase: any,
  client: any,
  params: Record<string, string>
) {
  const { code, redirect_uri, code_verifier } = params;

  if (!code || !redirect_uri) {
    return new Response(
      JSON.stringify({
        error: "invalid_request",
        error_description: "Missing required parameters: code, redirect_uri",
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Fetch authorization code
  const { data: authCode, error: codeError } = await supabase
    .from("oauth_authorization_codes")
    .select("*")
    .eq("code", code)
    .eq("client_id", client.client_id)
    .eq("used", false)
    .single();

  if (codeError || !authCode) {
    return new Response(
      JSON.stringify({
        error: "invalid_grant",
        error_description: "Invalid or expired authorization code",
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Check if code is expired
  if (new Date(authCode.expires_at) < new Date()) {
    return new Response(
      JSON.stringify({
        error: "invalid_grant",
        error_description: "Authorization code has expired",
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Validate redirect_uri matches
  if (authCode.redirect_uri !== redirect_uri) {
    return new Response(
      JSON.stringify({
        error: "invalid_grant",
        error_description: "redirect_uri does not match",
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Validate PKCE if code_challenge was used
  if (authCode.code_challenge) {
    if (!code_verifier) {
      return new Response(
        JSON.stringify({
          error: "invalid_request",
          error_description: "code_verifier is required for PKCE flow",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify code_challenge
    const verified = await verifyPKCE(
      code_verifier,
      authCode.code_challenge,
      authCode.code_challenge_method
    );

    if (!verified) {
      return new Response(
        JSON.stringify({
          error: "invalid_grant",
          error_description: "Invalid code_verifier",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  // Mark code as used
  await supabase
    .from("oauth_authorization_codes")
    .update({ used: true })
    .eq("code", code);

  // Generate access token and refresh token
  const accessToken = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
  const refreshToken = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");

  // Store tokens
  const { error: tokenError } = await supabase
    .from("oauth_access_tokens")
    .insert({
      access_token: accessToken,
      refresh_token: refreshToken,
      client_id: client.client_id,
      user_id: authCode.user_id,
      scope: authCode.scope,
      expires_at: new Date(Date.now() + 3600 * 1000).toISOString(), // 1 hour
      refresh_expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(), // 30 days
    });

  if (tokenError) {
    throw new Error(`Failed to create access token: ${tokenError.message}`);
  }

  // Return token response
  return new Response(
    JSON.stringify({
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: 3600,
      refresh_token: refreshToken,
      scope: authCode.scope.join(" "),
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

/**
 * Handle refresh_token grant
 */
async function handleRefreshTokenGrant(
  supabase: any,
  client: any,
  params: Record<string, string>
) {
  const { refresh_token } = params;

  if (!refresh_token) {
    return new Response(
      JSON.stringify({
        error: "invalid_request",
        error_description: "Missing required parameter: refresh_token",
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Fetch existing token
  const { data: existingToken, error: tokenError } = await supabase
    .from("oauth_access_tokens")
    .select("*")
    .eq("refresh_token", refresh_token)
    .eq("client_id", client.client_id)
    .eq("revoked", false)
    .single();

  if (tokenError || !existingToken) {
    return new Response(
      JSON.stringify({
        error: "invalid_grant",
        error_description: "Invalid refresh token",
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Check if refresh token is expired
  if (new Date(existingToken.refresh_expires_at) < new Date()) {
    return new Response(
      JSON.stringify({
        error: "invalid_grant",
        error_description: "Refresh token has expired",
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Revoke old token
  await supabase
    .from("oauth_access_tokens")
    .update({ revoked: true })
    .eq("refresh_token", refresh_token);

  // Generate new tokens
  const newAccessToken = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
  const newRefreshToken = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");

  // Store new tokens
  const { error: newTokenError } = await supabase
    .from("oauth_access_tokens")
    .insert({
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      client_id: client.client_id,
      user_id: existingToken.user_id,
      scope: existingToken.scope,
      expires_at: new Date(Date.now() + 3600 * 1000).toISOString(), // 1 hour
      refresh_expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(), // 30 days
    });

  if (newTokenError) {
    throw new Error(`Failed to create new access token: ${newTokenError.message}`);
  }

  // Return new token response
  return new Response(
    JSON.stringify({
      access_token: newAccessToken,
      token_type: "Bearer",
      expires_in: 3600,
      refresh_token: newRefreshToken,
      scope: existingToken.scope.join(" "),
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

/**
 * Verify PKCE code_challenge
 */
async function verifyPKCE(
  codeVerifier: string,
  codeChallenge: string,
  method: string
): Promise<boolean> {
  if (method === "plain") {
    return codeVerifier === codeChallenge;
  } else if (method === "S256") {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const base64 = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
    return base64 === codeChallenge;
  }
  return false;
}
