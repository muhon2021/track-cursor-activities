/**
 * Maps Jira workflow / status names to internal task status values.
 * Keep in sync with `supabase/functions/sync-tasks-jira/jira-workflow-status.ts`.
 */
export type TaskStatusInternal = "todo" | "in_progress" | "completed" | "cancelled";

export function jiraStatusNameToInternal(name: string | undefined | null): TaskStatusInternal {
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

export function jiraPriorityNameToInternal(
  name: string | undefined | null,
): "low" | "medium" | "high" | "urgent" {
  if (!name) return "medium";
  const n = name.toLowerCase();
  if (n.includes("highest") || n.includes("critical")) return "urgent";
  if (n.includes("high")) return "high";
  if (n.includes("low") || n.includes("lowest") || n.includes("minor")) return "low";
  return "medium";
}
