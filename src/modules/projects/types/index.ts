/**
 * Projects Module Types
 */

export interface ProjectStatus {
  id: string;
  name: string;
  slug: string;
  color: string;
  sort_order: number;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status_id: string | null;
  client_id: string | null;
  source_deal_id: string | null;
  owner_id: string | null;
  start_date: string | null;
  end_date: string | null;
  budget: number | null;
  currency: string;
  is_archived: boolean;
  external_id: string | null;
  external_provider: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined (when fetched with select join, e.g. in useProject for detail)
  status?: ProjectStatus | null;
  owner?: { full_name: string; email: string } | null;
  members_count?: number;
  milestones_count?: number;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: "owner" | "manager" | "member" | "viewer";
  joined_at: string;
  user?: { full_name: string; email: string; avatar_url?: string } | null;
}

export interface ProjectMilestone {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: "pending" | "in_progress" | "completed" | "overdue";
  completed_at: string | null;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectComment {
  id: string;
  project_id: string;
  user_id: string;
  content: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
  user?: { full_name: string; email: string } | null;
}

export interface ProjectFile {
  id: string;
  project_id: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  storage_path: string | null;
  source: "upload" | "google_drive" | "activecollab";
  uploaded_by: string | null;
  created_at: string;
}

export interface ProjectRisk {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "mitigated" | "resolved" | "accepted";
  mitigation: string | null;
  reported_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectBilling {
  id: string;
  project_id: string;
  billing_type: "fixed" | "hourly" | "monthly" | "per_task";
  rate: number | null;
  total_budget: number | null;
  invoiced_amount: number;
  currency: string;
  payment_terms: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectInvoice {
  id: string;
  project_id: string;
  invoice_number: string;
  amount: number;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  due_date: string | null;
  paid_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectFormData {
  name: string;
  description?: string;
  status_id?: string;
  client_id?: string;
  owner_id?: string;
  start_date?: string;
  end_date?: string;
  budget?: number;
}

export interface ProjectFilters {
  status_id?: string;
  owner_id?: string;
  client_id?: string;
  search?: string;
  is_archived?: boolean;
  date_from?: string;
  date_to?: string;
  show_over_budget_only?: boolean;
  sort_by?: "name" | "start_date" | "end_date" | "updated_at" | "over_budget_gap";
  sort_asc?: boolean;
  page?: number;
  page_size?: number;
  /** Filter by external PM provider slug, or "internal" for non-synced projects */
  external_provider?: string;
}

export type ProjectTab =
  | "overview"
  | "tasks"
  | "milestones"
  | "meetings"
  | "files"
  | "billing"
  | "finance"
  | "issues"
  | "members"
  | "client_portal"
  | "integrations"
  | "checklist"
  | "risks"
  | "concerns";
