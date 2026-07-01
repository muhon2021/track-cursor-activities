import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

// --- Self-contained helpers (dashboard deploy bundles only this file) ---

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

function validatePasswordPolicy(password: string) {
  const errors: string[] = [];
  const warnings: string[] = [];
  let score = 0;
  if (!password || password.length < 8) errors.push("Password must be at least 8 characters");
  else score += 20;
  if (/[a-z]/.test(password)) score += 15;
  else errors.push("Password must include a lowercase letter");
  if (/[A-Z]/.test(password)) score += 15;
  else errors.push("Password must include an uppercase letter");
  if (/[0-9]/.test(password)) score += 15;
  else errors.push("Password must include a number");
  if (/[^A-Za-z0-9]/.test(password)) score += 15;
  else warnings.push("Add a special character for stronger security");
  if (password.length >= 16) score += 10;
  if (password.length >= 20) score += 10;
  const lower = password.toLowerCase();
  if (["password", "123456", "qwerty", "letmein", "welcome"].some((p) => lower.includes(p))) {
    errors.push("Password contains a commonly used phrase");
    score = Math.max(0, score - 30);
  }
  return { valid: errors.length === 0, score: Math.min(100, score), errors, warnings };
}

async function checkHibpPassword(password: string) {
  const hashBuffer = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(password));
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).toUpperCase().padStart(2, "0"))
    .join("");
  const prefix = hashHex.slice(0, 5);
  const suffix = hashHex.slice(5);
  const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
    headers: { "Add-Padding": "true" },
  });
  if (!response.ok) throw new Error(`HIBP API error: ${response.status}`);
  for (const line of (await response.text()).split("\n")) {
    const [hashSuffix, countStr] = line.trim().split(":");
    if (hashSuffix === suffix) return { compromised: true, count: parseInt(countStr, 10) || 0 };
  }
  return { compromised: false, count: 0 };
}

// --- Handler ---

const DEFAULT_ORG = "00000000-0000-0000-0000-000000000001";
const HISTORY_LIMIT = 4;

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

    let auth;
    try {
      auth = await validateAuth(req, userClient);
    } catch (err) {
      return authErrorResponse(err as AuthError, corsHeaders);
    }

    const body = await req.json().catch(() => ({}));
    const newPassword = String(body.new_password ?? body.password ?? "");
    const currentPassword = String(body.current_password ?? "");

    if (!newPassword) {
      return new Response(JSON.stringify({ error: "new_password is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!currentPassword) {
      return new Response(JSON.stringify({ error: "current_password is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: signInError } = await userClient.auth.signInWithPassword({
      email: auth.user.email ?? "",
      password: currentPassword,
    });

    if (signInError) {
      return new Response(JSON.stringify({ error: "Current password is incorrect" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const policy = validatePasswordPolicy(newPassword);
    const { data: config } = await serviceClient
      .from("security_configurations")
      .select("hibp_check_enabled, password_rotation_days")
      .eq("org_id", DEFAULT_ORG)
      .maybeSingle();

    if (config?.hibp_check_enabled !== false) {
      try {
        const hibp = await checkHibpPassword(newPassword);
        if (hibp.compromised) {
          policy.errors.push("Password has been exposed in a known data breach");
          policy.valid = false;
        }
      } catch (hibpError) {
        console.warn("HIBP check failed during change-password:", hibpError);
      }
    }

    if (!policy.valid) {
      return new Response(
        JSON.stringify({ error: "Password does not meet policy", errors: policy.errors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: history } = await serviceClient
      .from("password_history")
      .select("password_hash")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT);

    for (const entry of history ?? []) {
      if (await bcrypt.compare(newPassword, entry.password_hash)) {
        return new Response(
          JSON.stringify({ error: "Cannot reuse any of your last 4 passwords" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const { error: updateError } = await serviceClient.auth.admin.updateUserById(auth.user.id, {
      password: newPassword,
    });
    if (updateError) throw updateError;

    await serviceClient.from("password_history").insert({
      user_id: auth.user.id,
      password_hash: await bcrypt.hash(newPassword),
    });

    const rotationDays = config?.password_rotation_days ?? 90;
    const expiresAt = new Date(Date.now() + rotationDays * 24 * 60 * 60 * 1000).toISOString();

    await serviceClient
      .from("profiles")
      .update({
        password_expires_at: expiresAt,
        requires_password_change: false,
        failed_login_count: 0,
        locked_until: null,
      })
      .eq("id", auth.user.id);

    await serviceClient.from("activity_logs").insert({
      user_id: auth.user.id,
      action: "security.password_changed",
      resource_type: "profile",
      resource_id: auth.user.id,
      details: { rotation_days: rotationDays },
      ip_address: req.headers.get("x-forwarded-for") ?? "unknown",
      user_agent: req.headers.get("user-agent") ?? "unknown",
    });

    return new Response(
      JSON.stringify({ success: true, password_expires_at: expiresAt }),
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
