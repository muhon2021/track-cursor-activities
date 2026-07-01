/** Cursor Self Analyser — full productivity audit report structure */

export interface CsaAuditGlance {
  working: string[];
  hindering: string[];
  quick_wins: string[];
  ambitious: string[];
}

export interface CsaAuditWorkArea {
  name: string;
  sessions: number;
  description: string;
}

export interface CsaAuditCharts {
  task_intents: Record<string, number>;
  top_tools: Record<string, number>;
  languages: Record<string, number>;
  session_types: Record<string, number>;
  response_time_buckets: Record<string, number>;
  tool_errors: Record<string, number>;
  /** Per-prompt LLM usage (from hook metadata); absent on reports generated before this field existed */
  models_used?: Record<string, number>;
  /** @deprecated Legacy reports may still include this field */
  time_of_day?: Record<string, number>;
  outcomes: Record<string, number>;
  satisfaction_estimate: number;
}

export interface CsaAuditFrictionCategory {
  id: string;
  title: string;
  description: string;
  examples: string[];
  mitigation: string;
}

export interface CsaAuditSnippet {
  title: string;
  content: string;
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
  at_a_glance: CsaAuditGlance;
  stats_row: {
    total_messages: number;
    total_sessions: number;
    files_touched: number | null;
    days_active: number;
    avg_messages_per_day: number;
  };
  what_you_work_on: {
    areas: CsaAuditWorkArea[];
    themes: string;
  };
  charts: CsaAuditCharts;
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
    categories: CsaAuditFrictionCategory[];
  };
  existing_features: {
    cursor_rules: string[];
    custom_prompts: CsaAuditSnippet[];
    workflow_recommendations: string[];
    copyable_snippets: CsaAuditSnippet[];
  };
  new_ways: {
    workflows: string[];
    prompt_templates: CsaAuditSnippet[];
  };
  on_the_horizon: string[];
}

export const CSA_AUDIT_SECTIONS = [
  { id: "glance", label: "At a Glance" },
  { id: "stats", label: "Stats" },
  { id: "work", label: "What You Work On" },
  { id: "charts", label: "Charts" },
  { id: "usage", label: "How You Use Cursor" },
  { id: "wins", label: "Impressive Things" },
  { id: "friction", label: "Where Things Go Wrong" },
  { id: "features", label: "Features to Try" },
  { id: "new-ways", label: "New Ways" },
  { id: "horizon", label: "On the Horizon" },
] as const;
