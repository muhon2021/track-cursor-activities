import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PAGE_SIZE = 50;

type TaskStatusInternal = "todo" | "in_progress" | "completed" | "cancelled";

function jiraStatusNameToInternal(
  name: string | undefined | null,
): TaskStatusInternal {
  if (!name) return "todo";
  const n = name.toLowerCase().trim();

  if (
    /\b(done|closed|resolved|complete|finished)\b/.test(n) ||
    n === "done" ||
    n === "closed"
  ) {
    return "completed";
  }
  if (/\b(cancel|wont|declined|duplicate)\b/.test(n)) {
    return "cancelled";
  }
  if (
    /\b(progress|review|testing|qa|blocked|hold|staging|selected for development)\b/.test(n) ||
    n === "in progress"
  ) {
    return "in_progress";
  }
  return "todo";
}

function jiraPriorityNameToInternal(
  name: string | undefined | null,
): "low" | "medium" | "high" | "urgent" {
  if (!name) return "medium";
  const n = name.toLowerCase();
  if (n.includes("highest") || n.includes("critical")) return "urgent";
  if (n.includes("high")) return "high";
  if (n.includes("low") || n.includes("lowest") || n.includes("minor")) return "low";
  return "medium";
}

interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    description?: unknown;
    status?: { name?: string };
    priority?: { name?: string };
    issuetype?: { name?: string };
    project: { id: string; key: string; name?: string };
    updated?: string;
    duedate?: string | null;
    assignee?: { displayName?: string; emailAddress?: string } | null;
    comment?: { comments?: unknown[]; total?: number };
    components?: { name: string }[];
  };
}

interface SyncBody {
  project_key?: string;
  next_page_token?: string;
  start_at?: number;
}

interface SyncResponse {
  success: boolean;
  tasks_synced: number;
  tasks_created: number;
  tasks_updated: number;
  comments_synced: number;
  worklogs_synced: number;
  errors: string[];
  has_more?: boolean;
  next_page_token?: string;
  credential_source?: "integration_config" | "env";
}

interface JiraCredentials {
  host: string;
  email: string;
  apiToken: string;
  source: "integration_config" | "env";
}

function readConfigString(
  config: Record<string, unknown>,
  keys: string[],
): string {
  for (const key of keys) {
    const value = config[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function encodeCursor(startAt: number): string {
  return `j1:${btoa(JSON.stringify({ s: startAt }))}`;
}

function decodeCursor(token: string | undefined): number {
  if (!token || !token.startsWith("j1:")) return 0;
  try {
    const raw = atob(token.slice(3));
    const o = JSON.parse(raw) as { s?: number };
    return typeof o.s === "number" && o.s >= 0 ? o.s : 0;
  } catch {
    return 0;
  }
}

function normalizeBaseUrl(host: string): string {
  let h = host.trim().replace(/\/$/, "");
  if (!/^https?:\/\//i.test(h)) h = `https://${h}`;
  return h;
}

function adfToPlain(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (typeof node !== "object") return "";
  const n = node as Record<string, unknown>;
  if (n.type === "text" && typeof n.text === "string") return n.text;
  if (Array.isArray(n.content)) {
    return n.content.map(adfToPlain).join("");
  }
  return "";
}

function taskSlugFromTitle(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  return `${base || "task"}-${suffix}`;
}

async function jiraFetch(
  url: string,
  authHeader: string,
): Promise<Response> {
  return await fetch(url, {
    headers: {
      Authorization: authHeader,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });
}

async function resolveJiraCredentials(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<JiraCredentials | null> {
  const { data: provider } = await supabase
    .from("integration_providers")
    .select("id")
    .eq("slug", "jira")
    .maybeSingle();

  if (provider?.id) {
    const { data: userIntegration } = await supabase
      .from("organization_integrations")
      .select("config")
      .eq("provider_id", provider.id)
      .eq("user_id", userId)
      .eq("enabled", true)
      .in("connection_status", ["connected", "testing", "error", "disconnected"])
      .maybeSingle();

    const integrationCandidates = [userIntegration];
    if (!userIntegration) {
      const { data: orgWideIntegration } = await supabase
        .from("organization_integrations")
        .select("config")
        .eq("provider_id", provider.id)
        .is("user_id", null)
        .eq("enabled", true)
        .in("connection_status", ["connected", "testing", "error", "disconnected"])
        .maybeSingle();
      integrationCandidates.push(orgWideIntegration);
    }

    for (const integration of integrationCandidates) {
      const config = (integration?.config ?? {}) as Record<string, unknown>;
      const host = readConfigString(config, ["jira_host", "jiraHost", "host"]);
      const email = readConfigString(config, ["jira_email", "jiraEmail", "email"]);
      const apiToken = readConfigString(config, [
        "jira_api_token",
        "jiraApiToken",
        "api_token",
        "apiToken",
        "token",
      ]);

      if (host && email && apiToken) {
        return {
          host,
          email,
          apiToken,
          source: "integration_config",
        };
      }
    }
  }

  const host = Deno.env.get("JIRA_HOST")?.trim() ?? "";
  const email = Deno.env.get("JIRA_EMAIL")?.trim() ?? "";
  const apiToken = Deno.env.get("JIRA_API_TOKEN")?.trim() ?? "";
  if (host && email && apiToken) {
    return {
      host,
      email,
      apiToken,
      source: "env",
    };
  }

  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({
          success: false,
          tasks_synced: 0,
          tasks_created: 0,
          tasks_updated: 0,
          comments_synced: 0,
          worklogs_synced: 0,
          errors: ["Missing authorization header"],
        } as SyncResponse),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const jwt = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      return new Response(
        JSON.stringify({
          success: false,
          tasks_synced: 0,
          tasks_created: 0,
          tasks_updated: 0,
          comments_synced: 0,
          worklogs_synced: 0,
          errors: ["Invalid token"],
        } as SyncResponse),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const creds = await resolveJiraCredentials(supabase, user.id);
    if (!creds) {
      return new Response(
        JSON.stringify({
          success: false,
          tasks_synced: 0,
          tasks_created: 0,
          tasks_updated: 0,
          comments_synced: 0,
          worklogs_synced: 0,
          errors: [
            "Jira credentials not configured. Save jira_host, jira_email, jira_api_token in Admin Integrations or set JIRA_HOST, JIRA_EMAIL, JIRA_API_TOKEN secrets.",
          ],
        } as SyncResponse),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const baseUrl = normalizeBaseUrl(creds.host);
    const auth = `Basic ${btoa(`${creds.email}:${creds.apiToken}`)}`;

    let body: SyncBody = {};
    if (req.method === "POST") {
      try {
        body = (await req.json()) as SyncBody;
      } catch {
        body = {};
      }
    }

    const startAt =
      typeof body.start_at === "number"
        ? body.start_at
        : decodeCursor(body.next_page_token);

    let jql: string;
    if (body.project_key && body.project_key.trim()) {
      const pk = body.project_key.trim();
      jql = /^\d+$/.test(pk)
        ? `project = ${pk} ORDER BY updated DESC`
        : `project = "${pk.replace(/"/g, '\\"')}" ORDER BY updated DESC`;
    } else {
      jql = "updated >= -30d ORDER BY updated DESC";
    }

    const fields =
      "summary,description,status,assignee,issuetype,project,updated,priority,duedate,comment,components";
    const searchUrl =
      `${baseUrl}/rest/api/3/search/jql?jql=${
        encodeURIComponent(jql)
      }&startAt=${startAt}&maxResults=${PAGE_SIZE}&fields=${fields}`;

    const searchRes = await jiraFetch(searchUrl, auth);
    if (!searchRes.ok) {
      const text = await searchRes.text();
      return new Response(
        JSON.stringify({
          success: false,
          tasks_synced: 0,
          tasks_created: 0,
          tasks_updated: 0,
          comments_synced: 0,
          worklogs_synced: 0,
          errors: [`Jira search error: ${searchRes.status} ${text.slice(0, 300)}`],
        } as SyncResponse),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const searchJson = await searchRes.json() as {
      issues: JiraIssue[];
      total?: number;
      startAt?: number;
    };

    const issues = searchJson.issues ?? [];
    const total = searchJson.total ?? issues.length;
    const nextStart = startAt + issues.length;
    const hasMore = nextStart < total;

    const { data: creatorRow, error: creatorErr } = await supabase
      .from("profiles")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (creatorErr || !creatorRow?.id) {
      return new Response(
        JSON.stringify({
          success: false,
          tasks_synced: 0,
          tasks_created: 0,
          tasks_updated: 0,
          comments_synced: 0,
          worklogs_synced: 0,
          errors: ["No profiles row found; need at least one user profile for created_by."],
        } as SyncResponse),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const createdBy = creatorRow.id;

    const errors: string[] = [];
    let tasksCreated = 0;
    let tasksUpdated = 0;
    let commentsSynced = 0;
    let worklogsSynced = 0;

    for (const issue of issues) {
      try {
        const issueKey = issue.key;
        const statusName = issue.fields.status?.name;
        const internalStatus = jiraStatusNameToInternal(statusName);
        const internalPriority = jiraPriorityNameToInternal(
          issue.fields.priority?.name,
        );
        const descPlain = adfToPlain(issue.fields.description);

        const { data: proj } = await supabase
          .from("projects")
          .select("id")
          .eq("external_provider", "jira")
          .eq("external_id", String(issue.fields.project.id))
          .maybeSingle();

        const jiraUrl = `${baseUrl}/browse/${issueKey}`;
        const components = (issue.fields.components ?? []).map((c) => c.name);

        const { data: existingTask } = await supabase
          .from("tasks")
          .select("id, metadata, slug")
          .filter("metadata->>external_id", "eq", issueKey)
          .maybeSingle();

        const baseMetadata = {
          source: "jira",
          external_id: issueKey,
          jira_url: jiraUrl,
          jira_key: issueKey,
          jira_status_name: statusName ?? null,
          jira_project_key: issue.fields.project.key,
          jira_project_id: issue.fields.project.id,
          issue_type: issue.fields.issuetype?.name ?? null,
          components,
          assignee: issue.fields.assignee
            ? {
              display_name: issue.fields.assignee.displayName ?? null,
              email: issue.fields.assignee.emailAddress ?? null,
            }
            : null,
          updated_from_jira: issue.fields.updated ?? null,
        };

        const taskRow = {
          title: issue.fields.summary,
          description: descPlain || null,
          status: internalStatus,
          priority: internalPriority,
          due_date: issue.fields.duedate ?? null,
          work_type: issue.fields.issuetype?.name ?? null,
          project_id: proj?.id ?? null,
          metadata:
            existingTask?.metadata && typeof existingTask.metadata === "object"
              ? { ...(existingTask.metadata as Record<string, unknown>), ...baseMetadata }
              : baseMetadata,
          updated_at: new Date().toISOString(),
        };

        let taskId: string;

        if (existingTask) {
          taskId = existingTask.id;
          const { error: upErr } = await supabase.from("tasks").update(taskRow).eq(
            "id",
            taskId,
          );
          if (upErr) {
            errors.push(`${issueKey}: ${upErr.message}`);
            continue;
          }
          tasksUpdated++;
        } else {
          const slug = taskSlugFromTitle(issue.fields.summary);
          const { data: inserted, error: insErr } = await supabase
            .from("tasks")
            .insert({
              ...taskRow,
              slug,
              created_by: createdBy,
              created_at: new Date().toISOString(),
            })
            .select("id")
            .single();
          if (insErr || !inserted) {
            errors.push(`${issueKey}: ${insErr?.message ?? "insert failed"}`);
            continue;
          }
          taskId = inserted.id;
          tasksCreated++;
        }

        const commentRes = await jiraFetch(
          `${baseUrl}/rest/api/3/issue/${issue.id}/comment?maxResults=100`,
          auth,
        );
        if (commentRes.ok) {
          const cj = await commentRes.json() as {
            comments?: Array<{
              id: string;
              body?: unknown;
              author?: { displayName?: string; emailAddress?: string };
              created?: string;
              updated?: string;
            }>;
          };
          for (const c of cj.comments ?? []) {
            const cid = String(c.id);
            const plain = adfToPlain(c.body).trim() || "(empty comment)";
            const { data: exC } = await supabase
              .from("task_comments")
              .select("id")
              .eq("task_id", taskId)
              .eq("jira_comment_id", cid)
              .maybeSingle();
            if (exC) {
              await supabase.from("task_comments").update({
                content: plain,
                jira_author_name: c.author?.displayName ?? null,
                jira_author_email: c.author?.emailAddress ?? null,
                updated_at: c.updated ?? new Date().toISOString(),
              }).eq("id", exC.id);
            } else {
              const { error: cErr } = await supabase.from("task_comments").insert({
                task_id: taskId,
                user_id: null,
                content: plain,
                jira_comment_id: cid,
                jira_author_name: c.author?.displayName ?? null,
                jira_author_email: c.author?.emailAddress ?? null,
                created_at: c.created ?? new Date().toISOString(),
                updated_at: c.updated ?? new Date().toISOString(),
              });
              if (cErr) errors.push(`${issueKey} comment ${cid}: ${cErr.message}`);
            }
            commentsSynced++;
          }
        }

        const wlRes = await jiraFetch(
          `${baseUrl}/rest/api/3/issue/${issue.id}/worklog`,
          auth,
        );
        if (wlRes.ok) {
          const wj = await wlRes.json() as {
            worklogs?: Array<{
              id: string;
              timeSpentSeconds?: number;
              started?: string;
              comment?: unknown;
              author?: { displayName?: string };
            }>;
          };
          for (const wl of wj.worklogs ?? []) {
            const wid = String(wl.id);
            const secs = wl.timeSpentSeconds ?? 0;
            const hours = Math.round((secs / 3600) * 100) / 100;
            const { data: exW } = await supabase
              .from("task_time_logs")
              .select("id")
              .eq("task_id", taskId)
              .eq("source", "jira")
              .filter("metadata->>jira_worklog_id", "eq", wid)
              .maybeSingle();

            const wlRow = {
              task_id: taskId,
              user_id: null as string | null,
              hours,
              started_at: wl.started ?? null,
              note: adfToPlain(wl.comment) || null,
              source: "jira",
              metadata: {
                jira_worklog_id: wid,
                author: wl.author?.displayName ?? null,
              },
            };

            if (exW) {
              await supabase.from("task_time_logs").update(wlRow).eq("id", exW.id);
            } else {
              const { error: wErr } = await supabase.from("task_time_logs").insert(wlRow);
              if (wErr) errors.push(`${issueKey} worklog ${wid}: ${wErr.message}`);
            }
            worklogsSynced++;
          }
        }
      } catch (e) {
        errors.push(
          `${issue.key}: ${e instanceof Error ? e.message : "unknown error"}`,
        );
      }
    }

    const payload: SyncResponse = {
      success: errors.length === 0,
      tasks_synced: tasksCreated + tasksUpdated,
      tasks_created: tasksCreated,
      tasks_updated: tasksUpdated,
      comments_synced: commentsSynced,
      worklogs_synced: worklogsSynced,
      errors,
      has_more: hasMore,
      next_page_token: hasMore ? encodeCursor(nextStart) : undefined,
      credential_source: creds.source,
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("sync-tasks-jira error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        tasks_synced: 0,
        tasks_created: 0,
        tasks_updated: 0,
        comments_synced: 0,
        worklogs_synced: 0,
        errors: [error instanceof Error ? error.message : "Unknown error"],
      } as SyncResponse),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
