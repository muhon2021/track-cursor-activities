import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateAuth } from "../_shared/auth-middleware.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const serviceClient = createClient(supabaseUrl, serviceKey);

    const auth = await validateAuth(req, userClient);
    const { token } = await req.json();

    if (!token) {
      return new Response(JSON.stringify({ error: "token is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: invite, error: inviteError } = await serviceClient
      .from("user_invites")
      .select("*")
      .eq("token", token)
      .single();

    if (inviteError || !invite) {
      return new Response(JSON.stringify({ error: "Invalid invitation" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (auth.user.email?.toLowerCase() !== invite.email.toLowerCase()) {
      return new Response(JSON.stringify({ error: "Email does not match invitation" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (invite.role_id) {
      await serviceClient.from("user_roles").upsert(
        {
          user_id: auth.user.id,
          role_id: invite.role_id,
          role: "user",
        },
        { onConflict: "user_id,role" }
      );
      await serviceClient.rpc("sync_user_app_role", { _user_id: auth.user.id });
    }

    if (invite.department_id) {
      await serviceClient.from("department_users").upsert(
        {
          department_id: invite.department_id,
          user_id: auth.user.id,
        },
        { onConflict: "department_id,user_id" }
      );
    }

    if (invite.pod_id) {
      await serviceClient.from("pod_members").upsert(
        {
          pod_id: invite.pod_id,
          user_id: auth.user.id,
        },
        { onConflict: "pod_id,user_id" }
      );
    }

    await serviceClient
      .from("user_invites")
      .update({
        used_at: new Date().toISOString(),
        status: "accepted",
      })
      .eq("id", invite.id);

    await serviceClient.from("onboarding_progress").upsert(
      {
        user_id: auth.user.id,
        current_step: 1,
        steps_completed: {},
      },
      { onConflict: "user_id" }
    );

    await serviceClient.from("activity_logs").insert({
      user_id: auth.user.id,
      action: "invite.accepted",
      resource_type: "user_invite",
      resource_id: invite.id,
      details: { email: invite.email },
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("accept-user-invite error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: error instanceof Error && message.includes("Unauthorized") ? 401 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
