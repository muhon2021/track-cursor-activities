// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UpdateClickUpTaskBody {
  external_id: string;
  name?: string;
  status?: string;
  due_date?: string | null;
  time_estimate_ms?: number | null;
  time_spent_ms?: number | null;
  sprint_points?: number | null;
  tags?: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const jwt = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = (await req.json()) as UpdateClickUpTaskBody;
    if (!body.external_id) {
      return new Response(
        JSON.stringify({ error: "external_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Get ClickUp OAuth token for this user
    const { data: tokenRow, error: tokenError } = await supabase
      .from("user_oauth_tokens")
      .select("*")
      .eq("user_id", user.id)
      .eq("provider_slug", "clickup")
      .maybeSingle();

    if (tokenError || !tokenRow) {
      return new Response(
        JSON.stringify({ error: "No ClickUp connection found for this user" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const accessToken = tokenRow.access_token as string;

    const payload: Record<string, unknown> = {};
    if (body.name !== undefined) payload.name = body.name;
    if (body.status !== undefined) payload.status = body.status;
    if (body.due_date !== undefined) {
      payload.due_date = body.due_date ? new Date(body.due_date).getTime() : null;
    }
    if (body.time_estimate_ms !== undefined) payload.time_estimate = body.time_estimate_ms;
    if (body.time_spent_ms !== undefined) payload.time_spent = body.time_spent_ms;
    if (body.tags !== undefined) payload.tags = body.tags;
    if (body.sprint_points !== undefined) payload.points = body.sprint_points;

    const resp = await fetch(`https://api.clickup.com/api/v2/task/${body.external_id}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return new Response(
        JSON.stringify({ error: `ClickUp update failed: ${resp.status} - ${text.slice(0, 200)}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await resp.json();

    return new Response(JSON.stringify({ success: true, task: data }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("update-clickup-task error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

