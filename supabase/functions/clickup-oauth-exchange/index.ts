// clickup-oauth-exchange — Exchange ClickUp OAuth authorization code for access token
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse body
    let body: { code: string; redirect_uri?: string };
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { code, redirect_uri } = body;
    if (!code) {
      return new Response(
        JSON.stringify({ error: "Authorization code is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get ClickUp org integration for client_id / client_secret
    const { data: orgIntegration, error: orgError } = await supabase
      .from("organization_integrations")
      .select("*, integration_providers!inner(*)")
      .eq("integration_providers.slug", "clickup")
      .maybeSingle();

    if (orgError || !orgIntegration) {
      return new Response(
        JSON.stringify({ error: "ClickUp integration not configured by admin" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const clientId = orgIntegration.config?.client_id;
    const clientSecret = orgIntegration.config?.client_secret;

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: "ClickUp client_id or client_secret missing in org config" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Exchange code for token
    const tokenResponse = await fetch("https://api.clickup.com/api/v2/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      console.error("ClickUp token exchange failed:", errText);
      return new Response(
        JSON.stringify({ error: "Token exchange failed", details: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tokens = await tokenResponse.json();

    // Fetch user info from ClickUp
    let userEmail: string | null = null;
    let userName: string | null = null;
    try {
      const userResp = await fetch("https://api.clickup.com/api/v2/user", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (userResp.ok) {
        const userJson = await userResp.json();
        userEmail = userJson.user?.email ?? null;
        userName = userJson.user?.username ?? null;
      }
    } catch (e) {
      console.warn("Failed to fetch ClickUp user info:", e);
    }

    // ClickUp OAuth returns { access_token } (no refresh_token, no expiry — tokens are long-lived)
    const { error: upsertError } = await supabase.from("user_oauth_tokens").upsert(
      {
        user_id: user.id,
        provider_slug: "clickup",
        access_token: tokens.access_token,
        refresh_token: null,
        token_type: "Bearer",
        expires_at: null,
        scopes: [],
        account_email: userEmail,
        account_name: userName,
        is_active: true,
        error_message: null,
        error_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider_slug" }
    );

    if (upsertError) {
      console.error("Failed to store ClickUp token:", upsertError);
      return new Response(
        JSON.stringify({ error: "Failed to store token" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "ClickUp connected successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("clickup-oauth-exchange error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
