export type ConditionOperator = "eq" | "neq" | "contains" | "gt" | "lt";

export interface ConditionRule {
  field: string;
  op: ConditionOperator;
  value: unknown;
}

export interface ConditionConfig {
  operator: "AND" | "OR";
  rules: ConditionRule[];
  groups?: ConditionConfig[];
}

function getFieldValue(payload: Record<string, unknown>, field: string): unknown {
  const parts = field.split(".");
  let current: unknown = payload;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function evaluateRule(payload: Record<string, unknown>, rule: ConditionRule): boolean {
  const actual = getFieldValue(payload, rule.field);
  const expected = rule.value;
  switch (rule.op) {
    case "eq": return String(actual) === String(expected);
    case "neq": return String(actual) !== String(expected);
    case "contains": return String(actual ?? "").toLowerCase().includes(String(expected).toLowerCase());
    case "gt": return Number(actual) > Number(expected);
    case "lt": return Number(actual) < Number(expected);
    default: return false;
  }
}

export function evaluateConditions(
  config: ConditionConfig,
  payload: Record<string, unknown>
): boolean {
  const ruleResults = (config.rules ?? []).map((r) => evaluateRule(payload, r));
  const groupResults = (config.groups ?? []).map((g) => evaluateConditions(g, payload));
  const all = [...ruleResults, ...groupResults];
  if (all.length === 0) return true;
  return config.operator === "OR" ? all.some(Boolean) : all.every(Boolean);
}
