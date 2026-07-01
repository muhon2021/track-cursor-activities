/**
 * password-expiry-cron — daily password expiry warnings and flagging.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

const WARNING_DAYS = [14, 6, 1] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("Origin"));

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    if (body.ping === true) {
      return new Response(JSON.stringify({ success: true, message: "ok" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const now = Date.now();
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, email, full_name, password_expires_at, requires_password_change")
      .not("password_expires_at", "is", null);

    if (error) throw error;

    const results = { expired: 0, warnings_sent: 0, already_flagged: 0 };

    for (const profile of profiles ?? []) {
      if (!profile.password_expires_at) continue;

      const expiresMs = new Date(profile.password_expires_at).getTime();
      const daysRemaining = Math.ceil((expiresMs - now) / DAY_MS);

      if (daysRemaining <= 0) {
        if (!profile.requires_password_change) {
          await supabase
            .from("profiles")
            .update({ requires_password_change: true })
            .eq("id", profile.id);
          results.expired += 1;
        } else {
          results.already_flagged += 1;
        }
        await sendExpiryNotification(profile.id, 0);
        continue;
      }

      if (WARNING_DAYS.includes(daysRemaining as (typeof WARNING_DAYS)[number])) {
        await sendExpiryNotification(profile.id, daysRemaining);
        results.warnings_sent += 1;
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
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

async function sendExpiryNotification(userId: string, daysRemaining: number) {
  const title =
    daysRemaining === 0
      ? "Password expired"
      : `Password expires in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`;
  const message =
    daysRemaining === 0
      ? "Your password has expired. You must change it before continuing to use the application."
      : `Your password will expire in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}. Please update it soon.`;

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  try {
    await fetch(`${supabaseUrl}/functions/v1/send-notification`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: userId,
        title,
        message,
        type: daysRemaining === 0 ? "error" : "warning",
        channels: ["in_app"],
        metadata: { days_remaining: daysRemaining, source: "password-expiry-cron" },
        skip_auth: true,
      }),
    });
  } catch (notifyError) {
    console.error("Failed to send password expiry notification:", notifyError);
  }
}
