import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { matchesTriggerFilters } from "../_shared/automation-conditions.ts";
import { TRIGGER_EVENT_MAP } from "../_shared/automation-types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 100;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const manualEventKey = body.event_key as string | undefined;
    const manualPayload = body.payload as Record<string, unknown> | undefined;

    let processed = 0;
    let triggered = 0;

    if (manualEventKey && manualPayload) {
      await processEvent(supabase, manualEventKey, manualPayload, body.tenant_id);
      processed = 1;
      triggered = 1;
    } else {
      const { data: events, error } = await supabase
        .from("automation_event_outbox")
        .select("*")
        .is("processed_at", null)
        .order("created_at")
        .limit(BATCH_SIZE);

      if (error) throw error;

      for (const event of events ?? []) {
        try {
          const count = await processEvent(
            supabase,
            event.event_key,
            event.payload as Record<string, unknown>,
            event.tenant_id
          );
          triggered += count;
          await supabase
            .from("automation_event_outbox")
            .update({ processed_at: new Date().toISOString() })
            .eq("id", event.id);
          processed++;
        } catch (e) {
          await supabase
            .from("automation_event_outbox")
            .update({ error: e instanceof Error ? e.message : "process failed" })
            .eq("id", event.id);
        }
      }
    }

    return new Response(JSON.stringify({ processed, triggered }), {
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

async function processEvent(
  supabase: ReturnType<typeof createClient>,
  eventKey: string,
  payload: Record<string, unknown>,
  tenantId: string
): Promise<number> {
  const { data: workflows, error } = await supabase
    .from("automation_workflows")
    .select("*")
    .eq("enabled", true)
    .eq("tenant_id", tenantId);

  if (error) throw error;

  let count = 0;
  for (const wf of workflows ?? []) {
    const mappedEvents = TRIGGER_EVENT_MAP[wf.trigger_type] ?? [wf.trigger_type];
    if (!mappedEvents.includes(eventKey)) continue;

    const triggerConfig = (wf.trigger_config ?? {}) as Record<string, unknown>;
    const filters = triggerConfig.filters as Record<string, unknown> | undefined;
    if (!matchesTriggerFilters(filters, payload)) continue;

    const idempotencyKey = `${wf.id}:${eventKey}:${payload.id ?? payload.entity_id ?? JSON.stringify(payload).slice(0, 64)}`;

    const { data: existing } = await supabase
      .from("automation_executions")
      .select("id")
      .eq("workflow_id", wf.id)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existing) continue;

    const { data: exec, error: execErr } = await supabase.from("automation_executions").insert({
      workflow_id: wf.id,
      tenant_id: tenantId,
      status: "pending",
      trigger_payload: { ...payload, event_key: eventKey },
      idempotency_key: idempotencyKey,
    }).select("id").single();

    if (execErr) {
      console.error("execution insert failed:", execErr.message);
      continue;
    }

    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/automation-executor`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ execution_id: exec.id }),
    });
    count++;
  }
  return count;
}
