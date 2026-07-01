import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// Self-contained helpers for Supabase dashboard deploy (single-file bundle).

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
      "authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
  if (!token) {
    throw { status: 401, code: "empty_token", message: "Bearer token cannot be empty" } as AuthError;
  }
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

const DEFAULT_TENANT = "00000000-0000-0000-0000-000000000001";

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

    const body = await req.json().catch(() => ({}));
    const action = body.action ?? "get_policy";

    if (action === "get_policy") {
      try {
        await validateAuth(req, userClient);
      } catch (err) {
        return authErrorResponse(err as AuthError, corsHeaders);
      }

      const { data, error } = await serviceClient
        .from("mfa_policies")
        .select("*")
        .eq("tenant_id", DEFAULT_TENANT)
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ policy: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_policy") {
      const authResult = await requirePermission(
        req,
        userClient,
        corsHeaders,
        "org.manage_mfa_policy"
      );
      if (authResult instanceof Response) return authResult;
      const { userId } = authResult;

      const { required, grace_period_days, allowed_factors, trust_idp_mfa } = body;

      if (typeof required !== "boolean") {
        return new Response(JSON.stringify({ error: "required (boolean) is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (
        grace_period_days !== undefined &&
        (typeof grace_period_days !== "number" || grace_period_days < 0 || grace_period_days > 90)
      ) {
        return new Response(JSON.stringify({ error: "grace_period_days must be between 0 and 90" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: previous } = await serviceClient
        .from("mfa_policies")
        .select("*")
        .eq("tenant_id", DEFAULT_TENANT)
        .single();

      const { data: updated, error: updateError } = await serviceClient
        .from("mfa_policies")
        .update({
          required,
          ...(grace_period_days !== undefined ? { grace_period_days } : {}),
          ...(Array.isArray(allowed_factors) ? { allowed_factors } : {}),
          ...(typeof trust_idp_mfa === "boolean" ? { trust_idp_mfa } : {}),
          updated_by: userId,
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", DEFAULT_TENANT)
        .select()
        .single();

      if (updateError) throw updateError;

      if (required && !previous?.required) {
        const graceDays = updated.grace_period_days ?? 7;
        const graceEndsAt = new Date(Date.now() + graceDays * 24 * 60 * 60 * 1000).toISOString();

        const { data: profiles } = await serviceClient.from("profiles").select("id");
        const { data: enrolled } = await serviceClient
          .from("mfa_enrollment_status")
          .select("user_id")
          .eq("enrolled", true);
        const enrolledIds = new Set((enrolled ?? []).map((e) => e.user_id));

        const rows = (profiles ?? [])
          .filter((p) => !enrolledIds.has(p.id))
          .map((p) => ({ user_id: p.id, grace_period_ends_at: graceEndsAt }));

        if (rows.length) {
          await serviceClient.from("mfa_enrollment_status").upsert(rows, { onConflict: "user_id" });
        }
      }

      await serviceClient.from("activity_logs").insert({
        user_id: userId,
        action:
          previous?.required === required
            ? "mfa_policy.updated"
            : required
            ? "mfa_policy.enabled"
            : "mfa_policy.disabled",
        resource_type: "mfa_policy",
        resource_id: updated.id,
        details: { previous, updated },
      });

      return new Response(JSON.stringify({ policy: updated }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("mfa-policy error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
