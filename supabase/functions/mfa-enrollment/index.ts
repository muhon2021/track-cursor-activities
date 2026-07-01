import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

function getCorsHeaders(origin: string | null): Record<string, string> {
  const isLovablePreview =
    origin?.endsWith(".lovableproject.com") || origin?.endsWith(".lovable.app");
  const isSJInnovationCom =
    origin?.endsWith(".sjinnovation.com") || origin === "https://sjinnovation.com";
  const isSJInnovationUs =
    origin?.endsWith(".sjinnovation.us") || origin === "https://sjinnovation.us";
  const isLocalhost =
    origin?.startsWith("http://localhost:") || origin?.startsWith("http://127.0.0.1:");
  const isAllowed =
    origin &&
    (isLovablePreview || isSJInnovationCom || isSJInnovationUs || isLocalhost);
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : "http://localhost:8080",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-api-key",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Max-Age": "3600",
    "Access-Control-Allow-Credentials": "true",
  };
}

interface AuthError {
  status: number;
  code: string;
  message: string;
}

async function validateAuth(req: Request, supabase: SupabaseClient) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw {
      status: 401,
      code: "missing_auth_header",
      message: "Authorization header is required",
    } as AuthError;
  }
  const token = authHeader.replace("Bearer ", "").trim();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    throw {
      status: 401,
      code: "invalid_token",
      message: error?.message || "Invalid or expired token",
    } as AuthError;
  }
  return { user: { id: user.id, email: user.email }, token };
}

function authErrorResponse(error: AuthError, corsHeaders: Record<string, string>) {
  return new Response(
    JSON.stringify({ error: error.code, message: error.message, status: "error" }),
    { status: error.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function requirePermission(
  req: Request,
  supabase: SupabaseClient,
  corsHeaders: Record<string, string>,
  permissionKey: string
): Promise<{ userId: string } | Response> {
  try {
    const auth = await validateAuth(req, supabase);
    const { data: allowed, error } = await supabase.rpc("has_permission", {
      _user_id: auth.user.id,
      _permission_key: permissionKey,
    });
    if (error) {
      return new Response(JSON.stringify({ error: "Permission check failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!allowed) {
      return new Response(JSON.stringify({ error: `Permission required: ${permissionKey}` }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return { userId: auth.user.id };
  } catch (err) {
    return authErrorResponse(err as AuthError, corsHeaders);
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("Origin"));

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

    const authResult = await requirePermission(req, userClient, corsHeaders, "org.manage_mfa_policy");
    if (authResult instanceof Response) return authResult;
    const { userId } = authResult;

    const body = await req.json().catch(() => ({}));
    const action = body.action ?? "list";

    if (action === "list") {
      const { data: profiles, error: profilesError } = await serviceClient
        .from("profiles")
        .select("id, email, full_name");
      if (profilesError) throw profilesError;

      const { data: statuses, error: statusError } = await serviceClient
        .from("mfa_enrollment_status")
        .select("*");
      if (statusError) throw statusError;

      const statusMap = new Map((statuses ?? []).map((s) => [s.user_id, s]));

      const enrollment = (profiles ?? []).map((p) => {
        const status = statusMap.get(p.id);
        return {
          user_id: p.id,
          email: p.email,
          full_name: p.full_name,
          enrolled: status?.enrolled ?? false,
          enrolled_at: status?.enrolled_at ?? null,
          grace_period_ends_at: status?.grace_period_ends_at ?? null,
          last_reminded_at: status?.last_reminded_at ?? null,
        };
      });

      return new Response(JSON.stringify({ enrollment }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "remind") {
      const { target_user_id } = body;

      let targetIds: string[];
      if (target_user_id) {
        targetIds = [target_user_id];
      } else {
        const { data: unenrolled } = await serviceClient
          .from("mfa_enrollment_status")
          .select("user_id")
          .eq("enrolled", false);
        targetIds = (unenrolled ?? []).map((u) => u.user_id);
      }

      if (targetIds.length) {
        await serviceClient
          .from("mfa_enrollment_status")
          .update({ last_reminded_at: new Date().toISOString() })
          .in("user_id", targetIds);
      }

      await serviceClient.from("activity_logs").insert({
        user_id: userId,
        action: "mfa.reminder_sent",
        resource_type: "mfa_enrollment_status",
        resource_id: target_user_id ?? null,
        details: { reminded_count: targetIds.length },
      });

      return new Response(JSON.stringify({ success: true, reminded_count: targetIds.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reset") {
      const { target_user_id } = body;
      if (!target_user_id) {
        return new Response(JSON.stringify({ error: "target_user_id is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: factors, error: factorsError } = await serviceClient.auth.admin.mfa.listFactors({
        userId: target_user_id,
      });
      if (factorsError) throw factorsError;

      for (const factor of factors?.factors ?? []) {
        await serviceClient.auth.admin.mfa.deleteFactor({
          userId: target_user_id,
          id: factor.id,
        });
      }

      await serviceClient
        .from("mfa_enrollment_status")
        .upsert(
          { user_id: target_user_id, enrolled: false, enrolled_at: null },
          { onConflict: "user_id" }
        );

      await serviceClient.from("activity_logs").insert({
        user_id: userId,
        action: "mfa.reset",
        resource_type: "user",
        resource_id: target_user_id,
        details: { factors_removed: factors?.factors?.length ?? 0 },
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("mfa-enrollment error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
