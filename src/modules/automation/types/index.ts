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
  created_at?: string;
  updated_at?: string;
}

export interface AutomationExecution {
  id: string;
  workflow_id: string;
  status: ExecutionStatus;
  trigger_payload: Record<string, unknown>;
  started_at?: string | null;
  completed_at?: string | null;
  error_message?: string | null;
  retry_count?: number;
  automation_workflows?: { name: string; trigger_type: string };
}

export interface AutomationTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  trigger_type: string;
  definition: WorkflowDefinition;
  is_published: boolean;
  is_system: boolean;
}

export interface AutomationWebhook {
  id: string;
  name: string;
  path_slug: string;
  enabled: boolean;
  workflow_id: string;
  created_at?: string;
}

export const TRIGGER_OPTIONS = [
  { value: "manual", label: "Manual Trigger" },
  { value: "schedule", label: "Time Based" },
  { value: "task.created", label: "Task Created" },
  { value: "task.updated", label: "Task Updated" },
  { value: "task.completed", label: "Task Completed" },
  { value: "user.created", label: "User Created" },
  { value: "meeting.scheduled", label: "Meeting Scheduled" },
  { value: "rock.overdue", label: "Rock Overdue" },
  { value: "issue.created", label: "Issue Created" },
  { value: "document.synced", label: "Document Synced" },
  { value: "integration.error", label: "Integration Error" },
  { value: "webhook", label: "Webhook Event" },
  { value: "ai.agent.completed", label: "AI Agent Completed" },
  { value: "custom.event", label: "Custom Event" },
];

export const ACTION_OPTIONS = [
  { value: "send_notification", label: "Send Notification" },
  { value: "send_email", label: "Send Email" },
  { value: "create_task", label: "Create Task" },
  { value: "update_task", label: "Update Task" },
  { value: "assign_user", label: "Assign User" },
  { value: "trigger_ai_agent", label: "Trigger AI Agent" },
  { value: "generate_summary", label: "Generate Summary" },
  { value: "call_webhook", label: "Call Webhook" },
  { value: "slack_message", label: "Slack Message" },
  { value: "teams_message", label: "Teams Message" },
  { value: "http_request", label: "HTTP Request" },
  { value: "classify_text", label: "Classify Text" },
  { value: "sentiment_analysis", label: "Sentiment Analysis" },
  { value: "extract_tasks", label: "Extract Tasks" },
];
