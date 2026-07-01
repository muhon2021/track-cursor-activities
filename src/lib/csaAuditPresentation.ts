import type { CsaAuditCharts, CsaAuditReport } from "@/types/csaAuditReport";
import type { CsaGenerationMeta } from "@/lib/api/csaReportsService";

/** Summary stat cards — shared by audit view and HTML export */
export const CSA_SUMMARY_STATS: {
  label: string;
  getValue: (stats: CsaAuditReport["stats_row"]) => string | number;
}[] = [
  { label: "Prompts", getValue: (s) => s.total_messages },
  { label: "Sessions", getValue: (s) => s.total_sessions },
  { label: "Days active", getValue: (s) => s.days_active },
  { label: "Avg prompts/day", getValue: (s) => s.avg_messages_per_day },
];

export type CsaAuditChartKey = keyof Pick<
  CsaAuditCharts,
  "task_intents" | "top_tools" | "response_time_buckets" | "models_used" | "tool_errors"
>;

/** Bar charts shown in audit view and HTML export (satisfaction is separate) */
export const CSA_AUDIT_BAR_CHARTS: {
  title: string;
  key: CsaAuditChartKey;
  optional?: boolean;
  htmlColor?: string;
}[] = [
  { title: "What you wanted", key: "task_intents" },
  { title: "Top tools", key: "top_tools", htmlColor: "#22d3ee" },
  { title: "Response time", key: "response_time_buckets", htmlColor: "#fb923c" },
  { title: "Models used", key: "models_used", htmlColor: "#a78bfa" },
  { title: "Tool errors", key: "tool_errors", optional: true, htmlColor: "#f87171" },
];

export function formatGenerationMetaNote(meta: CsaGenerationMeta | undefined): string | null {
  if (!meta) return null;
  if (meta.source === "ai" && meta.model) {
    const note = meta.analysisNote && meta.analysisNote !== "ai"
      ? ` (${meta.analysisNote})`
      : "";
    return `Personalized narrative generated with ${meta.model}${note}`;
  }
  if (meta.source === "heuristic") {
    const note = meta.analysisNote ? ` (${meta.analysisNote})` : "";
    return `Template-based summary — AI generation unavailable${note}. Check OpenAI credentials in AI config and regenerate.`;
  }
  return null;
}

export function formatGenerationMetaHtml(meta: CsaGenerationMeta | undefined): string {
  const note = formatGenerationMetaNote(meta);
  if (!note) return "";
  const escaped = note
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const cls = meta?.source === "heuristic" ? "meta warn" : "meta";
  return `<p class="${cls}">${escaped}</p>`;
}
