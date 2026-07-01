/**
 * Employee Directory Hook
 * Fetch all employees with profileId mapping for pod management
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EmployeeDirectoryItem {
  id: string;
  email: string;
  full_name: string;
  title: string | null;
  department: string | null;
  location: string | null;
  user_id: string | null;
  has_login: boolean;
}

// ============================================
// QUERY KEYS
// ============================================
export const employeeDirectoryKeys = {
  all: ['employee-directory'] as const,
  list: () => [...employeeDirectoryKeys.all, 'list'] as const,
};

/**
 * Fetch all employees with profile mapping
 */
export function useEmployeeDirectory() {
  return useQuery({
    queryKey: employeeDirectoryKeys.list(),
    queryFn: async (): Promise<EmployeeDirectoryItem[]> => {
      // Try employee_profiles first
      const { data: employees, error: employeesError } = await supabase
        .from('employee_profiles')
        .select('id, email, full_name, title, location, user_id, department_id')
        .eq('is_active', true)
        .order('full_name');

      if (employeesError) {
        // Fallback: try Employee table if employee_profiles doesn't exist
        const { data: employeeData, error: employeeError } = await (supabase as any)
          .from('Employee')
          .select('id, email, name, title, location, department')
          .eq('status', 'active')
          .order('name');

        if (employeeError) throw employeeError;

        // Map Employee table to directory format
        return (employeeData || []).map((emp: any) => ({
          id: emp.id,
          email: emp.email,
          full_name: emp.name || emp.email,
          title: emp.title || null,
          department: emp.department || null,
          location: emp.location || null,
          user_id: null,
          has_login: false,
        }));
      }

      // Get department names
      const departmentIds = [...new Set((employees || []).map((e: any) => e.department_id).filter(Boolean))];
      let departmentMap = new Map<string, string>();

      if (departmentIds.length > 0) {
        const { data: departments } = await supabase
          .from('departments')
          .select('id, name')
          .in('id', departmentIds);

        (departments || []).forEach((dept: any) => {
          departmentMap.set(dept.id, dept.name);
        });
      }

      // Map employee_profiles to directory format
      return (employees || []).map((emp: any) => ({
        id: emp.id,
        email: emp.email,
        full_name: emp.full_name || emp.email,
        title: emp.title || null,
        department: emp.department_id ? departmentMap.get(emp.department_id) || null : null,
        location: emp.location || null,
        user_id: emp.user_id || null,
        has_login: !!emp.user_id,
      }));
    },
  });
}
