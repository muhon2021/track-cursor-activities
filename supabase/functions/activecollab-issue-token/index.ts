/**
 * Exchange ActiveCollab username/password for an API token (POST /api/v1/issue-token)
 * and store the token in user_oauth_tokens for sync.
 * @see https://developers.activecollab.com/api-documentation/v1/authentication.html
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface IssueTokenResponse {
  is_ok?: boolean;
  token?: string;
  type?: string;
  message?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jwt = authHeader.replace("Bearer ", "");
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser(jwt);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json().catch(() => ({}))) as {
      username?: string;
      password?: string;
      base_url?: string;
      client_name?: string;
      client_vendor?: string;
    };
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const baseUrlRaw = typeof body.base_url === "string" ? body.base_url.trim() : "";
    const clientName = typeof body.client_name === "string" ? body.client_name.trim() : "";
    const clientVendor = typeof body.client_vendor === "string" ? body.client_vendor.trim() : "";

    if (!username || !password) {
      return new Response(JSON.stringify({ error: "username and password are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!baseUrlRaw) {
      return new Response(JSON.stringify({ error: "base_url is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!clientName) {
      return new Response(JSON.stringify({ error: "client_name is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!clientVendor) {
      return new Response(JSON.stringify({ error: "client_vendor is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: providerRow, error: providerError } = await supabase
      .from("integration_providers")
      .select("id, is_available")
      .eq("slug", "activecollab")
      .single();

    if (providerError || !providerRow?.id) {
      return new Response(JSON.stringify({ error: "ActiveCollab provider not configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (providerRow.is_available === false) {
      return new Response(JSON.stringify({ error: "ActiveCollab integration is not available" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiBase = baseUrlRaw.replace(/\/+$/, "");
    const issueUrl = `${apiBase}/api/v1/issue-token`;

    const issueResp = await fetch(issueUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        password,
        client_name: clientName,
        client_vendor: clientVendor,
      }),
    });

    const issueText = await issueResp.text();
    let issueJson: IssueTokenResponse;
    try {
      issueJson = JSON.parse(issueText) as IssueTokenResponse;
    } catch {
      return new Response(
        JSON.stringify({
          error: `ActiveCollab issue-token returned non-JSON (${issueResp.status}): ${issueText.slice(0, 200)}`,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const apiToken = typeof issueJson.token === "string" ? issueJson.token : "";
    if (!issueResp.ok || !apiToken) {
      const msg =
        typeof issueJson.message === "string"
          ? issueJson.message
          : `ActiveCollab issue-token failed (${issueResp.status})`;
      return new Response(JSON.stringify({ error: msg }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let accountEmail: string | undefined = username;
    let accountName: string | undefined;

    const meResp = await fetch(`${apiBase}/api/v1/users/me`, {
      headers: {
        "X-Angie-AuthApiToken": apiToken,
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
    });
    if (meResp.ok) {
      const me = (await meResp.json()) as Record<string, unknown>;
      const single = me.single as Record<string, unknown> | undefined;
      const u = single ?? me;
      if (typeof u.email === "string") accountEmail = u.email;
      if (typeof u.display_name === "string") accountName = u.display_name;
      else if (typeof u.first_name === "string") {
        accountName = [u.first_name, u.last_name].filter(Boolean).join(" ").trim() || undefined;
      }
    }

    const { error: upsertError } = await supabase.from("user_oauth_tokens").upsert(
      {
        user_id: user.id,
        provider_slug: "activecollab",
        access_token: apiToken,
        refresh_token: null,
        expires_at: null,
        scopes: [],
        token_type: "Bearer",
        account_email: accountEmail ?? null,
        account_name: accountName ?? null,
        account_avatar_url: null,
        is_active: true,
        error_message: null,
        updated_at: new Date().toISOString(),
        metadata: {
          activecollab_base_url: apiBase,
          client_name: clientName,
          client_vendor: clientVendor,
        },
      },
      { onConflict: "user_id,provider_slug" },
    );

    if (upsertError) {
      console.error("activecollab-issue-token upsert:", upsertError);
      return new Response(JSON.stringify({ error: "Failed to save connection" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("activecollab-issue-token:", error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
