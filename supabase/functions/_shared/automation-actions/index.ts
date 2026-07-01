import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { routeNotification } from "./notification-router-core.ts";
import type { WorkflowDefinition, WorkflowNode } from "./automation-types.ts";

export interface ActionContext {
  supabase: SupabaseClient;
  executionId: string;
  tenantId: string;
  payload: Record<string, unknown>;
  supabaseUrl: string;
  serviceRoleKey: string;
}

export interface ActionResult {
  success: boolean;
  output?: Record<string, unknown>;
  error?: string;
  pauseUntil?: string;
  waitApproval?: boolean;
}

function interpolate(template: string, ctx: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, key) => {
    const parts = key.split(".");
    let val: unknown = ctx;
    for (const p of parts) {
      if (val && typeof val === "object") val = (val as Record<string, unknown>)[p];
      else return "";
    }
    return String(val ?? "");
  });
}

function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)(m|h|d)$/);
  if (!match) return 0;
  const n = parseInt(match[1], 10);
  switch (match[2]) {
    case "m": return n * 60 * 1000;
    case "h": return n * 60 * 60 * 1000;
    case "d": return n * 24 * 60 * 60 * 1000;
    default: return 0;
  }
}

async function invokeFunction(
  ctx: ActionContext,
  name: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  try {
    const res = await fetch(`${ctx.supabaseUrl}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ctx.serviceRoleKey}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error ?? res.statusText };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "invoke failed" };
  }
}

export async function executeAction(
  actionType: string,
  config: Record<string, unknown>,
  ctx: ActionContext
): Promise<ActionResult> {
  const merged = { ...ctx.payload, ...config };

  switch (actionType) {
    case "send_notification":
    case "send_email": {
      const userId = (config.user_id ?? ctx.payload.user_id ?? ctx.payload.assigned_to) as string | undefined;
      if (!userId) return { success: false, error: "No recipient user_id" };
      const title = interpolate(String(config.title ?? "Automation Notification"), merged);
      const message = interpolate(String(config.message ?? ""), merged);
      await routeNotification(ctx.supabase, {
        event_key: String(config.event_key ?? "system.alert"),
        user_id: userId,
        title,
        message,
        severity: (config.severity as "info") ?? "info",
        channels: actionType === "send_email" ? ["email", "in_app"] : ["in_app"],
        skip_auth: true,
        tenant_id: ctx.tenantId,
        metadata: { execution_id: ctx.executionId, automation: true },
      });
      return { success: true, output: { notified: userId } };
    }

    case "create_task": {
      const { data, error } = await ctx.supabase.from("tasks").insert({
        title: interpolate(String(config.title ?? "Automated task"), merged),
        description: config.description ? interpolate(String(config.description), merged) : null,
        status: "todo",
        priority: config.priority ?? "medium",
        assigned_to: config.assigned_to ?? ctx.payload.assigned_to ?? null,
        created_by: config.created_by ?? ctx.payload.user_id ?? null,
      }).select("id").single();
      if (error) return { success: false, error: error.message };
      return { success: true, output: { task_id: data.id } };
    }

    case "update_task": {
      const taskId = (config.task_id ?? ctx.payload.task_id ?? ctx.payload.id) as string;
      if (!taskId) return { success: false, error: "No task_id" };
      const updates: Record<string, unknown> = {};
      if (config.status) updates.status = config.status;
      if (config.priority) updates.priority = config.priority;
      if (config.assigned_to) updates.assigned_to = config.assigned_to;
      const { error } = await ctx.supabase.from("tasks").update(updates).eq("id", taskId);
      if (error) return { success: false, error: error.message };
      return { success: true, output: { task_id: taskId } };
    }

    case "assign_user": {
      const recordId = (config.record_id ?? ctx.payload.id) as string;
      const table = String(config.table ?? "tasks");
      const { error } = await ctx.supabase.from(table).update({
        assigned_to: config.user_id,
      }).eq("id", recordId);
      if (error) return { success: false, error: error.message };
      return { success: true };
    }

    case "update_record": {
      const table = String(config.table);
      const recordId = (config.record_id ?? ctx.payload.id) as string;
      const fields = (config.fields ?? {}) as Record<string, unknown>;
      const { error } = await ctx.supabase.from(table).update(fields).eq("id", recordId);
      if (error) return { success: false, error: error.message };
      return { success: true };
    }

    case "slack_message":
    case "teams_message": {
      const userId = (config.user_id ?? ctx.payload.user_id) as string;
      await routeNotification(ctx.supabase, {
        user_id: userId,
        title: interpolate(String(config.title ?? "Automation"), merged),
        message: interpolate(String(config.message ?? ""), merged),
        channels: [actionType === "slack_message" ? "slack" : "teams"],
        skip_auth: true,
      });
      return { success: true };
    }

    case "trigger_ai_agent":
    case "generate_summary":
    case "classify_text":
    case "sentiment_analysis":
    case "extract_tasks":
    case "document_categorize":
    case "meeting_summary": {
      const agentSlug = String(config.agent_slug ?? config.agent_id ?? "default");
      const promptMap: Record<string, string> = {
        generate_summary: "Generate a concise summary of the following content.",
        classify_text: "Classify the following text into appropriate categories. Return JSON with category and confidence.",
        sentiment_analysis: "Analyze sentiment. Return JSON with sentiment (positive/neutral/negative) and score.",
        extract_tasks: "Extract actionable tasks from the content. Return JSON array of tasks.",
        document_categorize: "Categorize this document. Return JSON with category and tags.",
        meeting_summary: "Summarize this meeting transcript with key points and action items.",
      };
      const input = config.input
        ? interpolate(String(config.input), merged)
        : JSON.stringify(ctx.payload);
      const result = await invokeFunction(ctx, "run-ai-agent", {
        agent_slug: agentSlug,
        input: actionType === "trigger_ai_agent"
          ? input
          : `${promptMap[actionType] ?? "Process:"}\n\n${input}`,
        metadata: { automation_execution_id: ctx.executionId },
      });
      if (!result.ok) return { success: false, error: result.error };
      return { success: true, output: { ai_result: result.data } };
    }

    case "call_webhook":
    case "http_request": {
      const url = String(config.url ?? "");
      if (!url) return { success: false, error: "No URL configured" };
      const method = String(config.method ?? "POST").toUpperCase();
      const headers = (config.headers ?? { "Content-Type": "application/json" }) as Record<string, string>;
      const body = config.body ?? ctx.payload;
      const res = await fetch(url, {
        method,
        headers,
        body: method !== "GET" ? JSON.stringify(body) : undefined,
      });
      const text = await res.text();
      if (!res.ok) return { success: false, error: `HTTP ${res.status}: ${text.slice(0, 500)}` };
      return { success: true, output: { status: res.status, body: text.slice(0, 2000) } };
    }

    case "delay": {
      const duration = String(config.duration ?? "5m");
      const ms = parseDuration(duration);
      const pauseUntil = new Date(Date.now() + ms).toISOString();
      return { success: true, pauseUntil, output: { paused_for: duration } };
    }

    case "create_meeting":
    case "create_todo":
    case "create_issue": {
      return { success: true, output: { stub: true, action: actionType, message: "Delegated to domain module" } };
    }

    default:
      return { success: false, error: `Unknown action: ${actionType}` };
  }
}

export function getNextNodes(
  definition: WorkflowDefinition,
  currentNodeId: string,
  branchWhen?: string
): WorkflowNode[] {
  const edges = definition.edges.filter((e) => e.from === currentNodeId);
  const filtered = branchWhen
    ? edges.filter((e) => !e.when || e.when === branchWhen)
    : edges.filter((e) => !e.when || e.when === "true" || e.when === "approved");
  const nodeMap = new Map(definition.nodes.map((n) => [n.id, n]));
  return filtered.map((e) => nodeMap.get(e.to)).filter(Boolean) as WorkflowNode[];
}

export function getStartNode(definition: WorkflowDefinition): WorkflowNode | undefined {
  return definition.nodes.find((n) => n.type === "trigger") ?? definition.nodes[0];
}
