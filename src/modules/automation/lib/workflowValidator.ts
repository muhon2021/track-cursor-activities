import type { WorkflowDefinition } from "../types";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateWorkflow(definition: WorkflowDefinition, triggerType?: string): ValidationResult {
  const errors: string[] = [];
  const nodes = definition.nodes ?? [];
  const edges = definition.edges ?? [];

  const triggerNodes = nodes.filter((n) => n.type === "trigger");
  if (triggerNodes.length === 0) {
    errors.push("Workflow must have a trigger node");
  }
  if (triggerNodes.length > 1) {
    errors.push("Workflow can only have one trigger node");
  }

  const nodeIds = new Set(nodes.map((n) => n.id));
  for (const edge of edges) {
    if (!nodeIds.has(edge.from)) errors.push(`Edge references missing node: ${edge.from}`);
    if (!nodeIds.has(edge.to)) errors.push(`Edge references missing node: ${edge.to}`);
  }

  if (hasCycle(nodes.map((n) => n.id), edges)) {
    errors.push("Workflow contains a cycle");
  }

  const actionNodes = nodes.filter((n) => n.type === "action");
  if (actionNodes.length === 0 && triggerType !== "manual") {
    errors.push("Workflow should have at least one action");
  }

  for (const node of actionNodes) {
    if (!node.config?.action) {
      errors.push(`Action node ${node.id} missing action type`);
    }
  }

  return { valid: errors.length === 0, errors };
}

function hasCycle(nodeIds: string[], edges: { from: string; to: string }[]): boolean {
  const adj = new Map<string, string[]>();
  for (const id of nodeIds) adj.set(id, []);
  for (const e of edges) adj.get(e.from)?.push(e.to);

  const visited = new Set<string>();
  const stack = new Set<string>();

  function dfs(n: string): boolean {
    if (stack.has(n)) return true;
    if (visited.has(n)) return false;
    visited.add(n);
    stack.add(n);
    for (const next of adj.get(n) ?? []) {
      if (dfs(next)) return true;
    }
    stack.delete(n);
    return false;
  }

  for (const id of nodeIds) {
    if (dfs(id)) return true;
  }
  return false;
}

export function definitionToFlow(definition: WorkflowDefinition) {
  return {
    nodes: (definition.nodes ?? []).map((n, i) => ({
      id: n.id,
      type: n.type,
      position: { x: 250, y: i * 120 + 50 },
      data: { label: `${n.type}: ${n.id}`, config: n.config },
    })),
    edges: (definition.edges ?? []).map((e, i) => ({
      id: `e-${i}`,
      source: e.from,
      target: e.to,
      label: e.when,
    })),
  };
}

export function flowToDefinition(
  nodes: Array<{ id: string; type?: string; data: { config?: Record<string, unknown> } }>,
  edges: Array<{ source: string; target: string; label?: string }>,
  triggerType: string
): WorkflowDefinition {
  return {
    version: 1,
    trigger: { type: triggerType },
    nodes: nodes.map((n) => ({
      id: n.id,
      type: (n.type ?? "action") as WorkflowDefinition["nodes"][0]["type"],
      config: n.data?.config ?? {},
    })),
    edges: edges.map((e) => ({
      from: e.source,
      to: e.target,
      when: e.label,
    })),
  };
}
