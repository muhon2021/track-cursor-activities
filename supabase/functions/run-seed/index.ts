import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ── Auth: verify caller is admin ──────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized — invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!roleRow || roleRow.role !== "admin") {
      return new Response(
        JSON.stringify({ success: false, error: "Forbidden — admin role required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Parse body ────────────────────────────────────────────────────────
    let body: { sql: string; fileName: string };
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!body.sql || typeof body.sql !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "Missing `sql` field in body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Execute the seed SQL via admin_exec_sql RPC ───────────────────────
    const startMs = Date.now();
    const { data, error: rpcError } = await supabase.rpc("admin_exec_sql", {
      sql_content: body.sql,
    });

    const durationMs = Date.now() - startMs;

    if (rpcError) {
      // Return 200 with success: false so the client can read the error body (avoids "non-2xx" generic error)
      return new Response(
        JSON.stringify({
          success: false,
          error: rpcError.message,
          code: rpcError.code,
          durationMs,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // admin_exec_sql returns { success, error?, message? }
    const result = data as { success: boolean; error?: string; state?: string; message?: string };

    // ── Audit log (non-fatal: do not fail the request if insert fails) ─────
    try {
      await supabase.from("activity_logs").insert({
        user_id: user.id,
        action: result.success ? "seed_run_success" : "seed_run_failed",
        resource_type: "seed",
        resource_id: body.fileName || "unknown",
        details: JSON.stringify({
          fileName: body.fileName,
          success: result.success,
          error: result.error || null,
          durationMs,
        }),
      });
    } catch {
      // ignore audit failure
    }

    // Always return 200 so the client can read success/error from the body (avoids generic "non-2xx" error)
    return new Response(
      JSON.stringify({ ...result, durationMs, fileName: body.fileName }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
