import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";

interface ClickUpTeam {
  id: string;
}

interface ClickUpSpace {
  id: string;
  name: string;
}

interface ClickUpList {
  id: string;
}

interface ClickUpStatus {
  status?: string;
  type?: string;
}

interface ClickUpTag {
  name?: string;
}

interface ClickUpTask {
  id: string;
  name?: string;
  text_content?: string | null;
  description?: string | null;
  status?: ClickUpStatus;
  due_date?: string | number | null;
  start_date?: string | number | null;
  date_created?: string | number | null;
  date_updated?: string | number | null;
  points?: number | null;
  time_estimate?: number | string | null;
  time_spent?: number | string | null;
  tags?: ClickUpTag[];
  checklists?: unknown[];
  custom_fields?: Array<{ name?: string; type?: string; value?: unknown }>;
  parent?: string | number | null;
  url?: string | null;
  assignees?: Array<{ id?: string | number; username?: string | null; email?: string | null }>;
  watchers?: Array<{ id?: string | number; username?: string | null; email?: string | null }>;
  list?: { id?: string; name?: string };
  project?: { id?: string; name?: string };
  folder?: { id?: string; name?: string };
  space?: { id?: string };
  team_id?: string | number | null;
  attachments?: Array<{ id?: string; title?: string; mimetype?: string; size?: number; url?: string }>;
  dependencies?: unknown[];
  linked_tasks?: unknown[];
  locations?: unknown[];
}

export interface LocalClickupSyncResult {
  success: boolean;
  projects_synced: number;
  projects_created: number;
  projects_updated: number;
  tasks_synced: number;
  duration_ms: number;
  errors: string[];
}

interface EmbeddingResponse {
  data: Array<{ embedding: number[] }>;
}

interface DbKeyRow {
  key: string;
  value: unknown;
}

function asJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function slugFromNameAndId(name: string, externalId: string): string {
  const base: string = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base}-${externalId}`.slice(0, 100);
}

function mapTaskStatus(rawStatus?: ClickUpStatus): "todo" | "in_progress" | "completed" {
  const statusText: string = (rawStatus?.status ?? "").toLowerCase();
  const typeText: string = (rawStatus?.type ?? "").toLowerCase();
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
  const millis: number = Number(value);
  if (!Number.isFinite(millis)) {
    return null;
  }
  return new Date(millis).toISOString();
}

function toVectorLiteral(values: number[]): string {
  return `[${values.map((v: number) => (Number.isFinite(v) ? v : 0)).join(",")}]`;
}

function chunkText(text: string, chunkSize: number = 800): string[] {
  const chunks: string[] = [];
  let start: number = 0;
  while (start < text.length) {
    chunks.push(text.slice(start, start + chunkSize));
    start += chunkSize;
  }
  return chunks;
}

function formatUser(person: { id?: string | number; username?: string | null; email?: string | null }): string {
  const username: string | null = person.username ?? null;
  const email: string | null = person.email ?? null;
  if (username && email) {
    return `${username} <${email}>`;
  }
  if (email) {
    return email;
  }
  if (username) {
    return username;
  }
  return String(person.id ?? "unknown");
}

function buildEmbeddingContent(input: {
  task: ClickUpTask;
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
  const assignees: string[] = Array.isArray(input.task.assignees) ? input.task.assignees.map(formatUser) : [];
  const watchers: string[] = Array.isArray(input.task.watchers) ? input.task.watchers.map(formatUser) : [];

  const lines: string[] = [
    `Task ID: ${input.task.id}`,
    `Task Name: ${input.task.name ?? "ClickUp Task"}`,
    input.task.text_content ? `Text Content: ${input.task.text_content}` : "",
    input.task.description ? `Description: ${input.task.description}` : "",
    `Status (Normalized): ${input.normalizedStatus}`,
    input.task.status?.status ? `Status (ClickUp): ${input.task.status.status}` : "",
    input.task.status?.type ? `Status Type (ClickUp): ${input.task.status.type}` : "",
    input.dueIso ? `Due Date: ${input.dueIso}` : "",
    input.startIso ? `Start Date: ${input.startIso}` : "",
    input.createdIso ? `Created At: ${input.createdIso}` : "",
    input.updatedIso ? `Updated At: ${input.updatedIso}` : "",
    input.tags.length ? `Tags: ${input.tags.join(", ")}` : "",
    input.points != null ? `Points: ${input.points}` : "",
    input.timeEstimateMs != null ? `Time Estimate (ms): ${input.timeEstimateMs}` : "",
    input.timeSpentMs != null ? `Time Spent (ms): ${input.timeSpentMs}` : "",
    assignees.length ? `Assignees: ${assignees.join(", ")}` : "",
    watchers.length ? `Watchers: ${watchers.join(", ")}` : "",
    input.task.list?.name ? `List: ${input.task.list.name}` : "",
    input.task.project?.name ? `Project: ${input.task.project.name}` : "",
    input.task.folder?.name ? `Folder: ${input.task.folder.name}` : "",
    input.task.space?.id ? `Space ID: ${input.task.space.id}` : "",
    input.task.team_id != null ? `Team ID: ${String(input.task.team_id)}` : "",
    input.task.url ? `Task URL: ${input.task.url}` : "",
    Array.isArray(input.task.attachments) ? `Attachments: ${JSON.stringify(input.task.attachments)}` : "",
    Array.isArray(input.task.custom_fields) ? `Custom Fields: ${JSON.stringify(input.task.custom_fields)}` : "",
    Array.isArray(input.task.checklists) ? `Checklists Count: ${input.task.checklists.length}` : "",
    Array.isArray(input.task.dependencies) ? `Dependencies Count: ${input.task.dependencies.length}` : "",
    Array.isArray(input.task.linked_tasks) ? `Linked Tasks Count: ${input.task.linked_tasks.length}` : "",
    Array.isArray(input.task.locations) ? `Locations: ${JSON.stringify(input.task.locations)}` : "",
    `Has Parent: ${Boolean(input.task.parent)}`,
    `Raw Task Payload: ${JSON.stringify(input.task)}`,
  ];

  return lines.filter((line: string) => line.length > 0).join("\n");
}

async function embedChunkWithOpenAI(_apiKeyUnused: string, content: string): Promise<number[]> {
  const { data, error } = await supabase.functions.invoke("openai-embeddings-proxy", {
    body: {
      input: content,
      model: "text-embedding-3-small",
    },
  });

  if (error) {
    throw new Error(`OpenAI embeddings failed: ${error.message}`);
  }

  const embedding: number[] | undefined = data?.data?.[0]?.embedding;
  if (!Array.isArray(embedding)) {
    throw new Error("OpenAI embeddings response missing vector");
  }
  return embedding;
}

async function upsertTaskEmbeddingsLocal(input: {
  userId: string;
  taskId: string;
  content: string;
  metadata: Record<string, unknown>;
  openAiApiKey: string;
}): Promise<number[][]> {
  let allVectors: number[][] = [];
  const deleteResp = await supabase
    .from("embeddings")
    .delete()
    .eq("entity_type", "task")
    .eq("entity_id", input.taskId)
    .eq("user_id", input.userId);
  if (deleteResp.error) {
    throw new Error(`Failed deleting prior embeddings: ${deleteResp.error.message}`);
  }
  const chunks: string[] = chunkText(input.content, 800);
  for (let index: number = 0; index < chunks.length; index += 1) {
    const chunk: string = chunks[index];
    const vector: number[] = await embedChunkWithOpenAI(input.openAiApiKey, chunk);
    allVectors.push(vector);
    const insertResp = await supabase.from("embeddings").insert({
      entity_type: "task",
      entity_id: input.taskId,
      user_id: input.userId,
      content: chunk,
      chunk_index: index,
      metadata: input.metadata as Json,
      embedding: toVectorLiteral(vector),
      created_at: new Date().toISOString(),
    });
    if (insertResp.error) {
      throw new Error(`Failed inserting embeddings: ${insertResp.error.message}`);
    }
  }
  return allVectors;
}

function extractStringValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    const trimmed: string = value.trim();
    const cleaned: string = trimmed.replace(/^"+|"+$/g, "").trim();
    if (cleaned.length > 0 && !cleaned.includes("•") && !cleaned.includes("***")) {
      return cleaned;
    }
    try {
      const parsed: unknown = JSON.parse(trimmed);
      return extractStringValue(parsed);
    } catch {
      return null;
    }
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const nestedCandidates: unknown[] = [
      record.apiKey,
      record.api_key,
      record.openaiApiKey,
      record.openai_api_key,
      record.OPENAI_API_KEY,
      record.value,
    ];
    for (const nested of nestedCandidates) {
      if (typeof nested === "string" && nested.trim().length > 0) {
        const cleaned: string = nested.trim();
        if (!cleaned.includes("•") && !cleaned.includes("***")) {
          return cleaned;
        }
      }
    }
  }
  return null;
}

async function getOpenAiApiKeyFromDb(): Promise<string | null> {
  // const appConfigCandidates: string[] = [
  //   "ai.openai_api_key",
  //   "ai.openaiApiKey",
  //   "openai.api_key",
  //   "openai_api_key",
  //   "OPENAI_API_KEY",
  // ];

  // const appConfigResp = await supabase
  //   .from("app_config")
  //   .select("key, value")
  //   .in("key", appConfigCandidates);

  // if (!appConfigResp.error && Array.isArray(appConfigResp.data)) {
  //   for (const row of appConfigResp.data as DbKeyRow[]) {
  //     const keyValue: string | null = extractStringValue(row.value);
  //     if (keyValue && keyValue.startsWith("sk-")) {
  //       return keyValue;
  //     }
  //   }
  // }

  // const appConfigWideResp = await supabase
  //   .from("app_config")
  //   .select("key, value")
  //   .eq("category", "ai")
  //   .ilike("key", "%openai%");

  // if (!appConfigWideResp.error && Array.isArray(appConfigWideResp.data)) {
  //   for (const row of appConfigWideResp.data as DbKeyRow[]) {
  //     const keyValue: string | null = extractStringValue(row.value);
  //     if (keyValue && keyValue.startsWith("sk-")) {
  //       return keyValue;
  //     }
  //   }
  // }

  // const systemSettingsResp = await supabase
  //   .from("system_settings")
  //   .select("key, value")
  //   .eq("category", "ai")
  //   .in("key", ["openai_api_key", "openaiApiKey", "OPENAI_API_KEY"]);

  // if (!systemSettingsResp.error && Array.isArray(systemSettingsResp.data)) {
  //   for (const row of systemSettingsResp.data as DbKeyRow[]) {
  //     const keyValue: string | null = extractStringValue(row.value);
  //     if (keyValue && keyValue.startsWith("sk-")) {
  //       return keyValue;
  //     }
  //   }
  // }

  // const systemSettingsWideResp = await supabase
  //   .from("system_settings")
  //   .select("key, value")
  //   .eq("category", "ai")
  //   .ilike("key", "%openai%");

  // if (!systemSettingsWideResp.error && Array.isArray(systemSettingsWideResp.data)) {
  //   for (const row of systemSettingsWideResp.data as DbKeyRow[]) {
  //     const keyValue: string | null = extractStringValue(row.value);
  //     if (keyValue && keyValue.startsWith("sk-")) {
  //       return keyValue;
  //     }
  //   }
  // }

  const fallbackEnvKey: string | undefined = import.meta.env.VITE_OPENAI_API_KEY;
  return typeof fallbackEnvKey === "string" && fallbackEnvKey.length > 0 ? fallbackEnvKey : null;
}

async function clickupApiFetch(path: string, method: string = "GET"): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke("clickup-api-proxy", {
    body: { path, method },
  });
  if (error) {
    throw new Error(`ClickUp API error (${path}): ${error.message}`);
  }
  return data;
}

export async function syncClickupLocal(): Promise<LocalClickupSyncResult> {
  const startedAt: number = Date.now();
  const errors: string[] = [];
  let projectsCreated: number = 0;
  let projectsUpdated: number = 0;
  let tasksCreated: number = 0;
  let tasksUpdated: number = 0;
  let taskEmbeddingsInserted: number = 0;
  let taskEmbeddingsFailed: number = 0;

  const openAiApiKey: string | null = await getOpenAiApiKeyFromDb();

  const authResult = await supabase.auth.getUser();
  const userId: string | undefined = authResult.data.user?.id;
  if (!userId) {
    throw new Error("User not authenticated");
  }

  const tokenResult = await supabase
    .from("user_oauth_tokens")
    .select("id, access_token, metadata")
    .eq("user_id", userId)
    .eq("provider_slug", "clickup")
    .maybeSingle();

  if (tokenResult.error || !tokenResult.data?.access_token) {
    throw new Error(tokenResult.error?.message ?? "No ClickUp connection found");
  }

  const defaultStatusResp = await supabase
    .from("project_statuses")
    .select("id")
    .eq("is_default", true)
    .maybeSingle();
  const defaultStatusId: string | null = defaultStatusResp.data?.id ?? null;

  const teamsJson = (await clickupApiFetch("team")) as { teams?: ClickUpTeam[] };
  const teams: ClickUpTeam[] = teamsJson.teams ?? [];
  if (teams.length === 0) {
    return {
      success: true,
      projects_synced: 0,
      projects_created: 0,
      projects_updated: 0,
      tasks_synced: 0,
      duration_ms: Date.now() - startedAt,
      errors: [],
    };
  }

  const primaryTeam: ClickUpTeam = teams[0];
  const spacesJson = (await clickupApiFetch(`team/${primaryTeam.id}/space?archived=false`)) as { spaces?: ClickUpSpace[] };
  const spaces: ClickUpSpace[] = spacesJson.spaces ?? [];

  for (const space of spaces) {
    const externalProjectId: string = String(space.id);
    const slug: string = slugFromNameAndId(space.name, externalProjectId);
    const nowIso: string = new Date().toISOString();

    const existingProject = await supabase
      .from("projects")
      .select("id")
      .eq("external_provider", "clickup")
      .eq("external_id", externalProjectId)
      .maybeSingle();

    const projectRow: Database["public"]["Tables"]["projects"]["Update"] = {
      name: space.name,
      slug,
      description: null,
      external_provider: "clickup",
      external_id: externalProjectId,
      metadata: { source: "clickup", team_id: primaryTeam.id } as Json,
      status_id: defaultStatusId,
      is_archived: false,
      owner_id: userId,
      updated_at: nowIso,
    };

    if (existingProject.data?.id) {
      const updatedProject = await supabase.from("projects").update(projectRow).eq("id", existingProject.data.id);
      if (updatedProject.error) {
        errors.push(`Update project ${space.name}: ${updatedProject.error.message}`);
      } else {
        projectsUpdated += 1;
      }
    } else {
      const insertedProject = await supabase.from("projects").insert({
        ...projectRow,
        created_at: nowIso,
        created_by: userId,
      } as Database["public"]["Tables"]["projects"]["Insert"]);
      if (insertedProject.error) {
        errors.push(`Insert project ${space.name}: ${insertedProject.error.message}`);
      } else {
        projectsCreated += 1;
      }
    }

    let listsJson: { lists?: ClickUpList[] };
    try {
      listsJson = (await clickupApiFetch(`space/${space.id}/list?archived=false`)) as { lists?: ClickUpList[] };
    } catch (err) {
      errors.push(`ClickUp /space/${space.id}/list error: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }
    const lists: ClickUpList[] = listsJson.lists ?? [];

    for (const list of lists) {
      let tasksJson: { tasks?: ClickUpTask[] };
      try {
        tasksJson = (await clickupApiFetch(`list/${list.id}/task?archived=false&subtasks=false`)) as { tasks?: ClickUpTask[] };
      } catch (err) {
        errors.push(`ClickUp /list/${list.id}/task error: ${err instanceof Error ? err.message : String(err)}`);
        continue;
      }

      const tasks: ClickUpTask[] = tasksJson.tasks ?? [];
      console.log("tasks:", tasks);

      for (const task of tasks) {
        const externalTaskId: string = String(task.id);
        let detailedTask: ClickUpTask = task;
        try {
          detailedTask = (await clickupApiFetch(`task/${externalTaskId}`)) as ClickUpTask;
        } catch {
          // best effort — use list-level task data
        }

        console.log("detailedTask:", detailedTask);

        const status = mapTaskStatus(detailedTask.status);
        const dueIso: string | null = toIsoOrNull(detailedTask.due_date);
        const startIso: string | null = toIsoOrNull(detailedTask.start_date);
        const createdIso: string | null = toIsoOrNull(detailedTask.date_created);
        const updatedIso: string | null = toIsoOrNull(detailedTask.date_updated);
        const timeEstimateMs: number | null =
          detailedTask.time_estimate != null && detailedTask.time_estimate !== ""
            ? Number(detailedTask.time_estimate) || null
            : null;
        const timeSpentMs: number | null =
          detailedTask.time_spent != null && detailedTask.time_spent !== ""
            ? Number(detailedTask.time_spent) || null
            : null;
        const tags: string[] = Array.isArray(detailedTask.tags)
          ? detailedTask.tags
              .map((tag: ClickUpTag) => tag.name)
              .filter((name: string | undefined): name is string => typeof name === "string" && name.length > 0)
          : [];
        const points: number | null = typeof detailedTask.points === "number" ? detailedTask.points : null;

        const clickupDetails: Json = {
          timeEstimateMs,
          timeSpentMs,
          tags,
          sprintPoints: points,
          checklistsCount: Array.isArray(detailedTask.checklists) ? detailedTask.checklists.length : 0,
          hasParent: Boolean(detailedTask.parent),
          url: detailedTask.url ?? null,
          raw: asJson(detailedTask),
        };

        const taskRow: Database["public"]["Tables"]["tasks"]["Update"] = {
          title: detailedTask.name ?? task.name ?? "ClickUp Task",
          description: detailedTask.description ?? detailedTask.text_content ?? null,
          status,
          priority: "medium",
          assigned_to: null,
          meeting_id: null,
          client_id: null,
          due_date: dueIso,
          metadata: {
            source: "clickup",
            external_id: externalTaskId,
            project_external_id: externalProjectId,
            synced: true,
            clickup: clickupDetails,
          } as Json,
          updated_at: new Date().toISOString(),
        };

        const existingTask = await supabase
          .from("tasks")
          .select("id")
          .eq("created_by", userId)
          .contains("metadata", { source: "clickup", external_id: externalTaskId })
          .maybeSingle();

        let taskIdForEmbedding: string | null = null;
        if (existingTask.data?.id) {
          const updatedTask = await supabase.from("tasks").update(taskRow).eq("id", existingTask.data.id);
          if (updatedTask.error) {
            errors.push(`Update task ${externalTaskId}: ${updatedTask.error.message}`);
            continue;
          }
          tasksUpdated += 1;
          taskIdForEmbedding = existingTask.data.id;
        } else {
          const insertedTask = await supabase
            .from("tasks")
            .insert({
              ...taskRow,
              created_at: new Date().toISOString(),
              created_by: userId,
            } as Database["public"]["Tables"]["tasks"]["Insert"])
            .select("id")
            .maybeSingle();
          if (insertedTask.error || !insertedTask.data?.id) {
            errors.push(`Insert task ${externalTaskId}: ${insertedTask.error?.message ?? "Missing inserted id"}`);
            continue;
          }
          tasksCreated += 1;
          taskIdForEmbedding = insertedTask.data.id;
        }
        console.log("taskIdForEmbedding:", taskIdForEmbedding);
        console.log("openAiApiKey:", openAiApiKey);

        if (openAiApiKey && taskIdForEmbedding) {
          console.log("building embedding content");
          const embeddingContent: string = buildEmbeddingContent({
            task: detailedTask,
            normalizedStatus: status,
            dueIso,
            startIso,
            createdIso,
            updatedIso,
            tags,
            points,
            timeEstimateMs,
            timeSpentMs,
          });
          console.log("embeddingContent:", embeddingContent);
          try {
            const embeddingResult = await upsertTaskEmbeddingsLocal({
              userId,
              taskId: taskIdForEmbedding,
              content: embeddingContent,
              metadata: (taskRow.metadata ?? {}) as Record<string, unknown>,
              openAiApiKey,
            });
            console.log("embeddingResult:", embeddingResult);
            taskEmbeddingsInserted += 1;
          } catch (error: unknown) {
            taskEmbeddingsFailed += 1;
            errors.push(
              `Embed task ${externalTaskId}: ${error instanceof Error ? error.message : "Unknown embedding error"}`,
            );
          }
        }
      }
    }
  }

  const projectsSynced: number = projectsCreated + projectsUpdated;
  const tasksSynced: number = tasksCreated + tasksUpdated;
  const metadataUpdate = {
    ...(tokenResult.data.metadata && typeof tokenResult.data.metadata === "object" ? tokenResult.data.metadata : {}),
    last_sync_at: new Date().toISOString(),
    last_sync_status: errors.length === 0 ? "success" : "partial",
    last_sync_error: errors.length > 0 ? errors[0] : null,
    projects_synced: projectsSynced,
    tasks_synced: tasksSynced,
  };
  await supabase.from("user_oauth_tokens").update({ metadata: metadataUpdate }).eq("id", tokenResult.data.id);

  return {
    success: errors.length === 0 && taskEmbeddingsFailed === 0,
    projects_synced: projectsSynced,
    projects_created: projectsCreated,
    projects_updated: projectsUpdated,
    tasks_synced: tasksSynced,
    duration_ms: Date.now() - startedAt,
    errors: [
      ...errors,
      `Embedding summary: tasks_embedded=${taskEmbeddingsInserted}, embedding_failures=${taskEmbeddingsFailed}`,
      openAiApiKey ? "" : "Embedding skipped: OpenAI API key not found in database config.",
    ].filter((line: string) => line.length > 0),
  };
}
