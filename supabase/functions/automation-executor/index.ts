import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { evaluateConditions } from "../_shared/automation-conditions.ts";
import {
  executeAction,
  getNextNodes,
  getStartNode,
} from "../_shared/automation-actions/index.ts";
import type { WorkflowDefinition, WorkflowNode } from "../_shared/automation-types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const body = await req.json().catch(() => ({}));
    const executionId = body.execution_id as string | undefined;

    const query = supabase
      .from("automation_executions")
      .select("*, automation_workflows(*)")
      .in("status", ["pending", "running", "paused"])
      .order("created_at")
      .limit(executionId ? 1 : 10);

    const { data: executions, error } = executionId
      ? await query.eq("id", executionId)
      : await query;

    if (error) throw error;

    const results = [];
    for (const exec of executions ?? []) {
      if (exec.paused_until && new Date(exec.paused_until) > new Date()) continue;

      const result = await runExecution(
        supabase,
        exec,
        exec.automation_workflows,
        supabaseUrl,
        serviceRoleKey
      );
      results.push(result);
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
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

async function runExecution(
  supabase: ReturnType<typeof createClient>,
  exec: Record<string, unknown>,
  workflow: Record<string, unknown>,
  supabaseUrl: string,
  serviceRoleKey: string
) {
  const executionId = exec.id as string;
  const definition = workflow.definition as WorkflowDefinition;
  const payload = exec.trigger_payload as Record<string, unknown>;
  const tenantId = exec.tenant_id as string;

  await supabase.from("automation_executions").update({
    status: "running",
    started_at: exec.started_at ?? new Date().toISOString(),
  }).eq("id", executionId);

  const ctx = {
    supabase,
    executionId,
    tenantId,
    payload,
    supabaseUrl,
    serviceRoleKey,
  };

  let currentNode: WorkflowNode | undefined;
  if (exec.current_step_key) {
    currentNode = definition.nodes.find((n) => n.id === exec.current_step_key);
  } else {
    const start = getStartNode(definition);
    const next = start ? getNextNodes(definition, start.id)[0] : undefined;
    currentNode = next ?? start;
  }

  const visited = new Set<string>();
  while (currentNode && !visited.has(currentNode.id)) {
    visited.add(currentNode.id);
    const stepStart = Date.now();

    await supabase.from("automation_executions").update({
      current_step_key: currentNode.id,
    }).eq("id", executionId);

    const logInsert = {
      execution_id: executionId,
      step_key: currentNode.id,
      status: "running",
      input: currentNode.config,
      started_at: new Date().toISOString(),
    };
    const { data: logRow } = await supabase
      .from("automation_execution_logs")
      .insert(logInsert)
      .select("id")
      .single();

    let branchWhen: string | undefined;
    let stepStatus = "completed";
    let stepError: string | undefined;
    let output: Record<string, unknown> = {};

    try {
      if (currentNode.type === "condition") {
        const passed = evaluateConditions(
          currentNode.config as { operator: "AND" | "OR"; rules: { field: string; op: "eq"; value: unknown }[] },
          payload
        );
        branchWhen = passed ? "true" : "false";
        output = { passed };
      } else if (currentNode.type === "branch") {
        branchWhen = String(currentNode.config.branch ?? "true");
      } else if (currentNode.type === "approval") {
        const approverId = currentNode.config.approver_id as string | undefined;
        await supabase.from("automation_approvals").insert({
          execution_id: executionId,
          step_key: currentNode.id,
          approver_id: approverId,
          level: (currentNode.config.level as number) ?? 1,
          status: "pending",
        });
        await supabase.from("automation_executions").update({
          status: "paused",
        }).eq("id", executionId);
        stepStatus = "waiting";
        if (logRow) {
          await supabase.from("automation_execution_logs").update({
            status: "waiting",
            completed_at: new Date().toISOString(),
            duration_ms: Date.now() - stepStart,
          }).eq("id", logRow.id);
        }
        return { execution_id: executionId, status: "paused", step: currentNode.id };
      } else if (currentNode.type === "action") {
        const actionType = String(currentNode.config.action ?? "send_notification");
        const result = await executeAction(actionType, currentNode.config as Record<string, unknown>, ctx);
        if (result.pauseUntil) {
          await supabase.from("automation_executions").update({
            status: "paused",
            paused_until: result.pauseUntil,
          }).eq("id", executionId);
          stepStatus = "waiting";
          if (logRow) {
            await supabase.from("automation_execution_logs").update({
              status: "waiting",
              output: result.output,
              completed_at: new Date().toISOString(),
              duration_ms: Date.now() - stepStart,
            }).eq("id", logRow.id);
          }
          return { execution_id: executionId, status: "paused", until: result.pauseUntil };
        }
        if (!result.success) {
          stepStatus = "failed";
          stepError = result.error;
          throw new Error(result.error);
        }
        output = result.output ?? {};
        Object.assign(payload, output);
      } else if (currentNode.type === "delay") {
        const result = await executeAction("delay", currentNode.config as Record<string, unknown>, ctx);
        if (result.pauseUntil) {
          await supabase.from("automation_executions").update({
            status: "paused",
            paused_until: result.pauseUntil,
          }).eq("id", executionId);
          stepStatus = "waiting";
          if (logRow) {
            await supabase.from("automation_execution_logs").update({
              status: "waiting",
              output: result.output,
              completed_at: new Date().toISOString(),
              duration_ms: Date.now() - stepStart,
            }).eq("id", logRow.id);
          }
          return { execution_id: executionId, status: "paused", until: result.pauseUntil };
        }
      }
      // trigger, loop: pass through

      if (logRow) {
        await supabase.from("automation_execution_logs").update({
          status: stepStatus,
          output,
          error: stepError,
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - stepStart,
        }).eq("id", logRow.id);
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "Step failed";
      const retryCount = (exec.retry_count as number) + 1;
      const maxRetries = exec.max_retries as number;

      if (logRow) {
        await supabase.from("automation_execution_logs").update({
          status: "failed",
          error: errMsg,
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - stepStart,
          retry_count: retryCount,
        }).eq("id", logRow.id);
      }

      if (retryCount < maxRetries) {
        await supabase.from("automation_executions").update({
          status: "pending",
          retry_count: retryCount,
          error_message: errMsg,
        }).eq("id", executionId);
        return { execution_id: executionId, status: "retry", error: errMsg };
      }

      await supabase.from("automation_executions").update({
        status: "failed",
        error_message: errMsg,
        completed_at: new Date().toISOString(),
      }).eq("id", executionId);

      await supabase.from("automation_dead_letter").insert({
        execution_id: executionId,
        workflow_id: workflow.id,
        error: errMsg,
        payload,
      });

      return { execution_id: executionId, status: "failed", error: errMsg };
    }

    const nextNodes = getNextNodes(definition, currentNode.id, branchWhen);
    currentNode = nextNodes[0];
  }

  await supabase.from("automation_executions").update({
    status: "completed",
    completed_at: new Date().toISOString(),
    current_step_key: null,
  }).eq("id", executionId);

  return { execution_id: executionId, status: "completed" };
}
