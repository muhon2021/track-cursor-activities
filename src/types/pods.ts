/**
 * Pod Management Types
 * Type definitions for pod management system
 */

export interface Pod {
  id: string;
  name: string;
  description: string | null;
  color: string;
  is_active: boolean;
  show_in_resource_projection: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PodWithStats extends Pod {
  hr_synced_count: number;
  rp_members_count: number;
  has_login_count: number;
  no_login_count: number;
}

export interface PodEmployee {
  id: string;
  pod_id: string;
  user_id: string | null;
  employee_id: string | null;
  has_login: boolean;
  source: 'manual' | 'synced';
  is_active: boolean;
  role: 'manager' | 'member' | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeePod {
  id: string;
  employee_id: string;
  pod_id: string;
  is_primary: boolean;
  synced_from_hr: boolean;
  created_at: string;
  updated_at: string;
}

export interface PodPermission {
  id: string;
  pod_id: string;
  module_id: string;
  created_at: string;
}

export interface AppModule {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  page_route: string | null;
  category: string;
  is_core: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PodMember {
  id: string;
  pod_id: string;
  user_id: string | null;
  employee_id: string | null;
  has_login: boolean;
  source: 'manual' | 'synced';
  role: 'manager' | 'member' | null;
  // Resolved employee data
  employee?: {
    id: string;
    name?: string;
    email?: string;
    full_name?: string;
    title?: string;
    department?: string;
    location?: string;
  };
  // Resolved profile data
  profile?: {
    id: string;
    email: string;
    full_name: string;
  };
}

export interface PodManager {
  id: string;
  pod_id: string;
  user_id: string | null;
  employee_id: string | null;
  name: string;
  email: string;
}

export interface PodMemberPerformance {
  employee_id: string;
  employee_name: string;
  email: string;
  department: string | null;
  location: string | null;
  productivity_pct: number | null;
  role: 'manager' | 'member' | null;
}

export interface PodHealthRecord {
  pod_id: string;
  pod_name: string;
  pod_color: string;
  manager_id: string | null;
  manager_name: string | null;
  member_count: number;
  throughput_pct: number;
  sla_adherence_pct: number;
  coaching_needs_count: number;
  is_out_of_sla: boolean;
}

export interface PodHealthStats {
  pods_tracked: number;
  avg_throughput_pct: number;
  sla_adherence_pct: number;
  coaching_needs_count: number;
}

export interface PodFormData {
  name: string;
  description: string;
  color: string;
  show_in_resource_projection: boolean;
  members?: string[]; // employee_ids
  permissions?: string[]; // module_ids
}

export interface PodOption {
  id: string;
  name: string;
  color: string;
  description: string | null;
  member_count?: number;
}

