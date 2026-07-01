/**
 * Productivity Module Types
 */

export interface Department {
  id: string;
  name: string;
  description: string | null;
  manager_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  manager?: { full_name: string } | null;
}

export interface Pod {
  id: string;
  name: string;
  department_id: string | null;
  description: string | null;
  lead_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  department?: { name: string } | null;
  lead?: { full_name: string } | null;
  member_count?: number;
}

export interface PodMember {
  id: string;
  pod_id: string;
  user_id: string;
  role: "lead" | "member";
  joined_at: string;
  user?: { full_name: string; email: string } | null;
}

export interface EmployeeProfile {
  id: string;
  user_id: string | null;
  email: string;
  full_name: string;
  department_id: string | null;
  title: string | null;
  manager_email: string | null;
  hire_date: string | null;
  location: string | null;
  employment_type: "full-time" | "part-time" | "contractor" | "intern";
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  department?: { name: string } | null;
}

export interface ProductivityRecord {
  id: string;
  employee_email: string;
  week_start: string;
  week_number: number;
  year: number;
  total_hours: number;
  billable_hours: number;
  tasks_completed: number;
  tasks_assigned: number;
  meetings_attended: number;
  utilization_pct: number;
  efficiency_score: number;
  attendance_status: "present" | "partial" | "absent" | "leave";
  department: string | null;
  location: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface LeaveEvent {
  id: string;
  employee_email: string;
  leave_type: "pto" | "sick" | "personal" | "holiday" | "other";
  start_date: string;
  end_date: string;
  is_half_day: boolean;
  notes: string | null;
  approved_by: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  created_at: string;
}

export interface ProcessCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  document_count?: number;
}

export interface ProcessDocument {
  id: string;
  category_id: string;
  title: string;
  slug: string;
  content: string | null;
  file_url: string | null;
  version: number;
  status: "draft" | "published" | "archived";
  tags: string[];
  created_by: string | null;
  updated_by: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  category?: { name: string; slug: string } | null;
  author?: { full_name: string } | null;
}

export interface ProductivityAlert {
  id: string;
  employee_email: string;
  alert_type: "low_utilization" | "declining_trend" | "high_performer" | "absence_pattern" | "workload_imbalance";
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string | null;
  week_start: string | null;
  is_read: boolean;
  dismissed_at: string | null;
  created_at: string;
}

export interface AIProductivityInsight {
  id: string;
  employee_email: string | null;
  department: string | null;
  pod_id: string | null;
  insight_type: "individual" | "department" | "pod" | "company";
  week_start: string | null;
  title: string;
  content: string;
  recommendations: string[] | null;
  confidence_score: number | null;
  model_used: string | null;
  created_at: string;
}

export interface ProductivityFilters {
  department?: string;
  location?: string;
  week_start?: string;
  search?: string;
}

export interface ProductivitySummary {
  total_employees: number;
  avg_utilization: number;
  avg_efficiency: number;
  total_tasks_completed: number;
  departments: { name: string; avg_utilization: number; employee_count: number }[];
}

// ========== Path B: Base project (EmployeeProductivity) types ==========

export interface EmployeeBase {
  id: string;
  name: string;
  email: string;
  title: string | null;
  role: string | null;
  reportingManagerId: string | null;
  reportingManagerEmail: string | null;
  reportingManagerName: string | null;
  dottedLineManagerEmail: string | null;
  location: string | null;
  department: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  deleted_at: string | null;
}

export interface ActionItemBase {
  id: string;
  email: string;
  summary: string | null;
  status: string | null;
  priority: "high" | "medium" | "low" | null;
  week: string | null;
  excludeFromScoring: boolean;
  createdDate: string;
  updatedAt: string;
  deleted_at: string | null;
}

export interface EmployeeProductivityBase {
  id: string;
  week: string;
  email: string;
  name: string | null;
  employee_code: unknown;
  location: string | null;
  department: string | null;
  computer_name: string | null;
  computer_activities_hr: string | null;
  productive_time_hr: string | null;
  productivity_percentage: number | null;
  unproductive_time_hr: string | null;
  unproductivity_percentage: string | null;
  neutral_time_hr: string | null;
  present_days: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeWithActionItems extends EmployeeBase {
  actionItems?: ActionItemBase[];
}

export interface EmployeeProductivityWithEmployee extends EmployeeProductivityBase {
  Employee?: EmployeeWithActionItems;
  employee?: EmployeeWithActionItems;
}

export interface ProductivityMetricsData {
  averageProductivity: number;
  totalEmployees: number;
  highPerformers: number;
  averagePerformers: number;
  lowPerformers: number;
  averageBillableHours?: number;
  latestMonthForBillableHours?: string;
  week: string | null;
}

export interface ProductivityMetricsResponse {
  success: boolean;
  data: ProductivityMetricsData;
}

export interface ProductivityPagination {
  page: number;
  hasNextPage: boolean;
  total: number;
  limit?: number;
  totalRecords?: number;
  totalPages?: number;
  hasPreviousPage?: boolean;
}

export interface EmployeeProductivityListResponse {
  success: boolean;
  data: {
    data: EmployeeProductivityWithEmployee[];
    pagination: ProductivityPagination;
  };
}

export interface DepartmentProductivityData {
  department: string;
  averageProductivity?: number;
  avgProductivity?: number;
  employeeCount: number;
  totalHours?: number;
  totalPresentDays?: number;
}
