// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ClickUpTeam {
  id: string;
  name: string;
}

interface ClickUpSpace {
  id: string;
  name: string;
}

interface ClickUpList {
  id: string;
  name: string;
}

interface ClickUpTask {
  id: string;
  name: string;
  status?: {
    status?: string;
    type?: string;
  };
  due_date?: string | number | null;
}

interface ClickUpUserProfile {
  id?: number | string;
  username?: string | null;
  email?: string | null;
}

interface ClickUpTag {
  name?: string;
}

interface ClickUpPriority {
  id?: string;
  priority?: string;
  color?: string;
}

interface ClickUpAttachment {
  id?: string;
  title?: string;
  mimetype?: string;
  size?: number;
  url?: string;
}

interface ClickUpTaskLocation {
  location?: string;
}

interface ClickUpTaskDetailed extends ClickUpTask {
  text_content?: string | null;
  description?: string | null;
  assignees?: ClickUpUserProfile[];
  watchers?: ClickUpUserProfile[];
  tags?: ClickUpTag[];
  priority?: ClickUpPriority | null;
  due_date?: string | number | null;
  start_date?: string | number | null;
  date_created?: string | number | null;
  date_updated?: string | number | null;
  points?: number | null;
  time_estimate?: number | string | null;
  time_spent?: number | string | null;
  custom_fields?: Array<{ name?: string; type?: string; value?: unknown }>;
  dependencies?: unknown[];
  linked_tasks?: unknown[];
  locations?: ClickUpTaskLocation[];
  checklists?: unknown[];
  parent?: string | number | null;
  team_id?: string | number | null;
  url?: string | null;
  list?: { id?: string; name?: string };
  project?: { id?: string; name?: string };
  folder?: { id?: string; name?: string };
  space?: { id?: string };
  attachments?: ClickUpAttachment[];
}

interface SyncResult {
  success: boolean;
  projects_synced: number;
  projects_created: number;
  projects_updated: number;
  tasks_synced: number;
  duration_ms: number;
  errors: string[];
}

interface OpenAIEmbeddingResponse {
  data: Array<{
    embedding: number[];
  }>;
}

function chunkText(text: string, chunkSize = 800): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    chunks.push(text.slice(start, start + chunkSize));
    start += chunkSize;
  }
  return chunks;
}

async function embedTextOpenAI(args: { openAiApiKey: string; input: string }): Promise<number[]> {
  const resp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.openAiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: args.input,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`OpenAI embeddings failed: ${resp.status} - ${text.slice(0, 300)}`);
  }

  const json = (await resp.json()) as OpenAIEmbeddingResponse;
  const embedding = json.data?.[0]?.embedding;
  if (!Array.isArray(embedding)) {
    throw new Error("OpenAI embeddings response missing embedding vector");
  }
  return embedding;
}

async function upsertTaskEmbeddings(args: {
  supabase: ReturnType<typeof createClient>;
  userId: string;
  taskId: string;
  content: string;
  metadata: Record<string, unknown>;
  openAiApiKey: string;
}): Promise<void> {
  const { supabase, userId, taskId, content, metadata } = args;

  // Clear prior embeddings for this task (idempotent updates)
  const { error: deleteError } = await supabase
    .from("embeddings")
    .delete()
    .eq("entity_type", "task")
    .eq("entity_id", taskId)
    .eq("user_id", userId);
  if (deleteError) {
    throw new Error(`Failed deleting prior embeddings: ${deleteError.message}`);
  }

  const chunks = chunkText(content, 800);
  const rows: Array<Record<string, unknown>> = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const embedding = await embedTextOpenAI({ openAiApiKey: args.openAiApiKey, input: chunk });
    rows.push({
      entity_type: "task",
      entity_id: taskId,
      user_id: userId,
      content: chunk,
      chunk_index: i,
      metadata,
      embedding,
      created_at: new Date().toISOString(),
    });

    // Small delay to reduce rate-limiting risk during big syncs
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  if (rows.length > 0) {
    const { error: insertError } = await supabase.from("embeddings").insert(rows);
    if (insertError) {
      throw new Error(`Failed inserting embeddings: ${insertError.message}`);
    }
  }
}

function slugFromNameAndId(name: string, externalId: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base}-${externalId}`.slice(0, 100);
}

function mapTaskStatus(rawStatus?: { status?: string; type?: string }): "todo" | "in_progress" | "completed" {
  const statusText = (rawStatus?.status || "").toLowerCase();
  const typeText = (rawStatus?.type || "").toLowerCase();

  if (statusText === "complete" || statusText === "completed" || typeText === "done") {
    return "completed";
  }
  if (statusText.includes("progress") || typeText === "in_progress") {
    return "in_progress";
  }
  return "todo";
}

function toIsoOrNull(value: string | number | null | undefined): string | null {
  if (value == null || value === "") {
    return null;
  }
  const millis = Number(value);
  if (!Number.isFinite(millis)) {
    return null;
  }
  return new Date(millis).toISOString();
}

function toUserLabel(user: ClickUpUserProfile): string {
  const name = user.username?.trim();
  const email = user.email?.trim();
  if (name && email) {
    return `${name} <${email}>`;
  }
  if (email) {
    return email;
  }
  if (name) {
    return name;
  }
  return String(user.id ?? "unknown");
}

function buildTaskEmbeddingContent(args: {
  task: ClickUpTaskDetailed;
  normalizedStatus: "todo" | "in_progress" | "completed";
  dueIso: string | null;
  startIso: string | null;
  createdIso: string | null;
  updatedIso: string | null;
  tags: string[];
  points: number | null;
  timeEstimateMs: number | null;
  timeSpentMs: number | null;
}): string {
  const { task } = args;
  const assignees = Array.isArray(task.assignees) ? task.assignees.map(toUserLabel).filter(Boolean) : [];
  const watchers = Array.isArray(task.watchers) ? task.watchers.map(toUserLabel).filter(Boolean) : [];
  const attachments = Array.isArray(task.attachments)
    ? task.attachments.map((a) => ({
        id: a.id ?? null,
        title: a.title ?? null,
        mimetype: a.mimetype ?? null,
        size: typeof a.size === "number" ? a.size : null,
        url: a.url ?? null,
      }))
    : [];

  const sections: string[] = [
    `Task ID: ${String(task.id)}`,
    `Task Name: ${task.name || "ClickUp Task"}`,
    task.text_content ? `Text Content: ${task.text_content}` : "",
    task.description ? `Description: ${task.description}` : "",
    `Status (Normalized): ${args.normalizedStatus}`,
    task.status?.status ? `Status (ClickUp): ${task.status.status}` : "",
    task.status?.type ? `Status Type (ClickUp): ${task.status.type}` : "",
    task.priority?.priority ? `Priority: ${task.priority.priority}` : "",
    args.dueIso ? `Due Date: ${args.dueIso}` : "",
    args.startIso ? `Start Date: ${args.startIso}` : "",
    args.createdIso ? `Created At: ${args.createdIso}` : "",
    args.updatedIso ? `Updated At: ${args.updatedIso}` : "",
    args.tags.length > 0 ? `Tags: ${args.tags.join(", ")}` : "",
    args.points != null ? `Points: ${args.points}` : "",
    args.timeEstimateMs != null ? `Time Estimate (ms): ${args.timeEstimateMs}` : "",
    args.timeSpentMs != null ? `Time Spent (ms): ${args.timeSpentMs}` : "",
    assignees.length > 0 ? `Assignees: ${assignees.join(", ")}` : "",
    watchers.length > 0 ? `Watchers: ${watchers.join(", ")}` : "",
    task.list?.name ? `List: ${task.list.name}` : "",
    task.project?.name ? `Project: ${task.project.name}` : "",
    task.folder?.name ? `Folder: ${task.folder.name}` : "",
    task.space?.id ? `Space ID: ${task.space.id}` : "",
    task.team_id != null ? `Team ID: ${String(task.team_id)}` : "",
    task.url ? `Task URL: ${task.url}` : "",
    attachments.length > 0 ? `Attachments: ${JSON.stringify(attachments)}` : "",
    Array.isArray(task.custom_fields) ? `Custom Fields: ${JSON.stringify(task.custom_fields)}` : "",
    Array.isArray(task.checklists) ? `Checklists Count: ${task.checklists.length}` : "",
    Array.isArray(task.dependencies) ? `Dependencies Count: ${task.dependencies.length}` : "",
    Array.isArray(task.linked_tasks) ? `Linked Tasks Count: ${task.linked_tasks.length}` : "",
    Array.isArray(task.locations) ? `Locations: ${JSON.stringify(task.locations)}` : "",
    `Has Parent: ${Boolean(task.parent)}`,
    `Raw Task Payload: ${JSON.stringify(task)}`,
  ];

  return sections.filter((line) => line !== "").join("\n");
}

serve(async (req) => {
  console.log("req:", req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const started = Date.now();

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured (required to embed synced tasks)");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
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
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Get ClickUp OAuth token for this user
    const { data: tokenRow, error: tokenError } = await supabase
      .from("user_oauth_tokens")
      .select("*")
      .eq("user_id", user.id)
      .eq("provider_slug", "clickup")
      .maybeSingle();

    if (tokenError || !tokenRow) {
      return new Response(
        JSON.stringify({ error: "No ClickUp connection found for this user" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const accessToken = tokenRow.access_token as string;
    const headers: HeadersInit = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };

    const errors: string[] = [];
    let projectsCreated = 0;
    let projectsUpdated = 0;
    let tasksCreated = 0;
    let tasksUpdated = 0;
    let taskEmbeddingsInserted = 0;
    let taskEmbeddingsFailed = 0;

    // Get default project status (used for imported ClickUp projects)
    let defaultStatusId: string | null = null;
    const { data: defaultStatusRow } = await supabase
      .from("project_statuses")
      .select("id")
      .eq("is_default", true)
      .maybeSingle();
    if (defaultStatusRow?.id) {
      defaultStatusId = defaultStatusRow.id as string;
    }

    // 1) Get teams for this user
    const teamsResp = await fetch("https://api.clickup.com/api/v2/team", {
      method: "GET",
      headers,
    });

    if (!teamsResp.ok) {
      const text = await teamsResp.text();
      return new Response(
        JSON.stringify({
          success: false,
          projects_synced: 0,
          projects_created: 0,
          projects_updated: 0,
          tasks_synced: 0,
          duration_ms: Date.now() - started,
          errors: [`ClickUp /team error: ${teamsResp.status} - ${text.slice(0, 200)}`],
        } satisfies SyncResult),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const teamsJson = await teamsResp.json();
    const teams: ClickUpTeam[] = teamsJson.teams ?? [];

    if (teams.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          projects_synced: 0,
          projects_created: 0,
          projects_updated: 0,
          tasks_synced: 0,
          duration_ms: Date.now() - started,
          errors: [],
        } satisfies SyncResult),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // For now, use the first team as the primary workspace
    const team = teams[0];

    // 2) Get spaces (we treat each Space as a Project in our system)
    const spacesResp = await fetch(
      `https://api.clickup.com/api/v2/team/${team.id}/space?archived=false`,
      { method: "GET", headers },
    );

    if (!spacesResp.ok) {
      const text = await spacesResp.text();
      return new Response(
        JSON.stringify({
          success: false,
          projects_synced: 0,
          projects_created: 0,
          projects_updated: 0,
          tasks_synced: 0,
          duration_ms: Date.now() - started,
          errors: [`ClickUp /space error: ${spacesResp.status} - ${text.slice(0, 200)}`],
        } satisfies SyncResult),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const spacesJson = await spacesResp.json();
    const spaces: ClickUpSpace[] = spacesJson.spaces ?? [];

    for (const space of spaces) {
      const externalId = String(space.id);
      const slug = slugFromNameAndId(space.name, externalId);

      const { data: existing } = await supabase
        .from("projects")
        .select("id")
        .eq("external_provider", "clickup")
        .eq("external_id", externalId)
        .maybeSingle();

      const nowIso = new Date().toISOString();
      const row: any = {
        name: space.name,
        slug,
        description: null,
        external_provider: "clickup",
        external_id: externalId,
        metadata: {
          source: "clickup",
          team_id: team.id,
        } as Record<string, unknown>,
        status_id: defaultStatusId,
        is_archived: false,
        owner_id: user.id,
        updated_at: nowIso,
      };

      let projectId: string | null = null;

      if (existing) {
        const { data: updated, error } = await supabase
          .from("projects")
          .update(row)
          .eq("id", existing.id)
          .select("id")
          .maybeSingle();
        if (error) {
          errors.push(`Update ${space.name}: ${error.message}`);
        } else {
          projectsUpdated++;
          projectId = updated?.id ?? existing.id;
        }
      } else {
        const insertRow = {
          ...row,
          created_at: nowIso,
          created_by: user.id,
        };
        const { data: inserted, error } = await supabase
          .from("projects")
          .insert(insertRow)
          .select("id")
          .maybeSingle();
        if (error) {
          errors.push(`Insert ${space.name}: ${error.message}`);
        } else {
          projectsCreated++;
          projectId = inserted?.id ?? null;
        }
      }

      // 3) For each space, fetch lists and then tasks
      const listsResp = await fetch(
        `https://api.clickup.com/api/v2/space/${space.id}/list?archived=false`,
        { method: "GET", headers },
      );

      if (!listsResp.ok) {
        const text = await listsResp.text();
        errors.push(`ClickUp /space/${space.id}/list error: ${listsResp.status} - ${text.slice(0, 200)}`);
        continue;
      }

      const listsJson = await listsResp.json();
      const lists: ClickUpList[] = listsJson.lists ?? [];

      for (const list of lists) {
        const tasksResp = await fetch(
          // Include additional task details like time tracking, tags, and custom fields
          `https://api.clickup.com/api/v2/list/${list.id}/task?archived=false&subtasks=false`,
          { method: "GET", headers },
        );

        if (!tasksResp.ok) {
          const text = await tasksResp.text();
          errors.push(`ClickUp /list/${list.id}/task error: ${tasksResp.status} - ${text.slice(0, 200)}`);
          continue;
        }

        const tasksJson = await tasksResp.json();
        const tasks: ClickUpTask[] = tasksJson.tasks ?? [];

        for (const task of tasks) {
          const externalTaskId = String(task.id);

          const { data: existingTask } = await supabase
            .from("tasks")
            .select("id")
            .eq("created_by", user.id)
            .contains("metadata", { source: "clickup", external_id: externalTaskId })
            .maybeSingle();

          // Fetch full task details to get time tracking, tags, points, checklists, etc.
          let detailed: ClickUpTaskDetailed = task;
          try {
            const detailResp = await fetch(
              `https://api.clickup.com/api/v2/task/${externalTaskId}`,
              { method: "GET", headers },
            );
            if (detailResp.ok) {
              const detailJson = (await detailResp.json()) as ClickUpTaskDetailed;
              detailed = detailJson;
            }
          } catch {
            // best-effort; fall back to list task
          }

          const status = mapTaskStatus(detailed.status);
          const due = toIsoOrNull(detailed.due_date);
          const startDate = toIsoOrNull(detailed.start_date);
          const createdAt = toIsoOrNull(detailed.date_created);
          const updatedAt = toIsoOrNull(detailed.date_updated);

          const timeEstimateMs =
            detailed.time_estimate != null && detailed.time_estimate !== ""
              ? Number(detailed.time_estimate) || null
              : null;
          const timeSpentMs =
            detailed.time_spent != null && detailed.time_spent !== ""
              ? Number(detailed.time_spent) || null
              : null;

          const rawTags = detailed.tags || [];
          const tags = Array.isArray(rawTags)
            ? rawTags
                .map((t) => (typeof t === "string" ? t : t?.name))
                .filter((t: unknown): t is string => typeof t === "string" && !!t)
            : [];

          const points =
            typeof detailed.points === "number"
              ? detailed.points
              : (() => {
                  const customFields = (detailed.custom_fields || []) as Array<{
                    name?: string;
                    type?: string;
                    value?: unknown;
                  }>;
                  const pointsField = customFields.find(
                    (f) =>
                      f.type === "number" &&
                      typeof f.name === "string" &&
                      f.name.toLowerCase().includes("point"),
                  );
                  return (pointsField?.value as number | null) ?? null;
                })();

          const checklists = Array.isArray(detailed.checklists) ? detailed.checklists : [];
          const checklistsCount = checklists.length;

          // Extract richer ClickUp-specific details for the UI
          const clickupDetails = {
            timeEstimateMs,
            timeSpentMs,
            tags,
            sprintPoints: points,
            checklistsCount,
            hasParent: !!detailed.parent,
            url: detailed.url ?? null,
            attachments: Array.isArray(detailed.attachments)
              ? detailed.attachments.map((a) => ({
                  id: a.id ?? null,
                  title: a.title ?? null,
                  mimetype: a.mimetype ?? null,
                  size: typeof a.size === "number" ? a.size : null,
                  url: a.url ?? null,
                }))
              : [],
            // Keep raw payload in case the UI needs other fields later
            raw: detailed,
          };

          const ragContent = buildTaskEmbeddingContent({
            task: detailed,
            normalizedStatus: status,
            dueIso: due,
            startIso: startDate,
            createdIso: createdAt,
            updatedIso: updatedAt,
            tags,
            points,
            timeEstimateMs,
            timeSpentMs,
          });

          const taskRow: any = {
            title: detailed.name || task.name || "ClickUp Task",
            description: detailed.description ?? detailed.text_content ?? null,
            status,
            priority: "medium",
            assigned_to: null,
            meeting_id: null,
            client_id: null,
            due_date: due,
            metadata: {
              source: "clickup",
              external_id: externalTaskId,
              project_external_id: externalId,
              synced: true,
              attachments: clickupDetails.attachments,
              clickup: clickupDetails,
            },
            updated_at: new Date().toISOString(),
          };

          if (existingTask) {
            const { error } = await supabase
              .from("tasks")
              .update(taskRow)
              .eq("id", existingTask.id);
            if (error) {
              errors.push(`Update task ${externalTaskId}: ${error.message}`);
            } else {
              tasksUpdated++;
              try {
                await upsertTaskEmbeddings({
                  supabase,
                  userId: user.id,
                  taskId: existingTask.id,
                  content: ragContent,
                  metadata: taskRow.metadata as Record<string, unknown>,
                  openAiApiKey: OPENAI_API_KEY,
                });
                taskEmbeddingsInserted++;
              } catch (e) {
                taskEmbeddingsFailed++;
                errors.push(
                  `Embed task ${externalTaskId}: ${e instanceof Error ? e.message : "Unknown error"}`,
                );
              }
            }
          } else {
            const insertRow = {
              ...taskRow,
              created_at: new Date().toISOString(),
              created_by: user.id,
            };
            const { data: inserted, error } = await supabase
              .from("tasks")
              .insert(insertRow)
              .select("id")
              .maybeSingle();
            if (error) {
              errors.push(`Insert task ${externalTaskId}: ${error.message}`);
            } else {
              tasksCreated++;
              try {
                if (!inserted?.id) {
                  throw new Error("Inserted task id is missing");
                }
                await upsertTaskEmbeddings({
                  supabase,
                  userId: user.id,
                  taskId: inserted.id as string,
                  content: ragContent,
                  metadata: taskRow.metadata as Record<string, unknown>,
                  openAiApiKey: OPENAI_API_KEY,
                });
                taskEmbeddingsInserted++;
              } catch (e) {
                taskEmbeddingsFailed++;
                errors.push(
                  `Embed task ${externalTaskId}: ${e instanceof Error ? e.message : "Unknown error"}`,
                );
              }
            }
          }
        }
      }
    }

    const projectsSynced = projectsCreated + projectsUpdated;
    const tasksSynced = tasksCreated + tasksUpdated;

    // Update metadata on user_oauth_tokens with last sync info
    const newMetadata = {
      ...(tokenRow.metadata || {}),
      last_sync_at: new Date().toISOString(),
      last_sync_status: errors.length === 0 ? "success" : "partial",
      last_sync_error: errors.length ? errors[0] : null,
      projects_synced: projectsSynced,
      tasks_synced: tasksSynced,
    };

    await supabase
      .from("user_oauth_tokens")
      .update({ metadata: newMetadata })
      .eq("id", tokenRow.id);

    const result: SyncResult = {
      success: errors.length === 0 && taskEmbeddingsFailed === 0,
      projects_synced: projectsSynced,
      projects_created: projectsCreated,
      projects_updated: projectsUpdated,
      tasks_synced: tasksSynced,
      duration_ms: Date.now() - started,
      errors: [
        ...errors,
        // Always include a short embedding summary as a final line (helps verify behavior in UI logs)
        `Embedding summary: tasks_embedded=${taskEmbeddingsInserted}, embedding_failures=${taskEmbeddingsFailed}`,
      ],
    };

    try {
      const { data: providerRow } = await supabase
        .from("integration_providers")
        .select("id")
        .eq("slug", "clickup")
        .maybeSingle();

      const providerId = providerRow?.id ?? null;

      await supabase.from("integration_usage_logs").insert({
        organization_id: null,
        provider_id: providerId,
        service_id: null,
        user_id: user.id,
        action: "sync-clickup",
        status: errors.length === 0 ? "success" : errors.length === projectsSynced + tasksSynced ? "error" : "partial",
        request_metadata: {
          triggered_from: "edge_function",
        } as Record<string, unknown>,
        response_metadata: {
          projects_synced: projectsSynced,
          projects_created: projectsCreated,
          projects_updated: projectsUpdated,
          tasks_synced: tasksSynced,
          duration_ms: result.duration_ms,
        } as Record<string, unknown>,
        error_message: errors.length ? errors.join("; ").slice(0, 500) : null,
        estimated_cost: 0,
      });
    } catch (_logError) {
      // Logging failures should not break sync
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("sync-clickup error:", error);
    const result: SyncResult = {
      success: false,
      projects_synced: 0,
      projects_created: 0,
      projects_updated: 0,
      tasks_synced: 0,
      duration_ms: Date.now() - started,
      errors: [error instanceof Error ? error.message : "Unknown error"],
    };
    return new Response(JSON.stringify(result), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

