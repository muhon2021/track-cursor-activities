/**
 * Pod Management Hooks
 * React Query hooks for pod CRUD operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type {
  Pod,
  PodWithStats,
  PodEmployee,
  PodPermission,
  PodOption,
  PodFormData,
} from '@/types/pods';

// ============================================
// QUERY KEYS
// ============================================
export const podKeys = {
  all: ['pods'] as const,
  lists: () => [...podKeys.all, 'list'] as const,
  list: (filters?: string) => [...podKeys.lists(), filters] as const,
  details: () => [...podKeys.all, 'detail'] as const,
  detail: (id: string) => [...podKeys.details(), id] as const,
  withMembers: () => [...podKeys.all, 'with-members'] as const,
  user: (userId: string) => [...podKeys.all, 'user', userId] as const,
  options: () => [...podKeys.all, 'options'] as const,
  stats: () => [...podKeys.all, 'stats'] as const,
};

// ============================================
// QUERIES
// ============================================

/**
 * Fetch all active pods
 */
export function usePods(includeInactive = false) {
  return useQuery({
    queryKey: podKeys.list(includeInactive ? 'all' : 'active'),
    queryFn: async (): Promise<Pod[]> => {
      let query = supabase
        .from('pods')
        .select('*')
        .order('name');

      if (!includeInactive) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Pod[];
    },
  });
}

/**
 * Fetch all pods including inactive
 */
export function useAllPods() {
  return usePods(true);
}

/**
 * Fetch pods with member counts and stats
 */
export function usePodsWithMembers(search?: string) {
  return useQuery({
    queryKey: [...podKeys.withMembers(), search ?? ''],
    queryFn: async (): Promise<PodWithStats[]> => {
      // Use the view if available, otherwise compute manually
      let query = supabase
        .from('pods_with_stats')
        .select('*')
        .order('name');

      if (search?.trim()) {
        const q = search.trim().toLowerCase();
        query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`);
      }

      const { data, error } = await query;

      // Fallback to manual computation if view doesn't exist
      if (error && error.code === '42P01') {
        const { data: pods, error: podsError } = await supabase
          .from('pods')
          .select('*')
          .order('name');

        if (podsError) throw podsError;

        const { data: employeePods } = await supabase
          .from('employee_pods')
          .select('pod_id, employee_id, synced_from_hr');

        const { data: podEmployees } = await supabase
          .from('pod_employees')
          .select('pod_id, employee_id, user_id, has_login, is_active');

        const podsWithStats: PodWithStats[] = (pods || []).map((pod) => {
          const hrSynced = (employeePods || []).filter(
            (ep) => ep.pod_id === pod.id && ep.synced_from_hr
          ).length;
          const rpMembers = (podEmployees || []).filter(
            (pe) => pe.pod_id === pod.id && pe.is_active
          ).length;
          const hasLogin = (podEmployees || []).filter(
            (pe) => pe.pod_id === pod.id && pe.has_login && pe.is_active
          ).length;
          const noLogin = (podEmployees || []).filter(
            (pe) => pe.pod_id === pod.id && !pe.has_login && pe.is_active
          ).length;

          return {
            ...pod,
            hr_synced_count: hrSynced,
            rp_members_count: rpMembers,
            has_login_count: hasLogin,
            no_login_count: noLogin,
          } as PodWithStats;
        });

        if (search?.trim()) {
          const q = search.trim().toLowerCase();
          return podsWithStats.filter(
            (p) =>
              p.name.toLowerCase().includes(q) ||
              (p.description || '').toLowerCase().includes(q)
          );
        }

        return podsWithStats;
      }

      if (error) throw error;
      return (data || []) as PodWithStats[];
    },
  });
}

/**
 * Fetch a single pod by ID
 */
export function usePod(id: string | undefined) {
  return useQuery({
    queryKey: podKeys.detail(id || ''),
    queryFn: async (): Promise<Pod | null> => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('pods')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as Pod;
    },
    enabled: !!id,
  });
}

/**
 * Fetch pods for a specific user
 */
export function useUserPods(userId: string | undefined) {
  return useQuery({
    queryKey: podKeys.user(userId || ''),
    queryFn: async (): Promise<Pod[]> => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('pod_employees')
        .select('pod_id, pods(*)')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (error) throw error;
      return (data || []).map((item: any) => item.pods).filter(Boolean) as Pod[];
    },
    enabled: !!userId,
  });
}

/**
 * Fetch pods as options for selectors
 */
export function usePodOptions(showMemberCount = false) {
  return useQuery({
    queryKey: [...podKeys.options(), showMemberCount],
    queryFn: async (): Promise<PodOption[]> => {
      const { data, error } = await supabase
        .from('pods')
        .select('id, name, color, description, is_active')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      if (showMemberCount) {
        const { data: memberCounts } = await supabase
          .from('pod_employees')
          .select('pod_id')
          .eq('is_active', true);

        const counts = new Map<string, number>();
        (memberCounts || []).forEach((mc) => {
          counts.set(mc.pod_id, (counts.get(mc.pod_id) || 0) + 1);
        });

        return (data || []).map((pod) => ({
          id: pod.id,
          name: pod.name,
          color: pod.color || '#3b82f6',
          description: pod.description,
          member_count: counts.get(pod.id) || 0,
        })) as PodOption[];
      }

      return (data || []).map((pod) => ({
        id: pod.id,
        name: pod.name,
        color: pod.color || '#3b82f6',
        description: pod.description,
      })) as PodOption[];
    },
  });
}

/**
 * Pod lookup by ID (for quick lookups)
 */
export function usePodLookup(podIds: string[]) {
  return useQuery({
    queryKey: [...podKeys.all, 'lookup', podIds.sort().join(',')],
    queryFn: async (): Promise<Map<string, Pod>> => {
      if (podIds.length === 0) return new Map();
      const { data, error } = await supabase
        .from('pods')
        .select('*')
        .in('id', podIds);

      if (error) throw error;
      const map = new Map<string, Pod>();
      (data || []).forEach((pod) => {
        map.set(pod.id, pod as Pod);
      });
      return map;
    },
    enabled: podIds.length > 0,
  });
}

// ============================================
// MUTATIONS
// ============================================

/**
 * Create a new pod
 */
export function useCreatePod() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: PodFormData): Promise<Pod> => {
      const { data: pod, error } = await supabase
        .from('pods')
        .insert({
          name: data.name,
          description: data.description || null,
          color: data.color,
          show_in_resource_projection: data.show_in_resource_projection,
          created_by: user?.id || null,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      // Add members if provided
      if (data.members && data.members.length > 0) {
        const membersToInsert = data.members.map((employeeId) => ({
          pod_id: pod.id,
          employee_id: employeeId,
          source: 'manual' as const,
          is_active: true,
        }));

        const { error: membersError } = await supabase
          .from('pod_employees')
          .insert(membersToInsert);

        if (membersError) throw membersError;
      }

      // Add permissions if provided
      if (data.permissions && data.permissions.length > 0) {
        const permissionsToInsert = data.permissions.map((moduleId) => ({
          pod_id: pod.id,
          module_id: moduleId,
        }));

        const { error: permissionsError } = await supabase
          .from('pod_permissions')
          .insert(permissionsToInsert);

        if (permissionsError) throw permissionsError;
      }

      return pod as Pod;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: podKeys.all });
      toast.success('Pod created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create pod');
    },
  });
}

/**
 * Update a pod
 */
export function useUpdatePod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PodFormData> }): Promise<Pod> => {
      const updateData: any = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description || null;
      if (data.color !== undefined) updateData.color = data.color;
      if (data.show_in_resource_projection !== undefined)
        updateData.show_in_resource_projection = data.show_in_resource_projection;

      const { data: pod, error } = await supabase
        .from('pods')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Update members if provided
      if (data.members !== undefined) {
        // Delete existing manual members
        await supabase
          .from('pod_employees')
          .delete()
          .eq('pod_id', id)
          .eq('source', 'manual');

        // Insert new members
        if (data.members.length > 0) {
          const membersToInsert = data.members.map((employeeId) => ({
            pod_id: id,
            employee_id: employeeId,
            source: 'manual' as const,
            is_active: true,
          }));

          const { error: membersError } = await supabase
            .from('pod_employees')
            .insert(membersToInsert);

          if (membersError) throw membersError;
        }
      }

      // Update permissions if provided
      if (data.permissions !== undefined) {
        // Delete existing permissions
        await supabase.from('pod_permissions').delete().eq('pod_id', id);

        // Insert new permissions
        if (data.permissions.length > 0) {
          const permissionsToInsert = data.permissions.map((moduleId) => ({
            pod_id: id,
            module_id: moduleId,
          }));

          const { error: permissionsError } = await supabase
            .from('pod_permissions')
            .insert(permissionsToInsert);

          if (permissionsError) throw permissionsError;
        }
      }

      return pod as Pod;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: podKeys.all });
      queryClient.invalidateQueries({ queryKey: podKeys.detail(variables.id) });
      toast.success('Pod updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update pod');
    },
  });
}

/**
 * Delete (soft delete) a pod
 */
export function useDeletePod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from('pods')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: podKeys.all });
      toast.success('Pod deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete pod');
    },
  });
}

/**
 * Sync HR data into pod_employees
 */
export function useSyncPodEmployeesFromHR() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<any> => {
      const { data, error } = await supabase.rpc('sync_pod_employees_from_hr');
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: podKeys.all });
      toast.success('HR data synced successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to sync HR data');
    },
  });
}

