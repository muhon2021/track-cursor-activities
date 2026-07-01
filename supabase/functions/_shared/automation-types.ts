export type AutomationStepType =
  | "trigger"
  | "condition"
  | "action"
  | "delay"
  | "approval"
  | "loop"
  | "branch";

export type ExecutionStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "paused";

export type ConditionOperator = "eq" | "neq" | "contains" | "gt" | "lt" | "gte" | "lte";

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

export interface WorkflowNode {
  id: string;
  type: AutomationStepType;
  config: Record<string, unknown>;
}

export interface WorkflowEdge {
  from: string;
  to: string;
  when?: string;
}

export interface WorkflowDefinition {
  version: number;
  trigger?: { type: string; filters?: Record<string, unknown> };
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface AutomationWorkflow {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  definition: WorkflowDefinition;
  version: number;
  department_id?: string | null;
  created_by?: string | null;
}

export interface AutomationExecution {
  id: string;
  workflow_id: string;
  tenant_id: string;
  status: ExecutionStatus;
  trigger_payload: Record<string, unknown>;
  idempotency_key?: string | null;
  current_step_key?: string | null;
  retry_count: number;
  max_retries: number;
  paused_until?: string | null;
  error_message?: string | null;
}

export const TRIGGER_EVENT_MAP: Record<string, string[]> = {
  "task.created": ["task.created", "task.assigned"],
  "task.updated": ["task.updated"],
  "task.completed": ["task.completed"],
  "user.created": ["user.created", "user.invited"],
  "meeting.scheduled": ["meeting.scheduled"],
  "rock.overdue": ["rock.overdue"],
  "issue.created": ["issue.created", "issue.escalated"],
  "document.synced": ["document.synced"],
  "integration.error": ["integration.error", "sync.failed"],
  "ai.agent.completed": ["ai.agent.completed"],
  webhook: ["webhook"],
  schedule: ["schedule"],
  manual: ["manual"],
  "custom.event": ["custom.event"],
};
