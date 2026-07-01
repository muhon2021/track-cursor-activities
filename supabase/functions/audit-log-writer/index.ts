import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Self-contained CORS + crypto helpers so this function deploys from the
// Supabase dashboard editor (which only bundles files in this folder).

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
  const allowedOrigin = isAllowed ? origin : "http://localhost:8080";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Max-Age": "3600",
    "Access-Control-Allow-Credentials": "true",
  };
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
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
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
  const withPrevious = { ...payload, previous_row_hash: previousRowHash };
  return sha256Hex(canonicalizeAuditPayload(withPrevious));
}

serve(async (req) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json().catch(() => ({}));

    if (body.ping === true) {
      return new Response(JSON.stringify({ success: true, message: "ok" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      user_id,
      action,
      resource_type,
      resource_id,
      details,
      write_activity_log = true,
    } = body;

    if (!action) {
      return new Response(JSON.stringify({ error: "Action is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ip_address = req.headers.get("x-forwarded-for") ?? "unknown";
    const user_agent = req.headers.get("user-agent") ?? "unknown";
    const created_at = new Date().toISOString();

    const { data: lastLog } = await supabase
      .from("audit_logs")
      .select("row_hash")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const previousRowHash = lastLog?.row_hash ?? null;

    const payload: AuditLogPayload = {
      user_id: user_id || null,
      action,
      resource_type: resource_type || null,
      resource_id: resource_id || null,
      details: details || {},
      ip_address,
      user_agent,
      created_at,
      previous_row_hash: previousRowHash,
    };

    const rowHash = await computeAuditRowHash(payload, previousRowHash);

    const { data: inserted, error } = await supabase
      .from("audit_logs")
      .insert({
        user_id: user_id || null,
        action,
        resource_type: resource_type || null,
        resource_id: resource_id || null,
        details: details || {},
        ip_address,
        user_agent,
        row_hash: rowHash,
        previous_row_hash: previousRowHash,
        created_at,
      })
      .select()
      .single();

    if (error) throw error;

    if (write_activity_log && user_id) {
      await supabase.from("activity_logs").insert({
        user_id,
        action,
        resource_type: resource_type || null,
        resource_id: resource_id || null,
        details: { ...(details || {}), audit_chain_hash: rowHash },
        ip_address,
        user_agent,
      });
    }

    console.log(`Audit log chained: ${action} hash=${rowHash.slice(0, 12)}...`);

    return new Response(
      JSON.stringify({ success: true, log: inserted, row_hash: rowHash }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Audit log writer error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
