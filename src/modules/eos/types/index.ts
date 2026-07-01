/**
 * EOS Module Types
 *
 * Type definitions for VTO, OKRs, Issues, Scorecard, Accountability, and Pods.
 */

// ========================
// Pods
// ========================

export interface EOSPod {
  id: string;
  name: string;
  description: string | null;
  color: string;
  lead_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  lead?: { full_name: string; email: string } | null;
}

// ========================
// VTO (Vision/Traction Organizer)
// ========================

export interface VTOSection {
  id: string;
  section: string;
  title: string;
  content: Record<string, unknown>;
  sort_order: number;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export type VTOSectionKey =
  | "core_values"
  | "core_focus"
  | "ten_year_target"
  | "marketing_strategy"
  | "three_year_picture"
  | "one_year_plan"
  | "quarterly_rocks"
  | "issues_list";

// ========================
// OKRs
// ========================

export type OKRStatus =
  | "draft"
  | "active"
  | "at_risk"
  | "behind"
  | "on_track"
  | "completed"
  | "closed";

export type OKRType = "company" | "team" | "personal";

export type RockStatus = "on_track" | "at_risk" | "off_track" | "completed";

export interface OKR {
  id: string;
  title: string;
  description: string | null;
  owner_id: string | null;
  status: OKRStatus;
  quarter: string;
  start_date: string | null;
  end_date: string | null;
  progress: number;
  pod_id: string | null;
  parent_okr_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  okr_type?: OKRType | "rock";
  year?: number | null;
  is_archived?: boolean | null;
  updated_by?: string | null;
  rock_status?: RockStatus | null;
  progress_pct?: number | null;
  department_id?: string | null;
  tenant_id?: string | null;
  // Joined relations
  owner?: { full_name: string; email: string } | null;
  pod?: Pick<EOSPod, 'id' | 'name' | 'color' | 'is_active'> | EOSPod | null;
  key_results?: OKRKeyResult[];
}

export interface OKRKeyResult {
  id: string;
  okr_id: string;
  title: string;
  description: string | null;
  metric_type: "number" | "percentage" | "currency" | "boolean";
  current_value: number;
  target_value: number;
  start_value: number;
  unit: string;
  status: "not_started" | "on_track" | "at_risk" | "behind" | "completed";
  owner_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  update_frequency?: "daily" | "weekly" | "biweekly" | "monthly" | null;
  last_updated_at?: string | null;
  next_update_due?: string | null;
  is_completed?: boolean | null;
  completed_at?: string | null;
  owner?: { full_name: string; email: string } | null;
}

export interface OKRCheckIn {
  id: string;
  okr_id: string;
  key_result_id: string | null;
  user_id: string;
  previous_value: number | null;
  new_value: number;
  confidence: "low" | "medium" | "high";
  notes: string | null;
  created_at: string;
  user?: { full_name: string; email: string } | null;
}

export interface OKRFormData {
  title: string;
  description?: string;
  owner_id?: string;
  status?: OKRStatus;
  quarter: string;
  year?: number;
  start_date?: string;
  end_date?: string;
  pod_id?: string;
  parent_okr_id?: string;
  okr_type?: OKRType;
}

export interface CreateKeyResultInput {
  title: string;
  description?: string;
  metric_type?: "number" | "percentage" | "currency" | "boolean";
  unit?: string;
  start_value: number;
  target_value: number;
  owner_id?: string;
  update_frequency?: "daily" | "weekly" | "biweekly" | "monthly";
}

export interface CreateOKRInput extends OKRFormData {
  key_results?: CreateKeyResultInput[];
}

export interface OKRFilters {
  status?: OKRStatus | "all";
  quarter?: string | string[];
  owner_id?: string;
  pod_id?: string;
  search?: string;
  tab?: "my" | "team" | "company" | "okr-health" | "key-results" | "closed";
}

export interface OKRStats {
  total: number;
  active: number;
  at_risk: number;
  completed: number;
  avg_progress: number;
}

// ========================
// Issues
// ========================

export type IssueStatus = "open" | "in_progress" | "solved" | "archived";
export type IssuePriority = "low" | "medium" | "high" | "critical";
export type IssueCategory = "people" | "process" | "system" | "external";
export type IssueSource = "manual" | "meeting" | "project" | "ai";

export interface EOSIssue {
  id: string;
  title: string;
  description: string | null;
  status: IssueStatus;
  priority: IssuePriority;
  category: IssueCategory;
  pod_id: string | null;
  assigned_to: string | null;
  reported_by: string | null;
  is_anonymous: boolean;
  source: IssueSource;
  meeting_id: string | null;
  solved_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined relations
  pod?: EOSPod | null;
  assignee?: { full_name: string; email: string } | null;
  reporter?: { full_name: string; email: string } | null;
  suggestion_count?: number;
}

export interface EOSIssueFormData {
  title: string;
  description?: string;
  status?: IssueStatus;
  priority?: IssuePriority;
  category?: IssueCategory;
  pod_id?: string;
  assigned_to?: string;
  is_anonymous?: boolean;
  source?: IssueSource;
}

export interface IssueFilters {
  status?: IssueStatus | "all";
  priority?: IssuePriority | "all";
  category?: IssueCategory | "all";
  pod_id?: string;
  assigned_to?: string;
  search?: string;
}

export interface IssueStats {
  total: number;
  open: number;
  in_progress: number;
  solved: number;
  archived: number;
  critical: number;
}

export interface EOSIssueSuggestion {
  id: string;
  issue_id: string;
  suggestion_type: "root_cause" | "action_item" | "related_pattern";
  content: string;
  confidence: number;
  status: "pending" | "accepted" | "rejected";
  reviewed_by: string | null;
  reviewed_at: string | null;
  ai_model: string | null;
  created_at: string;
}

// ========================
// Scorecard
// ========================

export interface EOSScorecard {
  id: string;
  name: string;
  description: string | null;
  owner_id: string | null;
  pod_id: string | null;
  frequency: "weekly" | "monthly" | "quarterly";
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  owner?: { full_name: string; email: string } | null;
  metrics?: EOSScorecardMetric[];
}

export interface EOSScorecardMetric {
  id: string;
  scorecard_id: string;
  name: string;
  description: string | null;
  metric_type: "number" | "percentage" | "currency" | "boolean";
  target_value: number | null;
  current_value: number;
  unit: string;
  goal_direction: "higher_is_better" | "lower_is_better" | "target";
  week_of: string | null;
  status: "on_track" | "off_track" | "needs_attention";
  sort_order: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ========================
// Accountability
// ========================

export interface AccountabilityChart {
  id: string;
  name: string;
  description: string | null;
  is_current: boolean;
  version: number;
  published_at: string | null;
  published_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  responsibilities?: AccountabilityResponsibility[];
}

export interface AccountabilityResponsibility {
  id: string;
  chart_id: string;
  user_id: string | null;
  role_title: string;
  department: string | null;
  reports_to: string | null;
  responsibilities: string[];
  sort_order: number;
  created_at: string;
  updated_at: string;
  // Joined
  user?: { full_name: string; email: string } | null;
  gwc?: GWCAssessment | null;
  direct_reports?: AccountabilityResponsibility[];
}

export interface GWCAssessment {
  id: string;
  responsibility_id: string;
  assessor_id: string;
  gets_it: boolean;
  wants_it: boolean;
  has_capacity: boolean;
  notes: string | null;
  assessment_date: string;
  created_at: string;
}

// ========================
// SLA Targets (accountability analytics)
// ========================

export interface EOSSLATarget {
  id: string;
  pod_id: string | null;
  role_name: string | null;
  approval_rate_pct: number;
  cycle_time_days: number;
  created_at: string;
  updated_at: string;
  pod?: EOSPod | null;
}

export interface EOSSLATargetForm {
  approval_rate_pct: number;
  cycle_time_days: number;
}

// ========================
// EOS Stats (hub overview)
// ========================

export interface EOSStats {
  okrs: { total: number; active: number; completed: number; at_risk: number };
  issues: IssueStats;
  scorecard: { total_metrics: number; on_track: number; off_track: number };
}

// ========================
// EOS Revamp types
// ========================

export type CoreValueRating = "+++" | "++" | "+" | "-" | "--";

export type PeopleReviewOverall = "excellent" | "good" | "needs_attention";

export interface EOSPeopleReview {
  id: string;
  user_id: string;
  reviewer_id: string;
  review_period: string;
  core_values_scores: Record<string, CoreValueRating>;
  gwc_gets_it: boolean | null;
  gwc_wants_it: boolean | null;
  gwc_has_capacity: boolean | null;
  overall_score: PeopleReviewOverall;
  notes: string | null;
  created_at: string;
  updated_at: string;
  user?: { full_name: string; email: string } | null;
  reviewer?: { full_name: string; email: string } | null;
}

export interface EOSIssueComment {
  id: string;
  issue_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  user?: { full_name: string; email: string } | null;
}

export interface EOSVTOVersion {
  id: string;
  vto_id: string;
  section: string;
  content: Record<string, unknown>;
  version: number;
  updated_by: string | null;
  created_at: string;
}

export type L10SectionKey =
  | "segue"
  | "scorecard_review"
  | "rock_review"
  | "customer_headlines"
  | "employee_headlines"
  | "todo_review"
  | "ids"
  | "conclusion";

export interface EOSL10Section {
  id: string;
  meeting_id: string;
  section_key: L10SectionKey;
  duration_minutes: number;
  notes: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export type EOSTodoSourceType = "meeting" | "ids" | "rock";

export interface EOSTodo {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  priority: string | null;
  assigned_to: string | null;
  eos_source_type: EOSTodoSourceType | null;
  eos_source_id: string | null;
  created_at: string;
  assignee?: { full_name: string; email: string } | null;
}

export interface EOSDashboardData {
  visionProgress: { annual: number; quarterly: number };
  rocksSummary: Record<RockStatus, number>;
  scorecardSummary: { healthy: number; warning: number; off_track: number };
  meetings: { upcoming: number; missed: number };
  idsSummary: { open: number; resolved: number };
  teamHealthScore: number;
}

export const L10_SECTION_LABELS: Record<L10SectionKey, string> = {
  segue: "Segue",
  scorecard_review: "Scorecard Review",
  rock_review: "Rock Review",
  customer_headlines: "Customer Headlines",
  employee_headlines: "Employee Headlines",
  todo_review: "Todo Review",
  ids: "IDS",
  conclusion: "Conclusion",
};

export const ROCK_STATUS_LABELS: Record<RockStatus, string> = {
  on_track: "On Track",
  at_risk: "At Risk",
  off_track: "Off Track",
  completed: "Completed",
};

/** UI label for issue status — maps in_progress to In Discussion */
export const ISSUE_STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In Discussion",
  in_discussion: "In Discussion",
  solved: "Solved",
  closed: "Closed",
  archived: "Archived",
};
