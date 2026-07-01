import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { emitAutomationEvent } from "../_shared/automation-emit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-signature",
};

async function verifyHmac(secret: string, body: string, signature: string | null): Promise<boolean> {
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return signature === expected || signature === `sha256=${expected}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug");
    if (!slug) {
      return new Response(JSON.stringify({ error: "slug required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: webhook, error } = await supabase
      .from("automation_webhooks")
      .select("*, automation_workflows(*)")
      .eq("path_slug", slug)
      .eq("enabled", true)
      .single();

    if (error || !webhook) {
      return new Response(JSON.stringify({ error: "Webhook not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    const rawBody = await req.text();
    let payload: Record<string, unknown> = {};
    try {
      payload = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      payload = { raw: rawBody };
    }

    if (webhook.auth_type === "hmac") {
      const sig = req.headers.get("x-webhook-signature");
      const valid = await verifyHmac(webhook.secret, rawBody, sig);
      if (!valid) {
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        });
      }
    } else if (webhook.auth_type === "bearer") {
      const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
      if (auth !== webhook.secret) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        });
      }
    }

    const eventId = await emitAutomationEvent(
      supabase,
      "webhook",
      { ...payload, webhook_id: webhook.id, workflow_id: webhook.workflow_id },
      webhook.tenant_id
    );

    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/automation-trigger-evaluator`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        event_key: "webhook",
        payload: { ...payload, webhook_id: webhook.id },
        tenant_id: webhook.tenant_id,
      }),
    });

    return new Response(JSON.stringify({ success: true, event_id: eventId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
