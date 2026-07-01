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

const DEFAULT_ORG = "00000000-0000-0000-0000-000000000001";
const DAY_MS = 24 * 60 * 60 * 1000;

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
    const days = Math.min(Math.max(Number(body.days ?? 30), 1), 90);

    if (body.action !== "record_login_attempt") {
      const authResult = await requirePermission(req, userClient, corsHeaders, "settings.admin");
      if (authResult instanceof Response) return authResult;
    }

    if (body.action === "record_login_attempt") {
      const email = String(body.email ?? "").trim().toLowerCase();
      if (!email) {
        return new Response(JSON.stringify({ error: "email is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: attemptId, error: rpcError } = await serviceClient.rpc("record_login_attempt", {
        p_email: email,
        p_ip_address: req.headers.get("x-forwarded-for") ?? null,
        p_was_successful: body.was_successful === true,
      });

      if (rpcError) throw rpcError;

      return new Response(JSON.stringify({ success: true, attempt_id: attemptId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const since = new Date(Date.now() - days * DAY_MS).toISOString();

    const [
      { data: loginAttempts, error: loginError },
      { data: lockedProfiles, error: lockedError },
      { data: anomalies, error: anomalyError },
      { data: passwordViolations, error: pwError },
      { count: blockedSignupCount },
    ] = await Promise.all([
      serviceClient
        .from("login_attempts")
        .select("id, email, ip_address, attempted_at, was_successful")
        .gte("attempted_at", since)
        .order("attempted_at", { ascending: false })
        .limit(500),
      serviceClient
        .from("profiles")
        .select("id, email, full_name, failed_login_count, locked_until")
        .not("locked_until", "is", null)
        .gt("locked_until", new Date().toISOString()),
      serviceClient
        .from("security_anomalies")
        .select("*")
        .eq("org_id", DEFAULT_ORG)
        .gte("detected_at", since)
        .order("detected_at", { ascending: false })
        .limit(200),
      serviceClient
        .from("activity_logs")
        .select("id, user_id, action, details, created_at")
        .eq("action", "security.password_policy_violation")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(200),
      serviceClient
        .from("login_attempts")
        .select("id", { count: "exact", head: true })
        .eq("was_successful", false)
        .gte("attempted_at", since),
    ]);

    if (loginError) throw loginError;
    if (lockedError) throw lockedError;
    if (anomalyError) throw anomalyError;
    if (pwError) throw pwError;

    const failedAttempts = (loginAttempts ?? []).filter((a) => !a.was_successful);
    const successfulAttempts = (loginAttempts ?? []).filter((a) => a.was_successful);

    return new Response(
      JSON.stringify({
        generated_at: new Date().toISOString(),
        period_days: days,
        metrics: {
          total_lockouts: lockedProfiles?.length ?? 0,
          blocked_signups: blockedSignupCount ?? failedAttempts.length,
          password_violations: passwordViolations?.length ?? 0,
          failed_login_attempts: failedAttempts.length,
          successful_logins: successfulAttempts.length,
          unique_failed_emails: new Set(failedAttempts.map((a) => a.email)).size,
          audit_anomalies: anomalies?.length ?? 0,
        },
        locked_accounts: lockedProfiles ?? [],
        recent_failed_attempts: failedAttempts.slice(0, 50),
        password_violations: passwordViolations ?? [],
        security_anomalies: anomalies ?? [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
