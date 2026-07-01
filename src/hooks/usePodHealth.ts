/**
 * Pod Health Hooks
 * React Query hooks for pod health and performance tracking
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { PodHealthRecord, PodHealthStats, PodMemberPerformance } from '@/types/pods';

// Local row types for tables not yet in the generated Supabase types
type PodEmployeeRow = {
  pod_id: string;
  employee_id: string | null;
  user_id: string | null;
  role?: string;
};

type EmployeeProfileRow = {
  id: string;
  email: string;
  full_name?: string | null;
  department?: string | null;
  location?: string | null;
};

// Helper to query a table whose name is not yet in generated types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const untypedFrom = (table: string) =>
  (supabase as any).from(table);

// ============================================
// QUERY KEYS
// ============================================
export const podHealthKeys = {
  all: ['pods', 'health'] as const,
  stats: () => [...podHealthKeys.all, 'stats'] as const,
  records: () => [...podHealthKeys.all, 'records'] as const,
  pod: (podId: string) => [...podHealthKeys.all, 'pod', podId] as const,
  members: (podId: string) => [...podHealthKeys.all, 'members', podId] as const,
};

// ============================================
// QUERIES
// ============================================

/**
 * Fetch aggregated pod health KPIs
 */
export function usePodHealth() {
  return useQuery({
    queryKey: podHealthKeys.stats(),
    queryFn: async (): Promise<PodHealthStats> => {
      // Get all active pods with members
      const { data: pods, error: podsError } = await supabase
        .from('pods')
        .select('id, name')
        .eq('is_active', true);

      if (podsError) throw podsError;

      const { data: rawPodEmployees } = await untypedFrom('pod_employees')
        .select('pod_id, employee_id, user_id')
        .eq('is_active', true);
      const podEmployees = (rawPodEmployees || []) as PodEmployeeRow[];

      if (podEmployees.length === 0) {
        return {
          pods_tracked: 0,
          avg_throughput_pct: 0,
          sla_adherence_pct: 0,
          coaching_needs_count: 0,
        };
      }

      // Get employee emails for productivity lookup
      const employeeIds = [...new Set(podEmployees.map((pe) => pe.employee_id).filter(Boolean))] as string[];

      // Try to get employee emails from employee_profiles
      const { data: rawEmployees } = await untypedFrom('employee_profiles')
        .select('id, email')
        .in('id', employeeIds);
      const employees = (rawEmployees || []) as EmployeeProfileRow[];

      const emailMap = new Map<string, string>();
      employees.forEach((emp) => {
        if (emp.id && emp.email) {
          emailMap.set(emp.id, emp.email);
        }
      });

      // Get latest productivity records (current week or most recent)
      const { data: productivity } = await supabase
        .from('productivity_records')
        .select('employee_email, utilization_pct, efficiency_score')
        .order('week_start', { ascending: false })
        .limit(1000); // Get recent records

      // Group by employee email
      const productivityMap = new Map<string, { utilization: number; efficiency: number }>();
      (productivity || []).forEach((prod) => {
        if (!productivityMap.has(prod.employee_email)) {
          productivityMap.set(prod.employee_email, {
            utilization: prod.utilization_pct || 0,
            efficiency: prod.efficiency_score || 0,
          });
        }
      });

      // Calculate metrics per pod
      let totalThroughput = 0;
      let totalSlaAdherent = 0;
      let totalMembers = 0;
      let coachingNeeds = 0;

      pods?.forEach((pod) => {
        const members = podEmployees.filter((pe) => pe.pod_id === pod.id);
        if (members.length === 0) return;

        let podThroughput = 0;
        let podSlaAdherent = 0;
        let podMembersWithData = 0;

        members.forEach((member) => {
          const email = member.employee_id ? emailMap.get(member.employee_id) : null;
          if (!email) return;

          const prod = productivityMap.get(email);
          if (!prod) return;

          const productivity = (prod.utilization + prod.efficiency) / 2;
          podThroughput += productivity;
          podMembersWithData += 1;

          if (productivity >= 85) {
            podSlaAdherent += 1;
          }
          if (productivity < 60) {
            coachingNeeds += 1;
          }
        });

        if (podMembersWithData > 0) {
          totalThroughput += podThroughput / podMembersWithData;
          totalSlaAdherent += podSlaAdherent;
          totalMembers += podMembersWithData;
        }
      });

      const podsTracked = (pods || []).length;
      const avgThroughput = podsTracked > 0 ? totalThroughput / podsTracked : 0;
      const slaAdherence = totalMembers > 0 ? (totalSlaAdherent / totalMembers) * 100 : 0;

      return {
        pods_tracked: podsTracked,
        avg_throughput_pct: Math.round(avgThroughput * 10) / 10,
        sla_adherence_pct: Math.round(slaAdherence * 10) / 10,
        coaching_needs_count: coachingNeeds,
      };
    },
  });
}

/**
 * Fetch pod health records for all pods
 */
export function usePodHealthRecords() {
  return useQuery({
    queryKey: podHealthKeys.records(),
    queryFn: async (): Promise<PodHealthRecord[]> => {
      const { data: podsRaw, error: podsError } = await supabase
        .from('pods')
        .select('id, name, color')
        .eq('is_active', true)
        .eq('show_in_resource_projection', true);

      if (podsError) throw podsError;
      const pods = podsRaw;

      const { data: rawPodEmployees2 } = await untypedFrom('pod_employees')
        .select('pod_id, employee_id, user_id, role')
        .eq('is_active', true);
      const podEmployees = (rawPodEmployees2 || []) as (PodEmployeeRow & { role?: string })[];

      // Get managers
      const managers = podEmployees.filter((pe) => pe.role === 'manager');
      const managerMap = new Map<string, typeof managers[0]>();
      managers.forEach((m) => {
        managerMap.set(m.pod_id, m);
      });

      // Get employee emails
      const employeeIds = [...new Set(podEmployees.map((pe) => pe.employee_id).filter(Boolean))] as string[];
      const { data: rawEmployees2 } = await untypedFrom('employee_profiles')
        .select('id, email, full_name')
        .in('id', employeeIds);
      const employees = (rawEmployees2 || []) as EmployeeProfileRow[];

      const emailMap = new Map<string, string>();
      const nameMap = new Map<string, string>();
      employees.forEach((emp) => {
        if (emp.id && emp.email) {
          emailMap.set(emp.id, emp.email);
          nameMap.set(emp.id, emp.full_name || emp.email);
        }
      });

      // Get productivity data
      const emails = [...emailMap.values()];
      const { data: productivity } = await supabase
        .from('productivity_records')
        .select('employee_email, utilization_pct, efficiency_score')
        .in('employee_email', emails)
        .order('week_start', { ascending: false })
        .limit(1000);

      const productivityMap = new Map<string, number>();
      (productivity || []).forEach((prod) => {
        if (!productivityMap.has(prod.employee_email)) {
          const avg = ((prod.utilization_pct || 0) + (prod.efficiency_score || 0)) / 2;
          productivityMap.set(prod.employee_email, avg);
        }
      });

      // Calculate metrics per pod
      const records: PodHealthRecord[] = (pods || []).map((pod) => {
        const members = podEmployees?.filter((pe) => pe.pod_id === pod.id) || [];
        const manager = managerMap.get(pod.id);

        let throughputSum = 0;
        let slaAdherent = 0;
        let coachingNeeds = 0;
        let membersWithData = 0;

        members.forEach((member) => {
          const email = member.employee_id ? emailMap.get(member.employee_id) : null;
          if (!email) return;

          const productivity = productivityMap.get(email);
          if (productivity === undefined) return;

          throughputSum += productivity;
          membersWithData += 1;

          if (productivity >= 85) {
            slaAdherent += 1;
          }
          if (productivity < 60) {
            coachingNeeds += 1;
          }
        });

        const throughput = membersWithData > 0 ? throughputSum / membersWithData : 0;
        const slaAdherence = membersWithData > 0 ? (slaAdherent / membersWithData) * 100 : 0;
        const isOutOfSla = slaAdherence < 90;

        // Get manager name
        let managerName: string | null = null;
        if (manager?.employee_id) {
          managerName = nameMap.get(manager.employee_id) || null;
        }

        return {
          pod_id: pod.id,
          pod_name: pod.name,
          pod_color: pod.color || '#3b82f6',
          manager_id: manager?.user_id || null,
          manager_name: managerName,
          member_count: members.length,
          throughput_pct: Math.round(throughput * 10) / 10,
          sla_adherence_pct: Math.round(slaAdherence * 10) / 10,
          coaching_needs_count: coachingNeeds,
          is_out_of_sla: isOutOfSla,
        };
      });

      return records;
    },
  });
}

/**
 * Fetch member performance for a specific pod
 */
export function usePodMemberPerformance(podId: string | undefined) {
  return useQuery({
    queryKey: podHealthKeys.members(podId || ''),
    queryFn: async (): Promise<PodMemberPerformance[]> => {
      if (!podId) return [];

      const { data: rawPodMembers, error: peError } = await untypedFrom('pod_employees')
        .select('employee_id, user_id, role')
        .eq('pod_id', podId)
        .eq('is_active', true);

      if (peError) throw peError;
      const podEmployees = (rawPodMembers || []) as PodEmployeeRow[];
      if (podEmployees.length === 0) return [];

      const employeeIds = podEmployees.map((pe) => pe.employee_id).filter(Boolean) as string[];
      const { data: rawEmpProfiles } = await untypedFrom('employee_profiles')
        .select('id, email, full_name, department, location')
        .in('id', employeeIds);
      const employees = (rawEmpProfiles || []) as EmployeeProfileRow[];

      const employeeMap = new Map<string, EmployeeProfileRow>();
      employees.forEach((emp) => {
        employeeMap.set(emp.id, emp);
      });

      const emails = employees.map((e) => e.email).filter(Boolean);
      const { data: productivity } = await supabase
        .from('productivity_records')
        .select('employee_email, utilization_pct, efficiency_score')
        .in('employee_email', emails)
        .order('week_start', { ascending: false })
        .limit(1000);

      const productivityMap = new Map<string, number>();
      (productivity || []).forEach((prod) => {
        if (!productivityMap.has(prod.employee_email)) {
          const avg = ((prod.utilization_pct || 0) + (prod.efficiency_score || 0)) / 2;
          productivityMap.set(prod.employee_email, avg);
        }
      });

      const performances: PodMemberPerformance[] = podEmployees
        .map((pe) => {
          const emp = pe.employee_id ? employeeMap.get(pe.employee_id) : null;
          if (!emp) return null;

          const productivity = productivityMap.get(emp.email) || null;

          return {
            employee_id: pe.employee_id || '',
            employee_name: emp.full_name || emp.email,
            email: emp.email,
            department: emp.department || null,
            location: emp.location || null,
            productivity_pct: productivity,
            role: (pe.role as 'manager' | 'member') || null,
          };
        })
        .filter(Boolean) as PodMemberPerformance[];

      return performances.sort((a, b) => {
        // Sort by productivity descending, then by name
        if (a.productivity_pct !== null && b.productivity_pct !== null) {
          return b.productivity_pct - a.productivity_pct;
        }
        if (a.productivity_pct !== null) return -1;
        if (b.productivity_pct !== null) return 1;
        return a.employee_name.localeCompare(b.employee_name);
      });
    },
    enabled: !!podId,
  });
}

// ============================================
// MUTATIONS
// ============================================

/**
 * Assign a pod manager
 */
export function useAssignPodManager() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      podId,
      employeeId,
    }: {
      podId: string;
      employeeId: string | null;
    }): Promise<void> => {
      // First, remove existing manager role from this pod
      await supabase
        .from('pod_employees')
        .update({ role: 'member' })
        .eq('pod_id', podId)
        .eq('role', 'manager');

      // If employeeId is provided, set as manager
      if (employeeId) {
        // Check if employee is already in pod
        const { data: existing } = await supabase
          .from('pod_employees')
          .select('id')
          .eq('pod_id', podId)
          .eq('employee_id', employeeId)
          .single();

        if (existing) {
          // Update existing
          const { error } = await supabase
            .from('pod_employees')
            .update({ role: 'manager' })
            .eq('id', existing.id);
          if (error) throw error;
        } else {
          // Insert new
          const { error } = await supabase.from('pod_employees').insert({
            pod_id: podId,
            employee_id: employeeId,
            role: 'manager',
            source: 'manual',
            is_active: true,
          });
          if (error) throw error;
        }
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: podHealthKeys.all });
      queryClient.invalidateQueries({ queryKey: podHealthKeys.members(variables.podId) });
      toast.success('Pod manager assigned successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to assign pod manager');
    },
  });
}

