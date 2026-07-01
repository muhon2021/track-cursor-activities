import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requirePermission } from "../_shared/permission-auth.ts";
import type { WorkflowDefinition } from "../_shared/automation-types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ManageAction =
  | "list"
  | "get"
  | "create"
  | "update"
  | "delete"
  | "clone"
  | "enable"
  | "disable"
  | "execute"
  | "list_templates"
  | "clone_template"
  | "list_executions"
  | "get_execution"
  | "list_webhooks"
  | "create_webhook"
  | "delete_webhook"
  | "respond_approval";

interface ManageBody {
  action: ManageAction;
  id?: string;
  template_id?: string;
  workflow?: Record<string, unknown>;
  filters?: { search?: string; enabled?: boolean; trigger_type?: string };
  approval_id?: string;
  approval_status?: "approved" | "rejected";
  comment?: string;
}

function syncStepsFromDefinition(
  definition: WorkflowDefinition
): Array<{ step_key: string; step_type: string; position: number; config: Record<string, unknown>; depends_on: string[] }> {
  const deps = new Map<string, string[]>();
  for (const edge of definition.edges ?? []) {
    const list = deps.get(edge.to) ?? [];
    list.push(edge.from);
    deps.set(edge.to, list);
  }
  return (definition.nodes ?? []).map((node, i) => ({
    step_key: node.id,
    step_type: node.type,
    position: i,
    config: node.config ?? {},
    depends_on: deps.get(node.id) ?? [],
  }));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = (await req.json()) as ManageBody;
    const authHeader = req.headers.get("Authorization");
    const isServiceRole = authHeader?.includes(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "___none___");

    const permMap: Partial<Record<ManageAction, string>> = {
      list: "automation.view",
      get: "automation.view",
      create: "automation.create",
      update: "automation.edit",
      delete: "automation.delete",
      clone: "automation.create",
      enable: "automation.edit",
      disable: "automation.edit",
      execute: "automation.execute",
      list_templates: "automation.view",
      clone_template: "automation.create",
      list_executions: "automation.logs.view",
      get_execution: "automation.logs.view",
      list_webhooks: "automation.view",
      create_webhook: "automation.webhooks.manage",
      delete_webhook: "automation.webhooks.manage",
      respond_approval: "automation.view",
    };

    const requiredPerm = permMap[body.action] ?? "automation.admin";
    let authUserId: string | null = null;
    if (!isServiceRole) {
      const authResult = await requirePermission(req, supabase, corsHeaders, requiredPerm);
      if (authResult instanceof Response) return authResult;
      authUserId = authResult.userId;
    }

    const { data: tenantRow } = await supabase.rpc("get_user_tenant_id");
    const tenantId = tenantRow ?? "00000000-0000-0000-0000-000000000001";

    switch (body.action) {
      case "list": {
        let q = supabase.from("automation_workflows").select("*").order("updated_at", { ascending: false });
        if (body.filters?.enabled !== undefined) q = q.eq("enabled", body.filters.enabled);
        if (body.filters?.trigger_type) q = q.eq("trigger_type", body.filters.trigger_type);
        if (body.filters?.search) q = q.ilike("name", `%${body.filters.search}%`);
        const { data, error } = await q;
        if (error) throw error;
        return json({ data });
      }

      case "get": {
        const { data, error } = await supabase
          .from("automation_workflows")
          .select("*, automation_steps(*)")
          .eq("id", body.id)
          .single();
        if (error) throw error;
        return json({ data });
      }

      case "create": {
        const wf = body.workflow ?? {};
        const definition = (wf.definition ?? { version: 1, nodes: [], edges: [] }) as WorkflowDefinition;
        const { data, error } = await supabase.from("automation_workflows").insert({
          name: wf.name ?? "Untitled Workflow",
          description: wf.description ?? "",
          enabled: wf.enabled ?? false,
          trigger_type: wf.trigger_type ?? "manual",
          trigger_config: wf.trigger_config ?? {},
          definition,
          tenant_id: wf.tenant_id ?? tenantId,
          department_id: wf.department_id ?? null,
          created_by: authUserId,
        }).select().single();
        if (error) throw error;

        const steps = syncStepsFromDefinition(definition);
        if (steps.length > 0) {
          await supabase.from("automation_steps").insert(
            steps.map((s) => ({ ...s, workflow_id: data.id }))
          );
        }
        return json({ data });
      }

      case "update": {
        const wf = body.workflow ?? {};
        const definition = wf.definition as WorkflowDefinition | undefined;
        const updates: Record<string, unknown> = { ...wf };
        delete updates.id;
        if (definition) updates.definition = definition;

        const { data, error } = await supabase
          .from("automation_workflows")
          .update(updates)
          .eq("id", body.id)
          .select()
          .single();
        if (error) throw error;

        if (definition) {
          await supabase.from("automation_steps").delete().eq("workflow_id", body.id);
          const steps = syncStepsFromDefinition(definition);
          if (steps.length > 0) {
            await supabase.from("automation_steps").insert(
              steps.map((s) => ({ ...s, workflow_id: body.id }))
            );
          }
        }
        return json({ data });
      }

      case "delete": {
        const { error } = await supabase.from("automation_workflows").delete().eq("id", body.id);
        if (error) throw error;
        return json({ success: true });
      }

      case "clone": {
        const { data: source, error: srcErr } = await supabase
          .from("automation_workflows")
          .select("*")
          .eq("id", body.id)
          .single();
        if (srcErr) throw srcErr;
        const { data, error } = await supabase.from("automation_workflows").insert({
          name: `${source.name} (Copy)`,
          description: source.description,
          enabled: false,
          trigger_type: source.trigger_type,
          trigger_config: source.trigger_config,
          definition: source.definition,
          tenant_id: source.tenant_id,
          department_id: source.department_id,
        }).select().single();
        if (error) throw error;
        const def = source.definition as WorkflowDefinition;
        const steps = syncStepsFromDefinition(def);
        if (steps.length > 0) {
          await supabase.from("automation_steps").insert(steps.map((s) => ({ ...s, workflow_id: data.id })));
        }
        return json({ data });
      }

      case "enable":
      case "disable": {
        const { data, error } = await supabase
          .from("automation_workflows")
          .update({ enabled: body.action === "enable" })
          .eq("id", body.id)
          .select()
          .single();
        if (error) throw error;
        return json({ data });
      }

      case "execute": {
        const { data: wf, error: wfErr } = await supabase
          .from("automation_workflows")
          .select("*")
          .eq("id", body.id)
          .single();
        if (wfErr) throw wfErr;

        const payload = (body.workflow?.trigger_payload ?? {}) as Record<string, unknown>;
        const idempotencyKey = body.workflow?.idempotency_key as string | undefined;

        const { data: exec, error: execErr } = await supabase.from("automation_executions").insert({
          workflow_id: wf.id,
          tenant_id: wf.tenant_id,
          status: "pending",
          trigger_payload: payload,
          idempotency_key: idempotencyKey ?? null,
        }).select().single();
        if (execErr) throw execErr;

        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/automation-executor`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({ execution_id: exec.id }),
        });

        return json({ data: exec });
      }

      case "list_templates": {
        const { data, error } = await supabase
          .from("automation_templates")
          .select("*")
          .or(`is_system.eq.true,tenant_id.eq.${tenantId}`)
          .order("category");
        if (error) throw error;
        return json({ data });
      }

      case "clone_template": {
        const { data: tmpl, error: tErr } = await supabase
          .from("automation_templates")
          .select("*")
          .eq("id", body.template_id)
          .single();
        if (tErr) throw tErr;
        const { data, error } = await supabase.from("automation_workflows").insert({
          name: tmpl.name,
          description: tmpl.description,
          enabled: false,
          trigger_type: tmpl.trigger_type,
          definition: tmpl.definition,
          tenant_id: tenantId,
        }).select().single();
        if (error) throw error;
        return json({ data });
      }

      case "list_executions": {
        const { data, error } = await supabase
          .from("automation_executions")
          .select("*, automation_workflows(name, trigger_type)")
          .order("created_at", { ascending: false })
          .limit(100);
        if (error) throw error;
        return json({ data });
      }

      case "get_execution": {
        const { data, error } = await supabase
          .from("automation_executions")
          .select("*, automation_execution_logs(*), automation_workflows(name)")
          .eq("id", body.id)
          .single();
        if (error) throw error;
        return json({ data });
      }

      case "list_webhooks": {
        const { data, error } = await supabase.from("automation_webhooks").select("id, name, path_slug, enabled, workflow_id, created_at");
        if (error) throw error;
        return json({ data });
      }

      case "create_webhook": {
        const wf = body.workflow ?? {};
        const slug = String(wf.path_slug ?? crypto.randomUUID().slice(0, 8));
        const secret = crypto.randomUUID();
        const { data, error } = await supabase.from("automation_webhooks").insert({
          name: wf.name ?? "Webhook",
          workflow_id: wf.workflow_id,
          path_slug: slug,
          secret,
          tenant_id: tenantId,
        }).select("id, name, path_slug, secret, workflow_id").single();
        if (error) throw error;
        return json({ data });
      }

      case "delete_webhook": {
        const { error } = await supabase.from("automation_webhooks").delete().eq("id", body.id);
        if (error) throw error;
        return json({ success: true });
      }

      case "respond_approval": {
        const { data: approval, error: aErr } = await supabase
          .from("automation_approvals")
          .update({
            status: body.approval_status,
            comment: body.comment,
            decided_at: new Date().toISOString(),
          })
          .eq("id", body.approval_id)
          .select("execution_id")
          .single();
        if (aErr) throw aErr;

        if (body.approval_status === "approved") {
          await supabase.from("automation_executions")
            .update({ status: "pending", paused_until: null })
            .eq("id", approval.execution_id);
          await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/automation-executor`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({ execution_id: approval.execution_id }),
          });
        } else {
          await supabase.from("automation_executions")
            .update({ status: "cancelled", completed_at: new Date().toISOString() })
            .eq("id", approval.execution_id);
        }
        return json({ success: true });
      }

      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return json({ error: message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}
