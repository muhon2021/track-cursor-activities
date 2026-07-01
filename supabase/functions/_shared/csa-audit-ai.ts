/**
 * CSA audit AI — rich dossier, GPT-4o generation, validation + retry
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import {
  chatCompletion,
  getModel,
  getModelByModelId,
  type ChatMessage,
} from "./ai-provider-routing.ts";

export interface CsaSessionRow {
  id: string;
  user_email?: string | null;
  project_name: string | null;
  workspace_path: string | null;
  model: string | null;
  started_at: string;
  ended_at: string | null;
  message_count: number;
  metadata: Record<string, unknown>;
}

export interface CsaMessageRow {
  session_id: string;
  role: string;
  content: string | null;
  content_length: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CsaAuditComputedSlice {
  header: {
    total_messages: number;
    total_sessions: number;
  };
  what_you_work_on: {
    areas: { name: string; sessions: number; description: string }[];
  };
  charts: {
    task_intents: Record<string, number>;
    top_tools: Record<string, number>;
    languages: Record<string, number>;
    session_types: Record<string, number>;
    response_time_buckets: Record<string, number>;
    models_used: Record<string, number>;
  };
}

export interface CsaAuditNarrativePartial {
  at_a_glance?: {
    working: string[];
    hindering: string[];
    quick_wins: string[];
    ambitious: string[];
  };
  what_you_work_on?: { themes: string };
  how_you_use_cursor?: {
    narrative: string;
    behavior_patterns: string[];
    key_insight: string;
  };
  impressive_things?: {
    patterns: string[];
    workflows: string[];
    prompting_examples: string[];
  };
  where_things_go_wrong?: {
    categories: {
      id: string;
      title: string;
      description: string;
      examples: string[];
      mitigation: string;
    }[];
  };
  existing_features?: {
    cursor_rules: string[];
    custom_prompts: { title: string; content: string }[];
    workflow_recommendations: string[];
    copyable_snippets: { title: string; content: string }[];
  };
  new_ways?: {
    workflows: string[];
    prompt_templates: { title: string; content: string }[];
  };
  on_the_horizon?: string[];
}

function classifyIntent(prompt: string): string {
  const p = prompt.toLowerCase();
  if (/fix|bug|error|debug|broken|failing|issue/.test(p)) return "Debugging";
  if (/refactor|clean up|reorganize|rename|extract/.test(p)) return "Refactoring";
  if (/implement|add|create|build|write|generate/.test(p)) return "Code generation";
  if (/explain|how does|what is|why/.test(p)) return "Learning / Q&A";
  if (/review|audit|check|analyze/.test(p)) return "Review & analysis";
  if (/deploy|migrate|config|setup/.test(p)) return "DevOps & config";
  return "General assistance";
}

function redactExcerpt(text: string, max = 280): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

export interface CsaGenerationMeta {
  source: "ai" | "heuristic";
  model?: string;
  provider?: string;
  analysisNote: string;
}

const CSA_MODEL_PREFERENCES = ["gpt-4o", "gpt-4o-mini"];

const NARRATIVE_JSON_SCHEMA = `{
  "at_a_glance": { "working": string[], "hindering": string[], "quick_wins": string[], "ambitious": string[] },
  "what_you_work_on": { "themes": string },
  "how_you_use_cursor": { "narrative": string, "behavior_patterns": string[], "key_insight": string },
  "impressive_things": { "patterns": string[], "workflows": string[], "prompting_examples": string[] },
  "where_things_go_wrong": { "categories": [{ "id": string, "title": string, "description": string, "examples": string[], "mitigation": string }] },
  "existing_features": { "cursor_rules": string[], "custom_prompts": [{ "title": string, "content": string }], "workflow_recommendations": string[], "copyable_snippets": [{ "title": string, "content": string }] },
  "new_ways": { "workflows": string[], "prompt_templates": [{ "title": string, "content": string }] },
  "on_the_horizon": string[]
}`;

const CSA_SYSTEM_PROMPT = `You are a senior Cursor productivity coach. Analyze the developer usage dossier and return ONLY valid JSON (no markdown fences) matching this schema:

${NARRATIVE_JSON_SCHEMA}

Rules:
- Do NOT include header, stats_row, or charts — those are computed separately.
- how_you_use_cursor.narrative MUST reference at least 2 concrete signals from the dossier (project name, intent, time pattern, or excerpt theme).
- quick_wins, workflow_recommendations, and prompt_templates must be tailored to THIS user's intents and projects — avoid generic boilerplate unless justified by their data.
- where_things_go_wrong.examples must cite patterns visible in prompt excerpts (long prompts, vague asks, multi-goal messages, etc.).
- Include friction categories when applicable: wrong_approach, rejected_actions, misunderstood, buggy_output.
- Do not invent projects, tools, or files not present in the dossier.
- Be specific, actionable, and personal.`;

const GENERIC_PHRASES = [
  "regular cursor session cadence",
  "sustained ai-assisted development workflow",
  "iterative prompt → agent → review cycle",
  "parallel agents for research vs implementation",
];

function formatRecordMap(label: string, data: Record<string, number>): string {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return `${label}: (none)`;
  return `${label}:\n${entries.map(([k, v]) => `  - ${k}: ${v}`).join("\n")}`;
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

/** Stratified prompt sample across sessions and intent buckets (~20–25 excerpts). */
export function sampleDiversePrompts(
  messages: CsaMessageRow[],
  sessions: CsaSessionRow[],
  maxTotal = 24,
  excerptMax = 400,
): { excerpts: string[]; intentLabels: string[] } {
  const userMsgs = messages.filter((m) => m.role === "user" && m.content);
  if (userMsgs.length === 0) return { excerpts: [], intentLabels: [] };

  const sessionProject = new Map(sessions.map((s) => [s.id, s.project_name || "Unknown project"]));

  const byIntent = new Map<string, CsaMessageRow[]>();
  for (const m of userMsgs) {
    const intent = classifyIntent(m.content!);
    const list = byIntent.get(intent) || [];
    list.push(m);
    byIntent.set(intent, list);
  }

  const picked: CsaMessageRow[] = [];
  const seenIds = new Set<string>();

  const intents = [...byIntent.keys()];
  let round = 0;
  while (picked.length < maxTotal && round < 50) {
    let added = false;
    for (const intent of intents) {
      const pool = byIntent.get(intent) || [];
      const candidate = pool[round];
      if (candidate && !seenIds.has(candidate.session_id + candidate.created_at)) {
        picked.push(candidate);
        seenIds.add(candidate.session_id + candidate.created_at);
        added = true;
        if (picked.length >= maxTotal) break;
      }
    }
    if (!added) break;
    round++;
  }

  if (picked.length < maxTotal) {
    for (const m of userMsgs) {
      const key = m.session_id + m.created_at;
      if (!seenIds.has(key)) {
        picked.push(m);
        seenIds.add(key);
        if (picked.length >= maxTotal) break;
      }
    }
  }

  const excerpts = picked.map((m, i) => {
    const project = sessionProject.get(m.session_id) || "Unknown";
    const intent = classifyIntent(m.content!);
    return `${i + 1}. [${intent}] [${project}] ${redactExcerpt(m.content!, excerptMax)}`;
  });

  const intentLabels = picked.map((m) => classifyIntent(m.content!));
  return { excerpts, intentLabels };
}

export function buildUsageDossier(
  displayName: string,
  periodStart: string,
  periodEnd: string,
  sessions: CsaSessionRow[],
  messages: CsaMessageRow[],
  statsJson: Record<string, unknown>,
  computed: CsaAuditComputedSlice,
  promptExcerpts: string[],
): string {
  const userMsgs = messages.filter((m) => m.role === "user");
  const assistantMsgs = messages.filter((m) => m.role === "assistant");

  const wordCounts = userMsgs.map((m) => {
    const wc = m.metadata?.word_count as number | undefined;
    if (typeof wc === "number") return wc;
    const text = m.content || "";
    return text.trim() ? text.trim().split(/\s+/).length : 0;
  });

  const charLengths = userMsgs.map((m) => m.content_length || (m.content?.length ?? 0));

  const bySession = new Map<string, { user: number; assistant: number }>();
  for (const m of messages) {
    const entry = bySession.get(m.session_id) || { user: 0, assistant: 0 };
    if (m.role === "user") entry.user++;
    else entry.assistant++;
    bySession.set(m.session_id, entry);
  }

  const sessionLines = sessions
    .sort((a, b) => b.started_at.localeCompare(a.started_at))
    .map((s) => {
      const counts = bySession.get(s.id) || { user: 0, assistant: 0 };
      const date = s.started_at.slice(0, 10);
      return `  - ${date} | ${s.project_name || "Unknown"} | model=${s.model || "n/a"} | prompts=${counts.user} | workspace=${s.workspace_path || "n/a"}`;
    });

  const assistantMeta = assistantMsgs.slice(0, 30).map((m, i) => {
    const meta = m.metadata || {};
    const toolCalls = meta.tool_calls ?? "n/a";
    const latency = meta.latency_ms ?? "n/a";
    return `  ${i + 1}. length=${m.content_length} tool_calls=${toolCalls} latency_ms=${latency}`;
  });

  const lines = [
    `# Cursor usage dossier: ${displayName}`,
    `Period: ${periodStart} to ${periodEnd}`,
    "",
    "## Volume",
    `Sessions: ${statsJson.total_sessions}`,
    `User prompts: ${statsJson.total_prompts}`,
    `Prompt count (summary): ${statsJson.total_messages}`,
    `Days active: ${statsJson.days_active}`,
    `Avg prompts/day: ${statsJson.avg_messages_per_day}`,
    `Prompt chars — avg: ${statsJson.avg_prompt_length}, min: ${charLengths.length ? Math.min(...charLengths) : 0}, max: ${charLengths.length ? Math.max(...charLengths) : 0}, median: ${median(charLengths)}`,
    `Prompt words — min: ${wordCounts.length ? Math.min(...wordCounts) : 0}, max: ${wordCounts.length ? Math.max(...wordCounts) : 0}, median: ${median(wordCounts)}`,
    "",
    "## Projects",
    computed.what_you_work_on.areas.map((a) => `  - ${a.name}: ${a.sessions} session(s)`).join("\n") || "  (none)",
    "",
    formatRecordMap("Task intents", computed.charts.task_intents),
    "",
    formatRecordMap("Models per prompt", computed.charts.models_used),
    "",
    formatRecordMap("Languages", computed.charts.languages),
    "",
    formatRecordMap("Session types", computed.charts.session_types),
    "",
    formatRecordMap("Response time buckets", computed.charts.response_time_buckets),
    "",
    formatRecordMap("Top tools", computed.charts.top_tools),
    "",
    "## Sessions (newest first)",
    sessionLines.join("\n") || "  (none)",
    "",
    "## Assistant response metadata (sample, no full text)",
    assistantMeta.length > 0 ? assistantMeta.join("\n") : "  (none)",
    "",
    "## Redacted prompt excerpts (stratified sample)",
    promptExcerpts.length > 0 ? promptExcerpts.join("\n") : "  (none)",
  ];

  return lines.join("\n");
}

export function parseCsaAuditAiJson(raw: string): CsaAuditNarrativePartial | null {
  const trimmed = raw.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fence?.[1] || trimmed).trim();
  try {
    return JSON.parse(body) as CsaAuditNarrativePartial;
  } catch {
    const start = body.indexOf("{");
    const end = body.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(body.slice(start, end + 1)) as CsaAuditNarrativePartial;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function isNonEmptyStringArray(val: unknown, minLen = 1): boolean {
  return Array.isArray(val) && val.length >= minLen && val.every((x) => typeof x === "string" && x.trim().length > 0);
}

function isTooGeneric(partial: CsaAuditNarrativePartial, minNarrativeLen = 50): boolean {
  const narrative = partial.how_you_use_cursor?.narrative?.toLowerCase() || "";
  if (narrative.length < minNarrativeLen) return true;
  const genericHits = GENERIC_PHRASES.filter((p) => narrative.includes(p)).length;
  if (genericHits >= 3) return true;
  return false;
}

function coerceCsaAuditPartial(
  partial: CsaAuditNarrativePartial | null,
  computed: CsaAuditComputedSlice,
  displayName: string,
): CsaAuditNarrativePartial | null {
  if (!partial) return null;

  const topProject = computed.what_you_work_on.areas[0]?.name || "their projects";
  const topIntent = Object.entries(computed.charts.task_intents).sort((a, b) => b[1] - a[1])[0]?.[0] || "General assistance";

  const glance = partial.at_a_glance || {
    working: [],
    hindering: [],
    quick_wins: [],
    ambitious: [],
  };
  if (!isNonEmptyStringArray(glance.working, 1)) {
    glance.working = [`Active Cursor usage across ${computed.header.total_sessions} session(s)`];
  }
  if (!isNonEmptyStringArray(glance.hindering, 1)) {
    glance.hindering = ["Prompt scope could be tighter on complex tasks"];
  }
  if (!isNonEmptyStringArray(glance.quick_wins, 1)) {
    glance.quick_wins = ["Use @file references and one clear goal per prompt"];
  }
  if (!isNonEmptyStringArray(glance.ambitious, 1)) {
    glance.ambitious = ["Reusable .cursor/rules for recurring workflows"];
  }

  const usage = partial.how_you_use_cursor || {
    narrative: "",
    behavior_patterns: [],
    key_insight: "",
  };
  if (!usage.narrative?.trim()) {
    usage.narrative = `${displayName} used Cursor on ${topProject} with emphasis on ${topIntent.toLowerCase()} over ${computed.header.total_sessions} session(s).`;
  }
  if (!isNonEmptyStringArray(usage.behavior_patterns, 1)) {
    usage.behavior_patterns = [`Primary focus: ${topIntent}`, `Most active project: ${topProject}`];
  }
  if (!usage.key_insight?.trim()) {
    usage.key_insight = "Consistent prompt-driven workflow with room to tighten task scoping.";
  }

  const friction = partial.where_things_go_wrong?.categories || [];
  if (friction.length === 0) {
    partial.where_things_go_wrong = {
      categories: [{
        id: "vague_scope",
        title: "Broad or multi-goal prompts",
        description: "Some prompts may combine multiple goals, which can reduce agent focus.",
        examples: ["Single message covering unrelated refactors and new features"],
        mitigation: "Split work into one objective per prompt with explicit acceptance criteria.",
      }],
    };
  } else {
    for (const c of friction) {
      if (!isNonEmptyStringArray(c.examples, 1)) {
        c.examples = ["Prompts that ask for multiple unrelated changes at once"];
      }
    }
  }

  const features = partial.existing_features || {
    cursor_rules: [],
    custom_prompts: [],
    workflow_recommendations: [],
    copyable_snippets: [],
  };
  if (!isNonEmptyStringArray(features.workflow_recommendations, 1)) {
    features.workflow_recommendations = ["Add project .cursor/rules for conventions used in " + topProject];
  }

  const newWays = partial.new_ways || { workflows: [], prompt_templates: [] };
  if (!Array.isArray(newWays.prompt_templates) || newWays.prompt_templates.length === 0) {
    newWays.prompt_templates = [{
      title: "Scoped task",
      content: `Implement [change] in @file. Match patterns in ${topProject}. Acceptance: [criteria].`,
    }];
  }
  if (!isNonEmptyStringArray(newWays.workflows, 1)) {
    newWays.workflows = ["Plan → implement → review in separate prompts"];
  }

  if (!isNonEmptyStringArray(partial.on_the_horizon, 1)) {
    partial.on_the_horizon = ["Parallel agents for research vs implementation"];
  }

  partial.at_a_glance = glance;
  partial.how_you_use_cursor = usage;
  partial.existing_features = features;
  partial.new_ways = newWays;

  return partial;
}

export function validateCsaAuditAiPartial(
  partial: CsaAuditNarrativePartial | null,
  opts?: { lenient?: boolean },
): boolean {
  if (!partial) return false;
  const lenient = opts?.lenient === true;

  const glance = partial.at_a_glance;
  if (!glance || !isNonEmptyStringArray(glance.working) || !isNonEmptyStringArray(glance.quick_wins)) {
    return false;
  }

  const usage = partial.how_you_use_cursor;
  if (
    !usage?.narrative?.trim() ||
    !isNonEmptyStringArray(usage.behavior_patterns) ||
    !usage.key_insight?.trim()
  ) {
    return false;
  }

  const friction = partial.where_things_go_wrong?.categories;
  const minFriction = lenient ? 1 : 2;
  if (!Array.isArray(friction) || friction.length < minFriction) return false;
  for (const c of friction) {
    if (!c.title?.trim() || !isNonEmptyStringArray(c.examples)) return false;
  }

  const features = partial.existing_features;
  if (!features || !isNonEmptyStringArray(features.workflow_recommendations)) return false;

  const newWays = partial.new_ways;
  if (!newWays || !Array.isArray(newWays.prompt_templates) || newWays.prompt_templates.length < 1) {
    return false;
  }

  if (isTooGeneric(partial, lenient ? 40 : 50)) return false;

  return true;
}

async function resolveCsaChatModel(supabase: SupabaseClient) {
  for (const modelId of CSA_MODEL_PREFERENCES) {
    const model = await getModelByModelId(supabase, modelId);
    if (model) return model;
  }
  return getModel(supabase, undefined, "chat");
}

async function callAuditAi(
  supabase: SupabaseClient,
  messages: ChatMessage[],
  useJsonMode: boolean,
): Promise<{ content: string; model: string; provider: string }> {
  const model = await resolveCsaChatModel(supabase);
  if (!model) {
    throw new Error("No enabled chat model found for CSA audit");
  }

  const response = await chatCompletion(
    supabase,
    {
      messages,
      temperature: 0.35,
      max_tokens: 6000,
      response_format: useJsonMode ? { type: "json_object" } : undefined,
    },
    model.id,
  );

  return {
    content: response.content,
    model: response.model,
    provider: model.ai_providers?.slug || "openai",
  };
}

export async function runCsaAuditAi(
  supabase: SupabaseClient,
  displayName: string,
  periodStart: string,
  periodEnd: string,
  sessions: CsaSessionRow[],
  messages: CsaMessageRow[],
  statsJson: Record<string, unknown>,
  computed: CsaAuditComputedSlice,
): Promise<{ partial: CsaAuditNarrativePartial | null; meta: CsaGenerationMeta }> {
  const noDataMeta: CsaGenerationMeta = { source: "heuristic", analysisNote: "no-session-data" };

  if (sessions.length === 0) {
    return { partial: null, meta: noDataMeta };
  }

  const { excerpts } = sampleDiversePrompts(messages, sessions);
  if (excerpts.length === 0) {
    return { partial: null, meta: { source: "heuristic", analysisNote: "no-prompt-excerpts" } };
  }

  const openaiModel = await resolveCsaChatModel(supabase);
  if (!openaiModel) {
    console.warn("[csa-audit-ai] No chat model configured — skipping AI generation");
    return { partial: null, meta: { source: "heuristic", analysisNote: "no-chat-model" } };
  }

  const dossier = buildUsageDossier(
    displayName,
    periodStart,
    periodEnd,
    sessions,
    messages,
    statsJson,
    computed,
    excerpts,
  );

  const userPrompt = `Analyze this developer's Cursor usage and produce the JSON narrative sections.

${dossier}

Return JSON only matching the schema from your instructions.`;

  const baseMessages: ChatMessage[] = [
    { role: "system", content: CSA_SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ];

  try {
    const promptCount = messages.filter((m) => m.role === "user").length;
    const lenient = promptCount < 12 || sessions.length < 4;

    let aiResult = await callAuditAi(supabase, baseMessages, true);
    let partial = parseCsaAuditAiJson(aiResult.content);
    partial = coerceCsaAuditPartial(partial, computed, displayName);

    if (!validateCsaAuditAiPartial(partial, { lenient })) {
      console.warn("[csa-audit-ai] First pass invalid or too generic — retrying");
      const retryMessages: ChatMessage[] = [
        ...baseMessages,
        { role: "assistant", content: aiResult.content },
        {
          role: "user",
          content:
            "Your JSON was invalid, incomplete, or too generic. Regenerate ONLY valid JSON. Reference specific prompt excerpts and project names from the dossier. Avoid stock advice. Include all required sections.",
        },
      ];
      aiResult = await callAuditAi(supabase, retryMessages, true);
      partial = coerceCsaAuditPartial(parseCsaAuditAiJson(aiResult.content), computed, displayName);
    }

    if (!validateCsaAuditAiPartial(partial, { lenient })) {
      console.warn("[csa-audit-ai] Second pass failed — trying without JSON mode");
      aiResult = await callAuditAi(supabase, baseMessages, false);
      partial = coerceCsaAuditPartial(parseCsaAuditAiJson(aiResult.content), computed, displayName);
    }

    if (validateCsaAuditAiPartial(partial, { lenient: true })) {
      console.log(
        `[csa-audit-ai] AI success provider=${aiResult.provider} model=${aiResult.model}`,
      );
      return {
        partial,
        meta: {
          source: "ai",
          model: aiResult.model,
          provider: aiResult.provider,
          analysisNote: lenient ? "ai-lenient" : "ai",
        },
      };
    }

    console.warn("[csa-audit-ai] AI output failed validation after retries");
    return {
      partial: null,
      meta: {
        source: "heuristic",
        model: aiResult.model,
        provider: aiResult.provider,
        analysisNote: "ai-invalid-after-retry",
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.warn("[csa-audit-ai] AI generation failed:", msg);
    return {
      partial: null,
      meta: { source: "heuristic", analysisNote: `ai-failed: ${msg}` },
    };
  }
}
