import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { queryKeys, cacheConfig } from '@/lib/cache'
import {
  graphSearch,
  graphNeighbors,
  graphEntitySummary,
  fetchGraphifyStats,
  fetchGraphifyAnalytics,
  runGraphifyBackfill,
  type GraphSearchResponse,
  type GraphifyConfigRow,
  type GraphifyAnalyticsData,
} from '@/lib/graphify'
import { toast } from 'sonner'

export function useGraphSearch(query: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.graphify.search(query),
    queryFn: () => graphSearch(query),
    enabled: enabled && query.trim().length > 1,
    staleTime: cacheConfig.staleTime.medium,
    refetchOnWindowFocus: false,
  })
}

export function useGraphNeighbors(entityId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.graphify.neighbors(entityId ?? ''),
    queryFn: () => graphNeighbors(entityId!),
    enabled: Boolean(entityId),
    staleTime: cacheConfig.staleTime.long,
    refetchOnWindowFocus: false,
  })
}

export function useGraphEntitySummary(entityId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.graphify.entity(entityId ?? ''),
    queryFn: () => graphEntitySummary(entityId!),
    enabled: Boolean(entityId),
    staleTime: cacheConfig.staleTime.medium,
    refetchOnWindowFocus: false,
  })
}

export function useGraphifyConfig() {
  return useQuery({
    queryKey: queryKeys.graphify.config,
    queryFn: async (): Promise<GraphifyConfigRow | null> => {
      const { data, error } = await supabase
        .from('graphify_config')
        .select('*')
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data as GraphifyConfigRow | null
    },
  })
}

export function useUpdateGraphifyConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (updates: Partial<GraphifyConfigRow> & { id: string }) => {
      const { id, ...rest } = updates
      const { data, error } = await supabase
        .from('graphify_config')
        .update(rest)
        .eq('id', id)
        .select('*')
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.graphify.config })
      toast.success('Graphify configuration saved')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useGraphifyStats() {
  return useQuery({
    queryKey: queryKeys.graphify.stats,
    queryFn: fetchGraphifyStats,
    staleTime: cacheConfig.staleTime.medium,
    refetchOnWindowFocus: false,
  })
}

export function useGraphifyAnalytics(days = 30) {
  return useQuery({
    queryKey: queryKeys.graphify.analytics(days),
    queryFn: () => fetchGraphifyAnalytics(days),
    staleTime: cacheConfig.staleTime.long,
    refetchOnWindowFocus: false,
  })
}

export function useGraphifyBackfill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: runGraphifyBackfill,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.graphify.stats })
      queryClient.invalidateQueries({ queryKey: queryKeys.graphify.coverage })
      queryClient.invalidateQueries({ queryKey: queryKeys.graphify.syncJobs })
      toast.success('Graph backfill started')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useGraphifySyncJobs() {
  return useQuery({
    queryKey: queryKeys.graphify.syncJobs,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('graphify_sync_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) throw error
      return data ?? []
    },
  })
}

export type { GraphSearchResponse, GraphifyAnalyticsData }
