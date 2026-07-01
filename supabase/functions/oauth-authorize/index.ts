/**
 * OAuth Authorization Endpoint
 *
 * Handles OAuth 2.0 authorization requests from external clients.
 *
 * Flow:
 * 1. External client redirects user to this endpoint with client_id, redirect_uri, scope, state
 * 2. We validate the client and parameters
 * 3. If user not logged in, redirect to login page with return_to
 * 4. If logged in, show consent screen (or skip if trusted client)
 * 5. User approves → generate authorization code
 * 6. Redirect back to client with code
 *
 * Endpoint: GET /functions/v1/oauth-authorize
 *
 * Query params:
 * - client_id (required): OAuth client identifier
 * - redirect_uri (required): Where to send user after authorization
 * - response_type (required): Must be 'code'
 * - scope (optional): Space-separated scopes, defaults to 'openid profile email'
 * - state (required): Client-generated state for CSRF protection
 * - code_challenge (optional): PKCE code challenge
 * - code_challenge_method (optional): 'S256' or 'plain'
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { encode as base64urlEncode } from "https://deno.land/std@0.168.0/encoding/base64url.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AuthorizeParams {
  client_id: string;
  redirect_uri: string;
  response_type: string;
  scope?: string;
  state: string;
  code_challenge?: string;
  code_challenge_method?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const appUrl = Deno.env.get("APP_URL") || "https://controltowerdemo.collabai.software";

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse query parameters
    const url = new URL(req.url);
    const params: AuthorizeParams = {
      client_id: url.searchParams.get("client_id") || "",
      redirect_uri: url.searchParams.get("redirect_uri") || "",
      response_type: url.searchParams.get("response_type") || "",
      scope: url.searchParams.get("scope") || "openid profile email",
      state: url.searchParams.get("state") || "",
      code_challenge: url.searchParams.get("code_challenge") || undefined,
      code_challenge_method: url.searchParams.get("code_challenge_method") || undefined,
    };

    // ─── Validation ────────────────────────────────────────────────

    // 1. Validate required parameters
    if (!params.client_id || !params.redirect_uri || !params.response_type || !params.state) {
      return new Response(
        JSON.stringify({
          error: "invalid_request",
          error_description: "Missing required parameters: client_id, redirect_uri, response_type, state",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Validate response_type
    if (params.response_type !== "code") {
      return new Response(
        JSON.stringify({
          error: "unsupported_response_type",
          error_description: "Only 'code' response_type is supported",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Validate client_id and redirect_uri
    const { data: client, error: clientError } = await supabase
      .from("oauth_clients")
      .select("*")
      .eq("client_id", params.client_id)
      .eq("enabled", true)
      .single();

    if (clientError || !client) {
      return new Response(
        JSON.stringify({
          error: "invalid_client",
          error_description: "Invalid or disabled client_id",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Validate redirect_uri is in allowed list
    if (!client.redirect_uris.includes(params.redirect_uri)) {
      return new Response(
        JSON.stringify({
          error: "invalid_request",
          error_description: "redirect_uri is not registered for this client",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Validate scopes
    const requestedScopes = params.scope?.split(" ") || [];
    const invalidScopes = requestedScopes.filter((scope) => !client.allowed_scopes.includes(scope));
    if (invalidScopes.length > 0) {
      return new Response(
        JSON.stringify({
          error: "invalid_scope",
          error_description: `Requested scopes not allowed: ${invalidScopes.join(", ")}`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Validate PKCE if required
    if (client.require_pkce && !params.code_challenge) {
      return new Response(
        JSON.stringify({
          error: "invalid_request",
          error_description: "code_challenge is required for this client (PKCE)",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Check if user is authenticated ────────────────────────────

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      // User not logged in → redirect to login page with return_to
      const loginUrl = new URL(`${appUrl}/login`);
      loginUrl.searchParams.set("return_to", req.url);

      return new Response(null, {
        status: 302,
        headers: {
          Location: loginUrl.toString(),
        },
      });
    }

    // Validate user token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      // Invalid token → redirect to login
      const loginUrl = new URL(`${appUrl}/login`);
      loginUrl.searchParams.set("return_to", req.url);

      return new Response(null, {
        status: 302,
        headers: {
          Location: loginUrl.toString(),
        },
      });
    }

    // ─── Check user consent ────────────────────────────────────────

    // If client is trusted, skip consent
    if (client.trusted) {
      return await issueAuthorizationCode(supabase, user.id, client, params);
    }

    // Check if user has already consented
    if (!client.require_consent) {
      return await issueAuthorizationCode(supabase, user.id, client, params);
    }

    const { data: consent } = await supabase
      .from("oauth_user_consents")
      .select("*")
      .eq("user_id", user.id)
      .eq("client_id", params.client_id)
      .single();

    if (consent) {
      // User already consented → issue code directly
      return await issueAuthorizationCode(supabase, user.id, client, params);
    }

    // ─── Show consent screen ───────────────────────────────────────

    // Redirect to consent screen (frontend page)
    const consentUrl = new URL(`${appUrl}/oauth/consent`);
    consentUrl.searchParams.set("client_id", params.client_id);
    consentUrl.searchParams.set("client_name", client.client_name);
    consentUrl.searchParams.set("scope", params.scope || "openid profile email");
    consentUrl.searchParams.set("redirect_uri", params.redirect_uri);
    consentUrl.searchParams.set("state", params.state);
    if (params.code_challenge) consentUrl.searchParams.set("code_challenge", params.code_challenge);
    if (params.code_challenge_method) consentUrl.searchParams.set("code_challenge_method", params.code_challenge_method);

    return new Response(null, {
      status: 302,
      headers: {
        Location: consentUrl.toString(),
      },
    });
  } catch (error: unknown) {
    console.error("OAuth authorize error:", error);
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
 * Issue authorization code and redirect to client
 */
async function issueAuthorizationCode(
  supabase: any,
  userId: string,
  client: any,
  params: AuthorizeParams
) {
  // Generate authorization code
  const code = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");

  // Store authorization code
  const { error: codeError } = await supabase
    .from("oauth_authorization_codes")
    .insert({
      code,
      client_id: params.client_id,
      user_id: userId,
      redirect_uri: params.redirect_uri,
      scope: params.scope?.split(" ") || ["openid", "profile", "email"],
      code_challenge: params.code_challenge,
      code_challenge_method: params.code_challenge_method,
    });

  if (codeError) {
    throw new Error(`Failed to create authorization code: ${codeError.message}`);
  }

  // Update client metrics
  await supabase
    .from("oauth_clients")
    .update({
      total_authorizations: client.total_authorizations + 1,
      last_used_at: new Date().toISOString(),
    })
    .eq("client_id", params.client_id);

  // Redirect back to client with code and state
  const redirectUrl = new URL(params.redirect_uri);
  redirectUrl.searchParams.set("code", code);
  redirectUrl.searchParams.set("state", params.state);

  return new Response(null, {
    status: 302,
    headers: {
      Location: redirectUrl.toString(),
    },
  });
}
