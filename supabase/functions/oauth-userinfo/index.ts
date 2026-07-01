/**
 * OAuth UserInfo Endpoint
 *
 * Returns user profile information for a valid access token.
 * Implements OpenID Connect UserInfo endpoint.
 *
 * Endpoint: GET /functions/v1/oauth-userinfo
 *
 * Headers:
 * - Authorization: Bearer {access_token}
 *
 * Returns user information based on granted scopes:
 * - openid: sub (user ID)
 * - profile: name, avatar_url, updated_at
 * - email: email, email_verified
 * - roles: role (admin/moderator/user)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

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

    // Extract access token from Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({
          error: "invalid_request",
          error_description: "Missing or invalid Authorization header",
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json", "WWW-Authenticate": "Bearer" } }
      );
    }

    const accessToken = authHeader.replace("Bearer ", "");

    // Validate access token
    const { data: tokenData, error: tokenError } = await supabase
      .from("oauth_access_tokens")
      .select("*")
      .eq("access_token", accessToken)
      .eq("revoked", false)
      .single();

    if (tokenError || !tokenData) {
      return new Response(
        JSON.stringify({
          error: "invalid_token",
          error_description: "Access token is invalid or revoked",
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json", "WWW-Authenticate": "Bearer" } }
      );
    }

    // Check if token is expired
    if (new Date(tokenData.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({
          error: "invalid_token",
          error_description: "Access token has expired",
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json", "WWW-Authenticate": "Bearer" } }
      );
    }

    // Update last_used_at
    await supabase
      .from("oauth_access_tokens")
      .update({ last_used_at: new Date().toISOString() })
      .eq("access_token", accessToken);

    // Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", tokenData.user_id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({
          error: "server_error",
          error_description: "Failed to fetch user profile",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch user role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", tokenData.user_id)
      .single();

    const role = roleData?.role || "user";

    // Build response based on granted scopes
    const scopes = tokenData.scope || [];
    const userInfo: Record<string, any> = {};

    // Always include 'sub' (subject) if 'openid' scope
    if (scopes.includes("openid")) {
      userInfo.sub = profile.id;
    }

    // Include profile information if 'profile' scope
    if (scopes.includes("profile")) {
      userInfo.name = profile.full_name;
      userInfo.given_name = profile.full_name?.split(" ")[0];
      userInfo.family_name = profile.full_name?.split(" ").slice(1).join(" ");
      userInfo.picture = profile.avatar_url;
      userInfo.updated_at = profile.updated_at ? Math.floor(new Date(profile.updated_at).getTime() / 1000) : null;
    }

    // Include email if 'email' scope
    if (scopes.includes("email")) {
      userInfo.email = profile.email;
      userInfo.email_verified = true; // Assuming verified since they can log in
    }

    // Include role if 'roles' scope
    if (scopes.includes("roles")) {
      userInfo.role = role;
      userInfo.roles = [role]; // Array for future multi-role support
    }

    // Return userinfo response
    return new Response(
      JSON.stringify(userInfo),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("OAuth userinfo error:", error);
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
