/**
 * User OAuth Disconnect Edge Function
 * Sprint 10: User Integration Connections
 * Revokes and removes user OAuth connection
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const getRevokeEndpoint = (provider: string): string | null => {
  const endpoints: Record<string, string> = {
    google: "https://oauth2.googleapis.com/revoke",
    // Zoom and Microsoft don't have simple revoke endpoints
  };
  return endpoints[provider] || null;
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

    // Parse and validate request body
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { provider } = requestBody;

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
      .maybeSingle();

    // If no token found, return success (nothing to disconnect)
    if (tokenError || !userToken) {
      return new Response(
        JSON.stringify({ success: true, message: "No connection to disconnect" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try to revoke the token at the provider
    const revokeEndpoint = getRevokeEndpoint(provider);
    if (revokeEndpoint && userToken.access_token) {
      try {
        // Google uses POST with token in body
        if (provider === "google") {
          await fetch(`${revokeEndpoint}?token=${userToken.access_token}`, {
            method: "POST",
          });
        }
        // For other providers, we just delete locally
      } catch (revokeError) {
        // Log but don't fail - we still want to remove locally
        console.error("Failed to revoke token at provider:", revokeError);
      }
    }

    // Delete the token record
    const { error: deleteError } = await supabase
      .from("user_oauth_tokens")
      .delete()
      .eq("id", userToken.id);

    if (deleteError) {
      console.error("Failed to delete token:", deleteError);
      return new Response(
        JSON.stringify({ error: "Failed to disconnect" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Disconnected from ${provider}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("User OAuth disconnect error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
