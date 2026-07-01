import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ActiveCollabProject {
  id: number;
  name: string;
  body?: string;
  created_on?: string | number;
  completed_on?: string | number;
  budget?: number;
}

interface ActiveCollabTask {
  id: number;
  name?: string;
  body?: string;
  due_on?: string | number;
  is_completed?: boolean;
  assignee_id?: number | null;
  attachments?: ActiveCollabAttachment[];
}

interface ActiveCollabAttachment {
  id?: number | string;
  name?: string;
  size?: number | string;
  mime_type?: string;
  download_url?: string;
  url?: string;
}

interface SyncResponse {
  success: boolean;
  projects_synced: number;
  projects_created: number;
  projects_updated: number;
  tasks_synced: number;
  duration_ms: number;
  errors: string[];
  queued?: boolean;
  message?: string;
}

interface TokenRow {
  id: string;
  access_token: string;
  metadata: Record<string, unknown> | null;
  account_email?: string | null;
}

interface SyncCounters {
  projectsCreated: number;
  projectsUpdated: number;
  tasksCreated: number;
  tasksUpdated: number;
  embeddingsInserted: number;
  embeddingsFailed: number;
  errors: string[];
}

interface BackgroundSyncContext {
  supabaseUrl: string;
  supabaseServiceKey: string;
  userId: string;
  tokenRow: TokenRow;
}

type SupabaseClient = any;

function fromTable(supabase: SupabaseClient, table: string): any {
  return (supabase as any).from(table);
}

function slugFromNameAndId(name: string, externalId: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${base}-${externalId}`.slice(0, 100);
}

function parseDate(value: string | number | null | undefined): Date | null {
  if (value == null || value === "") return null;

  let date: Date;

  if (typeof value === "number") {
    date = new Date(value < 1e12 ? value * 1000 : value);
  } else {
    const numeric = Number(value);
    if (!Number.isNaN(numeric) && /^\d+$/.test(value.trim())) {
      date = new Date(numeric < 1e12 ? numeric * 1000 : numeric);
    } else {
      date = new Date(value);
    }
  }

  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function toIsoOrNull(value: string | number | null | undefined): string | null {
  const date = parseDate(value);
  return date ? date.toISOString() : null;
}

/** Returns YYYY-MM-DD for PostgreSQL `date` columns */
function toDateStringOrNull(value: string | number | null | undefined): string | null {
  const date = parseDate(value);
  if (!date) return null;
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

interface OpenAIEmbeddingResponse {
  data: Array<{
    embedding: number[];
  }>;
}

async function embedTextOpenAI(args: {
  openAiApiKey: string;
  input: string;
}): Promise<number[]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
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

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI embeddings failed: ${response.status} - ${body.slice(0, 300)}`);
  }

  const json = (await response.json()) as OpenAIEmbeddingResponse;
  const embedding = json.data?.[0]?.embedding;
  if (!Array.isArray(embedding)) {
    throw new Error("OpenAI embeddings response missing embedding vector");
  }
  return embedding;
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

function buildTaskEmbeddingContent(task: ActiveCollabTask, projectExternalId: string, userNameMap?: Map<number, string>): string {
  const assigneeLabel = task.assignee_id != null
    ? `Assignee: ${userNameMap?.get(task.assignee_id) ?? `User ${task.assignee_id}`}`
    : "";
  const attachmentSummary = Array.isArray(task.attachments) && task.attachments.length > 0
    ? `Attachments: ${JSON.stringify(task.attachments)}`
    : "";
  const sections: string[] = [
    `Task ID: ${String(task.id)}`,
    `Task Name: ${task.name ?? "ActiveCollab Task"}`,
    task.body ? `Description: ${task.body}` : "",
    `Status: ${task.is_completed ? "completed" : "todo"}`,
    task.due_on ? `Due Date: ${toIsoOrNull(task.due_on)}` : "",
    assigneeLabel,
    attachmentSummary,
    `Project External ID: ${projectExternalId}`,
    `Source: activecollab`,
    `Raw Task Payload: ${JSON.stringify(task)}`,
  ];
  return sections.filter((line) => line !== "").join("\n");
}

function parseActiveCollabAttachments(payload: unknown): ActiveCollabAttachment[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }
  const record = payload as Record<string, unknown>;
  const candidates: unknown[] = [];

  if (Array.isArray(record.attachments)) {
    candidates.push(...record.attachments);
  }
  if (Array.isArray(record.files)) {
    candidates.push(...record.files);
  }
  if (record.single && typeof record.single === "object") {
    const single = record.single as Record<string, unknown>;
    if (Array.isArray(single.attachments)) {
      candidates.push(...single.attachments);
    }
    if (Array.isArray(single.files)) {
      candidates.push(...single.files);
    }
  }

  return candidates
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => ({
      id: typeof item.id === "number" || typeof item.id === "string" ? item.id : undefined,
      name: typeof item.name === "string"
        ? item.name
        : (typeof item.filename === "string" ? item.filename : undefined),
      size: typeof item.size === "number" || typeof item.size === "string" ? item.size : undefined,
      mime_type: typeof item.mime_type === "string"
        ? item.mime_type
        : (typeof item.type === "string" ? item.type : undefined),
      download_url: typeof item.download_url === "string"
        ? item.download_url
        : (typeof item.url === "string" ? item.url : undefined),
      url: typeof item.url === "string" ? item.url : undefined,
    }))
    .filter((a) => !!a.download_url || !!a.url || !!a.name);
}

async function upsertTaskEmbeddings(args: {
  supabase: SupabaseClient;
  userId: string;
  taskId: string;
  content: string;
  metadata: Record<string, unknown>;
  openAiApiKey: string;
  retries?: number;
}): Promise<void> {
  const { supabase, userId, taskId, content, metadata, openAiApiKey, retries = 2 } = args;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const { error: deleteError } = await fromTable(supabase, "embeddings")
        .delete()
        .eq("entity_type", "task")
        .eq("entity_id", taskId)
        .eq("user_id", userId);

      if (deleteError) {
        throw new Error(`Failed deleting prior embeddings: ${deleteError.message}`);
      }

      const chunks = chunkText(content, 800);
      const rows: Array<Record<string, unknown>> = [];

      for (let i = 0; i < chunks.length; i += 1) {
        const chunk = chunks[i];
        const embedding = await embedTextOpenAI({
          openAiApiKey,
          input: chunk,
        });
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
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      if (rows.length > 0) {
        const { error: insertError } = await fromTable(supabase, "embeddings").insert(rows);
        if (insertError) {
          throw new Error(`Failed inserting embeddings: ${insertError.message}`);
        }
      }

      // Success — exit retry loop
      return;
    } catch (error) {
      if (attempt < retries) {
        console.warn(`Embedding attempt ${attempt + 1} failed for task ${taskId}, retrying...`, getErrorMessage(error));
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      } else {
        throw error;
      }
    }
  }
}

function createSyncResponse(startedAt: number, overrides: Partial<SyncResponse> = {}): SyncResponse {
  return {
    success: false,
    projects_synced: 0,
    projects_created: 0,
    projects_updated: 0,
    tasks_synced: 0,
    duration_ms: Date.now() - startedAt,
    errors: [],
    ...overrides,
  };
}

function jsonResponse(startedAt: number, overrides: Partial<SyncResponse>, status = 200): Response {
  return new Response(JSON.stringify(createSyncResponse(startedAt, overrides)), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function getActiveCollabBaseUrl(metadata: Record<string, unknown> | null): string {
  const baseUrl = metadata?.activecollab_base_url;

  if (typeof baseUrl !== "string" || baseUrl.trim().length === 0) {
    throw new Error(
      "ActiveCollab Base URL missing on your connection. Disconnect and connect again with your instance URL.",
    );
  }

  return baseUrl.replace(/\/+$/, "");
}

async function fetchJsonWithTimeout(url: string, headers: HeadersInit, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`ActiveCollab API error: ${response.status} - ${text.slice(0, 200)}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request to ${url} timed out after ${timeoutMs}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseProjects(payload: unknown): ActiveCollabProject[] {
  if (Array.isArray(payload)) {
    return payload as ActiveCollabProject[];
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const record = payload as Record<string, unknown>;

  if (Array.isArray(record.projects)) {
    return record.projects as ActiveCollabProject[];
  }

  if (Array.isArray(record.data)) {
    return record.data as ActiveCollabProject[];
  }

  return [];
}

function parseTasks(payload: unknown): ActiveCollabTask[] {
  if (Array.isArray(payload)) {
    return payload as ActiveCollabTask[];
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const record = payload as Record<string, unknown>;

  if (Array.isArray(record.tasks)) {
    return record.tasks as ActiveCollabTask[];
  }

  if (Array.isArray(record.data)) {
    return record.data as ActiveCollabTask[];
  }

  return [];
}

interface ActiveCollabUser {
  id?: number;
  email?: string;
  display_name?: string;
  first_name?: string;
  last_name?: string;
}

function parseUsers(payload: unknown): ActiveCollabUser[] {
  if (Array.isArray(payload)) {
    return payload as ActiveCollabUser[];
  }
  if (!payload || typeof payload !== "object") {
    return [];
  }
  const record = payload as Record<string, unknown>;
  if (Array.isArray(record.users)) {
    return record.users as ActiveCollabUser[];
  }
  if (Array.isArray(record.data)) {
    return record.data as ActiveCollabUser[];
  }
  if (record.single && typeof record.single === "object") {
    return [record.single as ActiveCollabUser];
  }
  return [];
}

function buildUserNameMap(users: ActiveCollabUser[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const u of users) {
    if (typeof u.id !== "number") continue;
    const name =
      u.display_name ||
      [u.first_name, u.last_name].filter(Boolean).join(" ").trim() ||
      u.email ||
      `User ${u.id}`;
    map.set(u.id, name);
  }
  return map;
}

async function runWithConcurrency<T, TResult>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<TResult>,
): Promise<TResult[]> {
  if (items.length === 0) {
    return [];
  }

  const results = new Array<TResult>(items.length);
  let nextIndex = 0;

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(runners);
  return results;
}

async function updateTokenMetadata(
  supabase: SupabaseClient,
  tokenRow: TokenRow,
  patch: Record<string, unknown>,
): Promise<void> {
  const nextMetadata = {
    ...(tokenRow.metadata ?? {}),
    ...patch,
  };

  const { error } = await fromTable(supabase, "user_oauth_tokens")
    .update({ metadata: nextMetadata })
    .eq("id", tokenRow.id);

  if (error) {
    console.error("Failed updating ActiveCollab token metadata:", error);
    return;
  }

  tokenRow.metadata = nextMetadata;
}

async function insertUsageLog(args: {
  supabase: SupabaseClient;
  providerId: string | null;
  userId: string;
  status: "success" | "error" | "partial";
  errorMessage: string | null;
  responseMetadata: Record<string, unknown>;
}): Promise<void> {
  const { error } = await fromTable(args.supabase, "integration_usage_logs").insert({
    organization_id: null,
    provider_id: args.providerId,
    service_id: null,
    user_id: args.userId,
    action: "sync-activecollab",
    status: args.status,
    request_metadata: { triggered_from: "edge_function", mode: "background" } as Record<string, unknown>,
    response_metadata: args.responseMetadata,
    error_message: args.errorMessage,
    estimated_cost: 0,
  });

  if (error) {
    console.error("Failed inserting ActiveCollab usage log:", error);
  }
}

function combineCounters(results: SyncCounters[]): SyncCounters {
  return results.reduce<SyncCounters>(
    (acc, result) => ({
      projectsCreated: acc.projectsCreated + result.projectsCreated,
      projectsUpdated: acc.projectsUpdated + result.projectsUpdated,
      tasksCreated: acc.tasksCreated + result.tasksCreated,
      tasksUpdated: acc.tasksUpdated + result.tasksUpdated,
      embeddingsInserted: acc.embeddingsInserted + result.embeddingsInserted,
      embeddingsFailed: acc.embeddingsFailed + result.embeddingsFailed,
      errors: [...acc.errors, ...result.errors],
    }),
    {
      projectsCreated: 0,
      projectsUpdated: 0,
      tasksCreated: 0,
      tasksUpdated: 0,
      embeddingsInserted: 0,
      embeddingsFailed: 0,
      errors: [],
    },
  );
}

async function syncTask(args: {
  supabase: SupabaseClient;
  userId: string;
  projectDbId: string | null;
  projectExternalId: string;
  task: ActiveCollabTask;
  openAiApiKey: string;
  userNameMap?: Map<number, string>;
  apiUrl: string;
  apiHeaders: HeadersInit;
}): Promise<SyncCounters> {
  const { supabase, userId, projectDbId, projectExternalId, task, openAiApiKey, userNameMap, apiUrl, apiHeaders } = args;
  const externalTaskId = String(task.id);
  let taskWithDetails: ActiveCollabTask = task;

  try {
    const detailPayload = await fetchJsonWithTimeout(
      `${apiUrl}/api/v1/projects/${projectExternalId}/tasks/${externalTaskId}`,
      apiHeaders,
      10000,
    );
    const detailRecord = detailPayload && typeof detailPayload === "object"
      ? (detailPayload as Record<string, unknown>)
      : null;
    const maybeSingle = detailRecord?.single;
    if (maybeSingle && typeof maybeSingle === "object") {
      taskWithDetails = {
        ...task,
        ...(maybeSingle as ActiveCollabTask),
      };
    }
    const normalizedAttachments = parseActiveCollabAttachments(detailPayload);
    if (normalizedAttachments.length > 0) {
      taskWithDetails.attachments = normalizedAttachments;
    }
  } catch (_detailError) {
    // Keep list payload if per-task detail endpoint is unavailable
  }

  const normalizedAttachments = Array.isArray(taskWithDetails.attachments) ? taskWithDetails.attachments : [];
  const assigneeName = task.assignee_id != null ? (userNameMap?.get(task.assignee_id) ?? null) : null;
  const taskMetadata = {
    source: "activecollab",
    external_id: externalTaskId,
    project_external_id: projectExternalId,
    synced: true,
    assignee_name: assigneeName,
    attachments: normalizedAttachments,
    activecollab: { raw: taskWithDetails, attachments: normalizedAttachments },
  } as Record<string, unknown>;

  try {
    const { data: existingTask, error: existingTaskError } = await fromTable(supabase, "tasks")
      .select("id")
      .eq("created_by", userId)
      .contains("metadata", { source: "activecollab", external_id: externalTaskId })
      .maybeSingle();

    if (existingTaskError) {
      throw new Error(existingTaskError.message);
    }

    const taskRow = {
      title: task.name ?? "ActiveCollab Task",
      description: taskWithDetails.body ?? task.body ?? null,
      status: taskWithDetails.is_completed ? "completed" : "todo",
      priority: "medium",
      due_date: toIsoOrNull(taskWithDetails.due_on ?? task.due_on),
      project_id: projectDbId,
      metadata: taskMetadata,
      updated_at: new Date().toISOString(),
    };

    let taskDbId: string | null = null;
    let tasksCreated = 0;
    let tasksUpdated = 0;
    let embeddingsInserted = 0;
    let embeddingsFailed = 0;
    const taskEmbeddingContent = buildTaskEmbeddingContent(taskWithDetails, projectExternalId, userNameMap);

    if (existingTask?.id) {
      const { error: updateError } = await fromTable(supabase, "tasks").update(taskRow).eq("id", existingTask.id);
      if (updateError) {
        throw new Error(updateError.message);
      }

      taskDbId = existingTask.id;
      tasksUpdated = 1;
    } else {
      const { data: insertedTask, error: insertError } = await fromTable(supabase, "tasks")
        .insert({
          ...taskRow,
          created_at: new Date().toISOString(),
          created_by: userId,
        })
        .select("id")
        .maybeSingle();

      if (insertError) {
        throw new Error(insertError.message);
      }

      taskDbId = insertedTask?.id ?? null;
      tasksCreated = 1;
    }

    if (taskDbId) {
      try {
        await upsertTaskEmbeddings({
          supabase,
          userId,
          taskId: taskDbId,
          content: taskEmbeddingContent,
          metadata: taskMetadata,
          openAiApiKey,
        });
        embeddingsInserted = 1;
      } catch (embeddingError) {
        embeddingsFailed = 1;
        const message = getErrorMessage(embeddingError);
        return {
          projectsCreated: 0,
          projectsUpdated: 0,
          tasksCreated,
          tasksUpdated,
          embeddingsInserted,
          embeddingsFailed,
          errors: [`Task ${externalTaskId} embedding: ${message}`],
        };
      }
    }

    return {
      projectsCreated: 0,
      projectsUpdated: 0,
      tasksCreated,
      tasksUpdated,
      embeddingsInserted,
      embeddingsFailed,
      errors: [],
    };
  } catch (error) {
    return {
      projectsCreated: 0,
      projectsUpdated: 0,
      tasksCreated: 0,
      tasksUpdated: 0,
      embeddingsInserted: 0,
      embeddingsFailed: 0,
      errors: [`Task ${externalTaskId}: ${getErrorMessage(error)}`],
    };
  }
}

async function syncProject(args: {
  supabase: SupabaseClient;
  userId: string;
  apiUrl: string;
  apiHeaders: HeadersInit;
  defaultStatusId: string | null;
  activeCollabUserId: number | null;
  project: ActiveCollabProject;
  openAiApiKey: string;
  userNameMap?: Map<number, string>;
}): Promise<SyncCounters> {
  const { supabase, userId, apiUrl, apiHeaders, defaultStatusId, activeCollabUserId, project, openAiApiKey, userNameMap } = args;
  const externalId = String(project.id);
  const slug = slugFromNameAndId(project.name, externalId);

  try {
    const { data: existingProject, error: existingProjectError } = await fromTable(supabase, "projects")
      .select("id")
      .eq("external_provider", "activecollab")
      .eq("external_id", externalId)
      .maybeSingle();

    if (existingProjectError) {
      throw new Error(existingProjectError.message);
    }

    const row = {
      name: project.name,
      slug,
      description: project.body ?? null,
      start_date: toDateStringOrNull(project.created_on),
      end_date: toDateStringOrNull(project.completed_on),
      budget: project.budget ?? null,
      external_provider: "activecollab",
      external_id: externalId,
      metadata: { source: "activecollab", external_id: externalId } as Record<string, unknown>,
      status_id: defaultStatusId,
      owner_id: userId,
      is_archived: false,
      updated_at: new Date().toISOString(),
    };

    let projectDbId: string | null = null;
    let projectsCreated = 0;
    let projectsUpdated = 0;

    if (existingProject?.id) {
      const { data: updatedProject, error: updateError } = await fromTable(supabase, "projects")
        .update(row)
        .eq("id", existingProject.id)
        .select("id")
        .maybeSingle();

      if (updateError) {
        throw new Error(updateError.message);
      }

      projectDbId = updatedProject?.id ?? existingProject.id;
      projectsUpdated = 1;
    } else {
      const { data: insertedProject, error: insertError } = await fromTable(supabase, "projects")
        .insert({
          ...row,
          created_at: new Date().toISOString(),
          created_by: userId,
        })
        .select("id")
        .maybeSingle();

      if (insertError) {
        throw new Error(insertError.message);
      }

      projectDbId = insertedProject?.id ?? null;
      projectsCreated = 1;
    }

    const taskPayload = await fetchJsonWithTimeout(`${apiUrl}/api/v1/projects/${externalId}/tasks`, apiHeaders, 10000);
    const projectTasks = parseTasks(taskPayload);
    const filteredTasks =
      activeCollabUserId == null
        ? projectTasks
        : projectTasks.filter((task) => task.assignee_id === activeCollabUserId);

    const taskResults = await runWithConcurrency(filteredTasks, 5, (task) =>
      syncTask({
        supabase,
        userId,
        projectDbId,
        projectExternalId: externalId,
        task,
        openAiApiKey,
        userNameMap,
        apiUrl,
        apiHeaders,
      })
    );

    const taskCounters = combineCounters(taskResults);

    return {
      projectsCreated,
      projectsUpdated,
      tasksCreated: taskCounters.tasksCreated,
      tasksUpdated: taskCounters.tasksUpdated,
      embeddingsInserted: taskCounters.embeddingsInserted,
      embeddingsFailed: taskCounters.embeddingsFailed,
      errors: taskCounters.errors,
    };
  } catch (error) {
    return {
      projectsCreated: 0,
      projectsUpdated: 0,
      tasksCreated: 0,
      tasksUpdated: 0,
      embeddingsInserted: 0,
      embeddingsFailed: 0,
      errors: [`Project ${externalId}: ${getErrorMessage(error)}`],
    };
  }
}

async function performBackgroundSync(context: BackgroundSyncContext): Promise<SyncResponse> {
  const { supabaseUrl, supabaseServiceKey, userId, tokenRow } = context;
  const startedAt = Date.now();
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let providerId: string | null = null;

  try {
    const openAiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiApiKey) {
      throw new Error("OPENAI_API_KEY is not configured (required to embed synced ActiveCollab tasks)");
    }

    console.log("Starting background ActiveCollab sync", { userId, tokenId: tokenRow.id });

    await updateTokenMetadata(supabase, tokenRow, {
      last_sync_started_at: new Date().toISOString(),
      last_sync_status: "running",
      last_sync_error: null,
    });

    const { data: providerRow, error: providerError } = await fromTable(supabase, "integration_providers")
      .select("id")
      .eq("slug", "activecollab")
      .maybeSingle();

    if (providerError) {
      throw new Error(providerError.message);
    }

    providerId = providerRow?.id ?? null;

    const apiUrl = getActiveCollabBaseUrl(tokenRow.metadata);
    const apiHeaders: HeadersInit = {
      Authorization: `Bearer ${tokenRow.access_token}`,
      "X-Angie-AuthApiToken": tokenRow.access_token,
      "Content-Type": "application/json",
    };

    let activeCollabUserId: number | null = null;
    const tokenEmail =
      typeof tokenRow.account_email === "string" && tokenRow.account_email.trim().length > 0
        ? tokenRow.account_email.trim().toLowerCase()
        : null;

    try {
      const mePayload = await fetchJsonWithTimeout(`${apiUrl}/api/v1/users/me`, apiHeaders, 8000);
      if (mePayload && typeof mePayload === "object") {
        const meRecord = mePayload as Record<string, unknown>;
        const single = meRecord.single;
        const source = single && typeof single === "object" ? (single as Record<string, unknown>) : meRecord;
        if (typeof source.id === "number") {
          activeCollabUserId = source.id;
        }
      }
    } catch (_meError) {
      // Some ActiveCollab instances do not support /users/me. Fall back to /users by email.
    }

    // Fetch all AC users to build ID → display name map for embedding content
    let userNameMap = new Map<number, string>();
    let allUsers: ActiveCollabUser[] = [];

    if (activeCollabUserId == null && tokenEmail) {
      try {
        const usersPayload = await fetchJsonWithTimeout(`${apiUrl}/api/v1/users`, apiHeaders, 10000);
        allUsers = parseUsers(usersPayload);
        userNameMap = buildUserNameMap(allUsers);
        const matched = allUsers.find(
          (u) => typeof u.email === "string" && u.email.trim().toLowerCase() === tokenEmail && typeof u.id === "number",
        );
        if (matched && typeof matched.id === "number") {
          activeCollabUserId = matched.id;
        }
      } catch (_usersError) {
        // Continue without assignee filter if user lookup endpoint is unavailable.
      }
    }

    // If we already found activeCollabUserId via /me but haven't fetched the full user list yet
    if (userNameMap.size === 0) {
      try {
        const usersPayload = await fetchJsonWithTimeout(`${apiUrl}/api/v1/users`, apiHeaders, 10000);
        allUsers = parseUsers(usersPayload);
        userNameMap = buildUserNameMap(allUsers);
        console.log(`Fetched ${userNameMap.size} ActiveCollab users for name resolution`);
      } catch (_usersError) {
        console.warn("Could not fetch AC users for name resolution, will use IDs");
      }
    }

    const payload = await fetchJsonWithTimeout(`${apiUrl}/api/v1/projects`, apiHeaders, 15000);
    const projects = parseProjects(payload);

    const { data: defaultStatusRows, error: defaultStatusError } = await fromTable(supabase, "project_statuses")
      .select("id")
      .eq("is_default", true)
      .limit(1);

    const defaultStatus = Array.isArray(defaultStatusRows) ? defaultStatusRows[0] ?? null : null;

    if (defaultStatusError) {
      throw new Error(defaultStatusError.message);
    }

    const defaultStatusId = defaultStatus?.id ?? null;

    const projectResults = await runWithConcurrency(projects, 3, (project) =>
      syncProject({
        supabase,
        userId,
        apiUrl,
        apiHeaders,
        defaultStatusId,
        activeCollabUserId,
        project,
        openAiApiKey,
        userNameMap,
      })
    );

    const counters = combineCounters(projectResults);
    const projectsSynced = counters.projectsCreated + counters.projectsUpdated;
    const tasksSynced = counters.tasksCreated + counters.tasksUpdated;

    // Post-sync sweep: find any AC tasks missing embeddings and generate them
    try {
      const { data: tasksWithoutEmbeddings, error: sweepQueryError } = await fromTable(supabase, "tasks")
        .select("id, title, description, status, priority, due_date, metadata")
        .eq("created_by", userId)
        .contains("metadata", { source: "activecollab" });

      if (!sweepQueryError && tasksWithoutEmbeddings) {
        for (const task of tasksWithoutEmbeddings) {
          const { data: existingEmb } = await fromTable(supabase, "embeddings")
            .select("id")
            .eq("entity_type", "task")
            .eq("entity_id", task.id)
            .limit(1);

          if (!existingEmb || existingEmb.length === 0) {
            console.log(`Post-sync sweep: generating missing embedding for task ${task.id} "${task.title}"`);
            try {
              const meta = task.metadata || {};
              const sweepContent = [
                `Task ID: ${meta.external_id || task.id}`,
                `Task Name: ${task.title}`,
                task.description ? `Description: ${task.description}` : "",
                `Status: ${task.status}`,
                `Priority: ${task.priority || "medium"}`,
                task.due_date ? `Due Date: ${task.due_date}` : "",
                `Project External ID: ${meta.project_external_id || "unknown"}`,
                `Source: activecollab`,
              ].filter(Boolean).join("\n");

              await upsertTaskEmbeddings({
                supabase,
                userId,
                taskId: task.id,
                content: sweepContent,
                metadata: meta,
                openAiApiKey,
                retries: 2,
              });
              counters.embeddingsInserted += 1;
              console.log(`Post-sync sweep: embedded task ${task.id} successfully`);
            } catch (sweepEmbedError) {
              counters.embeddingsFailed += 1;
              counters.errors.push(`Sweep embed ${task.id}: ${getErrorMessage(sweepEmbedError)}`);
              console.error(`Post-sync sweep: failed to embed task ${task.id}:`, getErrorMessage(sweepEmbedError));
            }
          }
        }
      }
    } catch (sweepError) {
      console.error("Post-sync embedding sweep failed:", getErrorMessage(sweepError));
      counters.errors.push(`Embedding sweep: ${getErrorMessage(sweepError)}`);
    }

    const status = counters.errors.length === 0 ? "success" : projectsSynced + tasksSynced === 0 ? "error" : "partial";

    await updateTokenMetadata(supabase, tokenRow, {
      last_sync_at: new Date().toISOString(),
      last_sync_status: status,
      last_sync_error: counters.errors[0] ?? null,
      projects_synced: projectsSynced,
      tasks_synced: tasksSynced,
    });

    await insertUsageLog({
      supabase,
      providerId,
      userId,
      status,
      errorMessage: counters.errors.length > 0 ? counters.errors.join("; ").slice(0, 500) : null,
      responseMetadata: {
        projects_synced: projectsSynced,
        projects_created: counters.projectsCreated,
        projects_updated: counters.projectsUpdated,
        tasks_synced: tasksSynced,
        embeddings_inserted: counters.embeddingsInserted,
        embedding_failures: counters.embeddingsFailed,
        duration_ms: Date.now() - startedAt,
      },
    });

    console.log("Completed background ActiveCollab sync", {
      userId,
      projectsSynced,
      tasksSynced,
      errors: counters.errors.length,
      embeddingsInserted: counters.embeddingsInserted,
      embeddingsFailed: counters.embeddingsFailed,
      durationMs: Date.now() - startedAt,
    });

    return createSyncResponse(startedAt, {
      success: status === "success",
      projects_synced: projectsSynced,
      projects_created: counters.projectsCreated,
      projects_updated: counters.projectsUpdated,
      tasks_synced: tasksSynced,
      errors: counters.errors,
    });
  } catch (error) {
    const message = getErrorMessage(error);

    console.error("Background ActiveCollab sync failed:", message);

    await updateTokenMetadata(supabase, tokenRow, {
      last_sync_at: new Date().toISOString(),
      last_sync_status: "error",
      last_sync_error: message,
    });

    await insertUsageLog({
      supabase,
      providerId,
      userId,
      status: "error",
      errorMessage: message,
      responseMetadata: {
        projects_synced: 0,
        projects_created: 0,
        projects_updated: 0,
        tasks_synced: 0,
        embeddings_inserted: 0,
        embedding_failures: 0,
        duration_ms: Date.now() - startedAt,
      },
    });

    return createSyncResponse(startedAt, {
      success: false,
      errors: [message],
    });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startedAt = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      return jsonResponse(startedAt, {
        errors: ["Server misconfigured for ActiveCollab sync"],
      }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return jsonResponse(startedAt, {
        errors: ["Missing authorization header"],
      }, 401);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const jwt = authHeader.replace("Bearer ", "");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      return jsonResponse(startedAt, {
        errors: ["Invalid token"],
      }, 401);
    }

    const { data: tokenData, error: tokenError } = await supabase
      .from("user_oauth_tokens")
      .select("id, access_token, metadata, account_email")
      .eq("user_id", user.id)
      .eq("provider_slug", "activecollab")
      .maybeSingle();

    const tokenRow = tokenData as TokenRow | null;

    if (tokenError || !tokenRow?.access_token) {
      return jsonResponse(startedAt, {
        errors: ["No ActiveCollab connection found for this user"],
      }, 400);
    }

    getActiveCollabBaseUrl(tokenRow.metadata);

    const backgroundTask = performBackgroundSync({
      supabaseUrl,
      supabaseServiceKey,
      userId: user.id,
      tokenRow,
    });

    // Run inline so caller receives real counts immediately and sync is not dropped.
    // If runtime supports waitUntil, it is still safe to await here for deterministic UX.
    const result = await backgroundTask;
    return jsonResponse(startedAt, result, result.success ? 200 : 500);
  } catch (error) {
    return jsonResponse(startedAt, {
      errors: [getErrorMessage(error)],
    }, 500);
  }
});