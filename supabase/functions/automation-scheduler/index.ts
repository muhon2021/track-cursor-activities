import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const now = new Date().toISOString();
    let resumed = 0;
    let scheduled = 0;

    // Resume paused executions past paused_until
    const { data: pausedExecs } = await supabase
      .from("automation_executions")
      .select("id")
      .eq("status", "paused")
      .lte("paused_until", now);

    for (const exec of pausedExecs ?? []) {
      await supabase.from("automation_executions")
        .update({ status: "pending", paused_until: null })
        .eq("id", exec.id);

      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/automation-executor`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ execution_id: exec.id }),
      });
      resumed++;
    }

    // Process due schedules
    const { data: schedules } = await supabase
      .from("automation_schedules")
      .select("*, automation_workflows(*)")
      .eq("enabled", true)
      .lte("next_run_at", now);

    for (const sched of schedules ?? []) {
      const wf = sched.automation_workflows;
      if (!wf?.enabled) continue;

      await supabase.from("automation_executions").insert({
        workflow_id: wf.id,
        tenant_id: wf.tenant_id,
        status: "pending",
        trigger_payload: { event_key: "schedule", schedule_id: sched.id },
        idempotency_key: `schedule:${sched.id}:${now.slice(0, 16)}`,
      });

      await supabase.from("automation_schedules").update({
        last_run_at: now,
        next_run_at: computeNextRun(sched.cron_expression, sched.timezone),
      }).eq("id", sched.id);

      scheduled++;
    }

    // Process event outbox via trigger evaluator
    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/automation-trigger-evaluator`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({}),
    });

    // Process pending executions
    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/automation-executor`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({}),
    });

    return new Response(JSON.stringify({ resumed, scheduled }), {
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

function computeNextRun(cron: string, _timezone: string): string {
  // Simple presets; full cron parsing can be extended
  const now = new Date();
  if (cron === "0 8 * * *") {
    now.setDate(now.getDate() + 1);
    now.setHours(8, 0, 0, 0);
  } else if (cron === "0 9 * * 1") {
    const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
    now.setDate(now.getDate() + daysUntilMonday);
    now.setHours(9, 0, 0, 0);
  } else if (cron.startsWith("*/")) {
    const mins = parseInt(cron.split(" ")[0].replace("*/", ""), 10) || 5;
    now.setMinutes(now.getMinutes() + mins);
  } else {
    now.setHours(now.getHours() + 1);
  }
  return now.toISOString();
}
