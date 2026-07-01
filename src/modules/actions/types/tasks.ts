/**
 * Actions Module Types
 *
 * Type definitions for tasks, streams, comments, and related entities.
 */

// ========================
// Task
// ========================

export type TaskStatus = "todo" | "in_progress" | "paused" | "completed" | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface Task {
  id: string;
  title: string;
  description: string | null;
  slug: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  completed_at: string | null;
  assigned_to: string | null;
  created_by: string;
  stream_id: string | null;
  parent_id: string | null;
  category_id: string | null;
  client_id: string | null;
  meeting_id: string | null;
  position: number;
  work_type?: string | null;
  project_id?: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  // Joined relations
  clients?: { name: string } | null;
  meetings?: { title: string } | null;
  assigned_user?: { full_name: string; email: string } | null;
  stream?: { name: string; color: string; slug: string } | null;
  category?: { name: string; color: string } | null;
  subtasks?: Task[];
  comment_count?: number;
}

export interface TaskFormData {
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date?: string;
  assigned_to?: string;
  stream_id?: string;
  parent_id?: string;
  category_id?: string;
  client_id?: string;
  meeting_id?: string;
}

export interface TaskFilters {
  status?: TaskStatus | "all";
  priority?: TaskPriority | "all";
  assigned_to?: string;
  stream_id?: string;
  category_id?: string;
  view?: TaskView;
  search?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
}

export type TaskView =
  | "all"
  | "today"
  | "this_week"
  | "overdue"
  | "delegated"
  | "my_tasks"
  | "allMine"
  | "jira"
  | "clickup"
  | "activecollab"
  | "workamajig";

// ========================
// Task Stream
// ========================

export interface TaskStream {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  color: string;
  is_archived: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  task_count?: number;
  member_count?: number;
}

export interface TaskStreamMember {
  id: string;
  stream_id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
  joined_at: string;
  user?: { full_name: string; email: string };
}

// ========================
// Task Comment
// ========================

export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string | null;
  content: string;
  parent_comment_id: string | null;
  is_edited: boolean;
  created_at: string;
  updated_at: string;
  jira_comment_id?: string | null;
  jira_author_name?: string | null;
  jira_author_email?: string | null;
  user?: { full_name: string; email: string; avatar_url: string | null };
  replies?: TaskComment[];
}

// ========================
// Task Category
// ========================

export interface TaskCategory {
  id: string;
  name: string;
  slug: string | null;
  color: string | null;
  sort_order: number | null;
  created_at: string | null;
  description?: string | null;
  icon?: string | null;
  is_active?: boolean | null;
  parent_id?: string | null;
}

export interface TaskCategoryAccessRule {
  id: string;
  category_id: string;
  role: string;
  role_id: string | null;
  access_level: "full" | "read_only";
  created_at: string | null;
}

// ========================
// Task Attachment
// ========================

export interface TaskAttachment {
  id: string;
  task_id: string;
  file_name: string;
  file_size: number | null;
  file_type: string | null;
  storage_path: string;
  uploaded_by: string | null;
  created_at: string;
}

// ========================
// Stats
// ========================

export interface TaskStats {
  total: number;
  todo: number;
  in_progress: number;
  completed: number;
  overdue: number;
  todayCount?: number;
  thisWeekCount?: number;
  delegatedCount?: number;
  allMineCount?: number;
  jiraCount?: number;
  clickupCount?: number;
  activecollabCount?: number;
  workamajigCount?: number;
}
