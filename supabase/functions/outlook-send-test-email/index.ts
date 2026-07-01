/**
 * Send a test email via Microsoft Graph using Integration Hub Outlook tokens (user_oauth_tokens).
 * Requires an active outlook connection from user-oauth-callback.
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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let recipient_email: string | undefined;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        recipient_email =
          typeof body?.recipient_email === "string" ? body.recipient_email.trim() : undefined;
      } catch {
        recipient_email = undefined;
      }
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: userToken, error: tokenError } = await supabase
      .from("user_oauth_tokens")
      .select("access_token, account_email")
      .eq("user_id", user.id)
      .eq("provider_slug", "outlook")
      .eq("is_active", true)
      .maybeSingle();

    if (tokenError || !userToken?.access_token) {
      return new Response(
        JSON.stringify({
          error: "No active Outlook connection. Save Entra credentials and complete Connect on the Outlook integration page.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const to =
      recipient_email && recipient_email.length > 0
        ? recipient_email
        : userToken.account_email || user.email;
    if (!to) {
      return new Response(
        JSON.stringify({
          error: "No recipient email. Pass recipient_email or ensure your Outlook profile has a mailbox address.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const graphBody = {
      message: {
        subject: "SJ Control Tower — Outlook test email",
        body: {
          contentType: "Text",
          content:
            "This is a test message from the SJ Control Tower Framework Integration Hub (outlook-send-test-email).",
        },
        toRecipients: [{ emailAddress: { address: to } }],
      },
    };

    const sendRes = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userToken.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(graphBody),
    });

    if (!sendRes.ok) {
      const errText = await sendRes.text();
      console.error("Graph sendMail failed:", errText);
      return new Response(
        JSON.stringify({
          error: "Microsoft Graph sendMail failed. Token may be expired — try user-oauth-refresh with provider outlook.",
          details: errText,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ success: true, to }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
