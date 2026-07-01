/**
 * CSA audit — aggregate session data and build / merge AI audit JSON
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import {
  runCsaAuditAi,
  type CsaGenerationMeta,
  type CsaAuditNarrativePartial,
} from "./csa-audit-ai.ts";

// =============================================================================
// Types (mirrors src/types/csaAuditReport.ts)
// =============================================================================

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

export interface CsaAuditReport {
  header: {
    title: string;
    display_name: string;
    total_messages: number;
    total_sessions: number;
    period_start: string;
    period_end: string;
  };
  at_a_glance: {
    working: string[];
    hindering: string[];
    quick_wins: string[];
    ambitious: string[];
  };
  stats_row: {
    total_messages: number;
    total_sessions: number;
    files_touched: number | null;
    days_active: number;
    avg_messages_per_day: number;
  };
  what_you_work_on: {
    areas: { name: string; sessions: number; description: string }[];
    themes: string;
  };
  charts: {
    task_intents: Record<string, number>;
    top_tools: Record<string, number>;
    languages: Record<string, number>;
    session_types: Record<string, number>;
    response_time_buckets: Record<string, number>;
    tool_errors: Record<string, number>;
    models_used: Record<string, number>;
    outcomes: Record<string, number>;
    satisfaction_estimate: number;
  };
  how_you_use_cursor: {
    narrative: string;
    behavior_patterns: string[];
    key_insight: string;
  };
  impressive_things: {
    patterns: string[];
    workflows: string[];
    prompting_examples: string[];
  };
  where_things_go_wrong: {
    categories: {
      id: string;
      title: string;
      description: string;
      examples: string[];
      mitigation: string;
    }[];
  };
  existing_features: {
    cursor_rules: string[];
    custom_prompts: { title: string; content: string }[];
    workflow_recommendations: string[];
    copyable_snippets: { title: string; content: string }[];
  };
  new_ways: {
    workflows: string[];
    prompt_templates: { title: string; content: string }[];
  };
  on_the_horizon: string[];
}

const LANG_EXT: Record<string, string> = {
  ts: "TypeScript",
  tsx: "TypeScript",
  js: "JavaScript",
  jsx: "JavaScript",
  py: "Python",
  go: "Go",
  rs: "Rust",
  sql: "SQL",
  md: "Markdown",
  css: "CSS",
  scss: "SCSS",
  json: "JSON",
  yaml: "YAML",
  yml: "YAML",
};

function inc(map: Record<string, number>, key: string, n = 1) {
  map[key] = (map[key] || 0) + n;
}

function responseBucket(minutes: number): string {
  if (minutes < 1) return "< 1 min";
  if (minutes < 5) return "1–5 min";
  if (minutes < 15) return "5–15 min";
  return "15+ min";
}

function inferLanguage(path: string | null): string | null {
  if (!path) return null;
  const ext = path.split(".").pop()?.toLowerCase();
  return ext ? LANG_EXT[ext] ?? null : null;
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

function formatCsaModelLabel(metadata: Record<string, unknown>): string | null {
  const model = (metadata?.model as string | undefined)?.trim();
  if (model) return model;
  const modelId = (metadata?.model_id as string | undefined)?.trim();
  if (modelId) return modelId;
  return null;
}

function resolvePromptModels(messages: CsaMessageRow[]): Map<string, string> {
  const bySession = new Map<string, CsaMessageRow[]>();
  for (const m of messages) {
    const list = bySession.get(m.session_id) || [];
    list.push(m);
    bySession.set(m.session_id, list);
  }

  const promptModelByMessageKey = new Map<string, string>();

  for (const list of bySession.values()) {
    list.sort((a, b) => a.created_at.localeCompare(b.created_at));
    for (let i = 0; i < list.length; i++) {
      const m = list[i];
      if (m.role !== "user") continue;

      let label = formatCsaModelLabel(m.metadata || {});
      if (!label) {
        for (let j = i + 1; j < list.length; j++) {
          if (list[j].role === "assistant") {
            label = formatCsaModelLabel(list[j].metadata || {});
            break;
          }
          if (list[j].role === "user") break;
        }
      }
      if (label) {
        promptModelByMessageKey.set(`${m.session_id}:${m.created_at}`, label);
      }
    }
  }

  return promptModelByMessageKey;
}

function computeSatisfactionEstimate(
  sessionCount: number,
  totalPrompts: number,
  daysActive: number,
  avgPromptLength: number,
  intentCount: number,
): number {
  const sessionCadence = daysActive > 0 ? Math.min(sessionCount / daysActive, 2.5) / 2.5 : 0;
  const promptVolume = Math.min(totalPrompts / 40, 1);
  const intentDiversity = Math.min(intentCount / 5, 1) * 6;
  const lengthPenalty = avgPromptLength > 450 ? 7 : avgPromptLength > 300 ? 3 : 0;

  const raw =
    42 +
    sessionCadence * 22 +
    promptVolume * 24 +
    intentDiversity -
    lengthPenalty;

  return Math.min(96, Math.max(38, Math.round(raw)));
}

export function aggregateCsaData(
  displayName: string,
  periodStart: string,
  periodEnd: string,
  sessions: CsaSessionRow[],
  messages: CsaMessageRow[],
): { statsJson: Record<string, unknown>; computed: Omit<CsaAuditReport, "at_a_glance" | "how_you_use_cursor" | "impressive_things" | "where_things_go_wrong" | "existing_features" | "new_ways" | "on_the_horizon"> } {
  const userMsgs = messages.filter((m) => m.role === "user");
  const totalPrompts = userMsgs.length;
  const sessionCount = sessions.length;

  const activeDays = new Set(userMsgs.map((m) => m.created_at.slice(0, 10)));
  const daysActive = activeDays.size || 1;
  const avgPerDay = Math.round((totalPrompts / daysActive) * 10) / 10;

  const projectMap: Record<string, number> = {};
  for (const s of sessions) {
    const name = s.project_name || "Unknown project";
    inc(projectMap, name);
  }

  const taskIntents: Record<string, number> = {};
  for (const m of userMsgs) {
    if (m.content) inc(taskIntents, classifyIntent(m.content));
  }

  const sessionTypes: Record<string, number> = {};
  for (const s of sessions) {
    const mode = (s.metadata?.mode as string) || (s.metadata?.client_type as string) || "agent";
    inc(sessionTypes, String(mode).replace(/_/g, " "));
  }

  const languages: Record<string, number> = {};
  for (const s of sessions) {
    const lang = inferLanguage(s.workspace_path);
    if (lang) inc(languages, lang);
  }
  if (Object.keys(languages).length === 0) inc(languages, "Mixed / unknown", sessionCount);

  const topTools: Record<string, number> = {};
  for (const m of messages) {
    const tools = m.metadata?.tool_calls as string[] | undefined;
    if (Array.isArray(tools)) {
      for (const t of tools) inc(topTools, t);
    }
  }
  if (Object.keys(topTools).length === 0) {
    inc(topTools, "Agent (inferred)", Math.max(1, sessionCount));
    if (totalPrompts > 0) inc(topTools, "Chat prompts", totalPrompts);
  }

  const modelsUsed: Record<string, number> = {};
  const promptModelMap = resolvePromptModels(messages);
  for (const m of userMsgs) {
    const label =
      promptModelMap.get(`${m.session_id}:${m.created_at}`) ||
      formatCsaModelLabel(m.metadata || {});
    if (label) inc(modelsUsed, label);
  }
  if (Object.keys(modelsUsed).length === 0) {
    for (const s of sessions) {
      if (s.model) inc(modelsUsed, s.model);
    }
  }

  const responseBuckets: Record<string, number> = {};
  const bySession = new Map<string, CsaMessageRow[]>();
  for (const m of messages) {
    const list = bySession.get(m.session_id) || [];
    list.push(m);
    bySession.set(m.session_id, list);
  }
  for (const list of bySession.values()) {
    list.sort((a, b) => a.created_at.localeCompare(b.created_at));
    for (let i = 0; i < list.length - 1; i++) {
      if (list[i].role === "assistant" && list[i + 1].role === "user") {
        const ms = new Date(list[i + 1].created_at).getTime() - new Date(list[i].created_at).getTime();
        inc(responseBuckets, responseBucket(ms / 60000));
      }
    }
  }
  if (Object.keys(responseBuckets).length === 0) inc(responseBuckets, "Not enough data", 1);

  const promptLengths = userMsgs.map((m) => m.content_length || 0);
  const avgPromptLength = promptLengths.length
    ? Math.round(promptLengths.reduce((a, b) => a + b, 0) / promptLengths.length)
    : 0;

  const activityBreakdown: Record<string, number> = {};
  for (const [k, v] of Object.entries(taskIntents)) {
    activityBreakdown[k.toLowerCase().replace(/[^a-z]+/g, "_")] = v;
  }

  const areas = Object.entries(projectMap)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({
      name,
      sessions: count,
      description: `${count} session(s) in this project area during the reporting period.`,
    }));

  const computed = {
    header: {
      title: "Cursor Productivity Audit",
      display_name: displayName,
      total_messages: totalPrompts,
      total_sessions: sessionCount,
      period_start: periodStart,
      period_end: periodEnd,
    },
    stats_row: {
      total_messages: totalPrompts,
      total_sessions: sessionCount,
      files_touched: null as number | null,
      days_active: daysActive,
      avg_messages_per_day: avgPerDay,
    },
    what_you_work_on: {
      areas,
      themes: areas.length
        ? `Primary focus across ${areas.length} project area(s), led by ${areas[0].name}.`
        : "No project data captured yet.",
    },
    charts: {
      task_intents: taskIntents,
      top_tools: topTools,
      languages,
      session_types: sessionTypes,
      response_time_buckets: responseBuckets,
      tool_errors: {} as Record<string, number>,
      models_used: modelsUsed,
      outcomes: {
        "Sessions with prompts": sessionCount,
        "Prompts captured": totalPrompts,
      },
      satisfaction_estimate: computeSatisfactionEstimate(
        sessionCount,
        totalPrompts,
        daysActive,
        avgPromptLength,
        Object.keys(taskIntents).length,
      ),
    },
  };

  const statsJson = {
    total_sessions: sessionCount,
    total_prompts: totalPrompts,
    total_messages: totalPrompts,
    avg_prompt_length: avgPromptLength,
    days_active: daysActive,
    avg_messages_per_day: avgPerDay,
    activity_breakdown: activityBreakdown,
    models_used: modelsUsed,
  };

  return { statsJson, computed };
}

function buildHeuristicNarrative(
  displayName: string,
  computed: ReturnType<typeof aggregateCsaData>["computed"],
  avgPromptLength: number,
): Pick<
  CsaAuditReport,
  "at_a_glance" | "how_you_use_cursor" | "impressive_things" | "where_things_go_wrong" | "existing_features" | "new_ways" | "on_the_horizon"
> {
  const topIntent = Object.entries(computed.charts.task_intents).sort((a, b) => b[1] - a[1])[0]?.[0] || "General";
  const sessionCount = computed.header.total_sessions;

  return {
    at_a_glance: {
      working: [
        sessionCount > 0 ? "Regular Cursor session cadence" : "Hooks are configured",
        `Strong orientation toward ${topIntent.toLowerCase()}`,
      ],
      hindering: [
        avgPromptLength > 250 ? "Long prompts may dilute agent focus" : "Limited session volume for deep patterns",
        "Tool-level telemetry not yet captured (optional hooks)",
      ],
      quick_wins: [
        "Use @file references instead of pasting large blocks",
        "One task per agent message for complex changes",
        "Add a project .cursor/rules file for conventions",
      ],
      ambitious: [
        "Parallel agents for research vs implementation",
        "Automated validation loops after each change",
      ],
    },
    how_you_use_cursor: {
      narrative: `${displayName} used Cursor across ${sessionCount} session(s) with emphasis on ${topIntent.toLowerCase()}. Prompts average ${avgPromptLength} characters.`,
      behavior_patterns: [
        `Top task type: ${topIntent}`,
        computed.what_you_work_on.areas[0]
          ? `Most active project: ${computed.what_you_work_on.areas[0].name}`
          : "Project context varies",
      ],
      key_insight: sessionCount >= 3
        ? "Consistent multi-session usage — good candidate for reusable rules and templates."
        : "Early-stage usage — focus on prompt discipline and scoped context.",
    },
    impressive_things: {
      patterns: ["Sustained AI-assisted development workflow"],
      workflows: ["Iterative prompt → agent → review cycle"],
      prompting_examples: ["Break large tasks into numbered steps with acceptance criteria"],
    },
    where_things_go_wrong: {
      categories: [
        {
          id: "wrong_approach",
          title: "Wrong approach",
          description: "Agent picks a valid but suboptimal strategy for the task.",
          examples: ["Broad refactors without file scope", "Reimplementing instead of extending existing code"],
          mitigation: "State constraints upfront: files to touch, patterns to follow, what not to change.",
        },
        {
          id: "misunderstood",
          title: "Misunderstood requests",
          description: "Prompt ambiguity leads to off-target output.",
          examples: avgPromptLength > 200 ? ["Very long prompts mixing multiple goals"] : ["Vague 'fix it' without error context"],
          mitigation: "One goal per message; include expected outcome and reproduction steps.",
        },
        {
          id: "buggy_output",
          title: "Buggy output",
          description: "Generated code needs correction before merge.",
          examples: ["Missing edge cases", "Type errors in generated patches"],
          mitigation: "Ask agent to run lint/build; request minimal diff with tests.",
        },
      ],
    },
    existing_features: {
      cursor_rules: [
        "Add .cursor/rules for stack conventions and file patterns",
        "Use @docs for module-specific context",
      ],
      custom_prompts: [
        {
          title: "Scoped fix",
          content: "Fix [issue] in @[file]. Do not change unrelated files. Explain root cause in 2 sentences.",
        },
      ],
      workflow_recommendations: [
        "Plan in chat → implement in agent mode with @ references",
        "Regenerate insights weekly after meaningful usage",
      ],
      copyable_snippets: [
        {
          title: "Review before commit",
          content: "Review your changes for: (1) scope creep (2) missing null checks (3) test coverage. List issues only.",
        },
      ],
    },
    new_ways: {
      workflows: [
        "Research agent (read-only) → implementation agent (writes)",
        "Post-task retrospective prompt to capture learnings",
      ],
      prompt_templates: [
        {
          title: "Feature slice",
          content: "Implement [feature] in @[files]. Match existing patterns in @[reference]. Acceptance: [criteria].",
        },
        {
          title: "Debug loop",
          content: "Error: [message]. Repro: [steps]. Suspect: @[file]. Propose fix with minimal diff.",
        },
      ],
    },
    on_the_horizon: [
      "Parallel subagents for exploration vs execution",
      "Autonomous discovery with validation gates",
      "CI-integrated agent runs on PR open",
    ],
  };
}

function mergeAudit(
  computed: ReturnType<typeof aggregateCsaData>["computed"],
  narrative: ReturnType<typeof buildHeuristicNarrative>,
  aiPartial: CsaAuditNarrativePartial | null,
): CsaAuditReport {
  const whatYouWorkOn = aiPartial?.what_you_work_on?.themes
    ? { areas: computed.what_you_work_on.areas, themes: aiPartial.what_you_work_on.themes }
    : computed.what_you_work_on;

  return {
    header: computed.header,
    stats_row: computed.stats_row,
    what_you_work_on: whatYouWorkOn,
    charts: computed.charts,
    at_a_glance: aiPartial?.at_a_glance || narrative.at_a_glance,
    how_you_use_cursor: aiPartial?.how_you_use_cursor || narrative.how_you_use_cursor,
    impressive_things: aiPartial?.impressive_things || narrative.impressive_things,
    where_things_go_wrong: aiPartial?.where_things_go_wrong || narrative.where_things_go_wrong,
    existing_features: aiPartial?.existing_features || narrative.existing_features,
    new_ways: aiPartial?.new_ways || narrative.new_ways,
    on_the_horizon: aiPartial?.on_the_horizon || narrative.on_the_horizon,
  };
}

export async function buildCsaAuditReport(
  supabase: SupabaseClient,
  displayName: string,
  periodStart: string,
  periodEnd: string,
  sessions: CsaSessionRow[],
  messages: CsaMessageRow[],
): Promise<{
  audit: CsaAuditReport;
  statsJson: Record<string, unknown>;
  overview: string;
  friction_points: string[];
  recommendations: string[];
  generation_meta: CsaGenerationMeta;
}> {
  const { statsJson, computed } = aggregateCsaData(displayName, periodStart, periodEnd, sessions, messages);
  const avgPromptLength = (statsJson.avg_prompt_length as number) || 0;
  const narrative = buildHeuristicNarrative(displayName, computed, avgPromptLength);

  const { partial: aiPartial, meta: generation_meta } = await runCsaAuditAi(
    supabase,
    displayName,
    periodStart,
    periodEnd,
    sessions,
    messages,
    statsJson,
    computed,
  );

  const audit = mergeAudit(computed, narrative, aiPartial);
  const overview = audit.how_you_use_cursor.narrative;
  const friction_points = audit.where_things_go_wrong.categories.map((c) => c.title);
  const recommendations = [
    ...audit.at_a_glance.quick_wins,
    ...audit.existing_features.workflow_recommendations,
  ].slice(0, 6);

  return { audit, statsJson, overview, friction_points, recommendations, generation_meta };
}
