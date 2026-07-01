/**
 * Employee Pods Hook
 * React Query hook for employee-pod relationships
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { EmployeePod } from '@/types/pods';

// ============================================
// QUERY KEYS
// ============================================
export const employeePodKeys = {
  all: ['employee-pods'] as const,
  pod: (podId: string) => [...employeePodKeys.all, 'pod', podId] as const,
  employee: (employeeId: string) => [...employeePodKeys.all, 'employee', employeeId] as const,
};

// ============================================
// QUERIES
// ============================================

/**
 * Fetch employee pods for a specific pod
 */
export function useEmployeePods(podId: string | undefined) {
  return useQuery({
    queryKey: employeePodKeys.pod(podId || ''),
    queryFn: async (): Promise<EmployeePod[]> => {
      if (!podId) return [];
      const { data, error } = await (supabase as any)
        .from('employee_pods')
        .select('*')
        .eq('pod_id', podId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as EmployeePod[];
    },
    enabled: !!podId,
  });
}

