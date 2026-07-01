import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { routeNotification } from "../_shared/notification-router-core.ts";
import { requirePermission } from "../_shared/permission-auth.ts";
import type { RouterPayload } from "../_shared/notification-channels/types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = (await req.json()) as RouterPayload;

    if (body.ping === true) {
      return new Response(JSON.stringify({ success: true, message: "ok" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (!body.title || !body.message) {
      return new Response(
        JSON.stringify({ error: "title and message are required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const hasUserIds = body.user_id || (body.user_ids && body.user_ids.length > 0);
    if (!hasUserIds) {
      return new Response(
        JSON.stringify({ error: "user_id or user_ids required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Auth: service role calls skip; user-initiated require notifications.create
    const authHeader = req.headers.get("Authorization");
    const isServiceRole = authHeader?.includes(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "___none___");

    if (!body.skip_auth && !isServiceRole) {
      const authResult = await requirePermission(req, supabase, corsHeaders, "notifications.create");
      if (authResult instanceof Response) return authResult;
    }

    const result = await routeNotification(supabase, body);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
