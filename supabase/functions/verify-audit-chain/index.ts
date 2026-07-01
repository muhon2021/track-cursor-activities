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

interface AuditLogPayload {
  user_id?: string | null;
  action: string;
  resource_type?: string | null;
  resource_id?: string | null;
  details?: Record<string, unknown>;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at?: string;
  previous_row_hash?: string | null;
}

async function sha256Hex(input: string): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function canonicalizeAuditPayload(payload: AuditLogPayload): string {
  return JSON.stringify({
    user_id: payload.user_id ?? null,
    action: payload.action,
    resource_type: payload.resource_type ?? null,
    resource_id: payload.resource_id ?? null,
    details: payload.details ?? {},
    ip_address: payload.ip_address ?? null,
    user_agent: payload.user_agent ?? null,
    created_at: payload.created_at ?? null,
    previous_row_hash: payload.previous_row_hash ?? null,
  });
}

async function computeAuditRowHash(
  payload: AuditLogPayload,
  previousRowHash: string | null
): Promise<string> {
  return sha256Hex(
    canonicalizeAuditPayload({ ...payload, previous_row_hash: previousRowHash })
  );
}

const DEFAULT_ORG = "00000000-0000-0000-0000-000000000001";

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

    const authResult = await requirePermission(req, userClient, corsHeaders, "settings.admin");
    if (authResult instanceof Response) return authResult;

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Number(body.limit ?? 5000), 10000);
    const offset = Number(body.offset ?? 0);

    const { data: logs, error } = await serviceClient
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const mismatches: Array<{
      id: string;
      action: string;
      created_at: string;
      expected_hash: string;
      stored_hash: string;
      issue: string;
    }> = [];

    let previousHash: string | null = null;

    for (const log of logs ?? []) {
      const payload: AuditLogPayload = {
        user_id: log.user_id,
        action: log.action,
        resource_type: log.resource_type,
        resource_id: log.resource_id,
        details: log.details ?? {},
        ip_address: log.ip_address,
        user_agent: log.user_agent,
        created_at: log.created_at,
        previous_row_hash: previousHash,
      };

      const expectedHash = await computeAuditRowHash(payload, previousHash);

      if (log.previous_row_hash !== previousHash) {
        mismatches.push({
          id: log.id,
          action: log.action,
          created_at: log.created_at,
          expected_hash: expectedHash,
          stored_hash: log.row_hash,
          issue: "previous_row_hash chain break",
        });
      } else if (log.row_hash !== expectedHash) {
        mismatches.push({
          id: log.id,
          action: log.action,
          created_at: log.created_at,
          expected_hash: expectedHash,
          stored_hash: log.row_hash,
          issue: "row_hash tamper detected",
        });
      }

      previousHash = log.row_hash;
    }

    if (mismatches.length > 0) {
      for (const mismatch of mismatches) {
        await serviceClient.from("security_anomalies").insert({
          org_id: DEFAULT_ORG,
          anomaly_type: "audit_chain_integrity",
          severity: "critical",
          message: `Audit log tampering detected on entry ${mismatch.id}: ${mismatch.issue}`,
          metadata: mismatch,
        });
      }

      await serviceClient.from("audit_logs").insert({
        action: "security.audit_chain_verification_failed",
        details: { mismatch_count: mismatches.length, mismatches },
        ip_address: req.headers.get("x-forwarded-for") ?? "unknown",
        user_agent: req.headers.get("user-agent") ?? "unknown",
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        verified_count: logs?.length ?? 0,
        valid: mismatches.length === 0,
        mismatches,
        chain_tip_hash: previousHash,
        canonical_sample: logs?.length
          ? canonicalizeAuditPayload({
              user_id: logs[0].user_id,
              action: logs[0].action,
              resource_type: logs[0].resource_type,
              resource_id: logs[0].resource_id,
              details: logs[0].details,
              ip_address: logs[0].ip_address,
              user_agent: logs[0].user_agent,
              created_at: logs[0].created_at,
              previous_row_hash: logs[0].previous_row_hash,
            })
          : null,
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
