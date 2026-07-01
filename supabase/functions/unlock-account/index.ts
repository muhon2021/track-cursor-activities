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

    const authResult = await requirePermission(req, userClient, corsHeaders, "users.admin");
    if (authResult instanceof Response) return authResult;
    const { userId: adminId } = authResult;

    const body = await req.json().catch(() => ({}));
    const targetUserId = body.user_id as string | undefined;
    const targetEmail = body.email as string | undefined;

    if (!targetUserId && !targetEmail) {
      return new Response(JSON.stringify({ error: "user_id or email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let profileQuery = serviceClient
      .from("profiles")
      .select("id, email, failed_login_count, locked_until");

    if (targetUserId) {
      profileQuery = profileQuery.eq("id", targetUserId);
    } else {
      profileQuery = profileQuery.ilike("email", targetEmail!);
    }

    const { data: profile, error: profileError } = await profileQuery.maybeSingle();
    if (profileError) throw profileError;

    if (!profile) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const previousState = {
      failed_login_count: profile.failed_login_count,
      locked_until: profile.locked_until,
    };

    const { data: updated, error: updateError } = await serviceClient
      .from("profiles")
      .update({ failed_login_count: 0, locked_until: null })
      .eq("id", profile.id)
      .select("id, email, failed_login_count, locked_until")
      .single();

    if (updateError) throw updateError;

    await serviceClient.from("activity_logs").insert({
      user_id: adminId,
      action: "security.account_unlocked",
      resource_type: "profile",
      resource_id: profile.id,
      details: { target_email: profile.email, previous_state: previousState },
      ip_address: req.headers.get("x-forwarded-for") ?? "unknown",
      user_agent: req.headers.get("user-agent") ?? "unknown",
    });

    try {
      await fetch(`${supabaseUrl}/functions/v1/audit-log-writer`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: adminId,
          action: "security.account_unlocked",
          resource_type: "profile",
          resource_id: profile.id,
          details: { target_user_id: profile.id, previous_state: previousState },
          write_activity_log: false,
        }),
      });
    } catch (auditError) {
      console.warn("Failed to write chained audit log:", auditError);
    }

    return new Response(JSON.stringify({ success: true, profile: updated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
