import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/cache'
import {
  fetchGraphifyCoverage,
  runGraphifyBackfill,
  runGraphifyRelationshipSyncPhased,
  triggerReEmbedKnowledge,
  triggerReEmbedMeetings,
  type GraphifyCoverageData,
} from '@/lib/graphify'
import { useUpdateGraphifyConfig, useGraphifyConfig } from './useGraphSearch'
import { toast } from 'sonner'

export function useGraphifyCoverage() {
  return useQuery({
    queryKey: queryKeys.graphify.coverage,
    queryFn: fetchGraphifyCoverage,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}

export function useGraphifyRelationshipSync() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: runGraphifyRelationshipSyncPhased,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.graphify.coverage })
      queryClient.invalidateQueries({ queryKey: queryKeys.graphify.stats })
      queryClient.invalidateQueries({ queryKey: queryKeys.graphify.syncJobs })
      toast.success(`Relationship sync completed (${data.relationships_synced ?? 0} links)`)
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useGraphifySuggestionActions() {
  const queryClient = useQueryClient()
  const [runningAction, setRunningAction] = useState<GraphifyCoverageData['suggestions'][0]['action'] | null>(null)

  const backfill = useMutation({
    mutationFn: runGraphifyBackfill,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.graphify.all })
      toast.success('Backfill started')
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const relationshipSync = useGraphifyRelationshipSync()
  const reEmbedMeetings = useMutation({
    mutationFn: () => triggerReEmbedMeetings(10),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.graphify.coverage })
      toast.success(`Processed ${data.processed_count ?? 0} meeting(s)`)
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const reEmbedKnowledge = useMutation({
    mutationFn: triggerReEmbedKnowledge,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.graphify.coverage })
      toast.success(`Processed ${data.processed_count ?? 0} knowledge entr${data.processed_count === 1 ? 'y' : 'ies'}`)
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const { data: config } = useGraphifyConfig()
  const updateConfig = useUpdateGraphifyConfig()

  const runSuggestion = async (action: GraphifyCoverageData['suggestions'][0]['action']) => {
    setRunningAction(action)
    try {
      switch (action) {
        case 'run_relationship_sync':
          toast.info('Sync in progress — linking FK relationships in phases…')
          await relationshipSync.mutateAsync()
          break
        case 'run_backfill':
          await backfill.mutateAsync()
          break
        case 're_embed_meetings':
          await reEmbedMeetings.mutateAsync()
          break
        case 're_embed_knowledge':
          await reEmbedKnowledge.mutateAsync()
          break
        case 'enable_entity_extraction':
          if (config?.id) {
            updateConfig.mutate({ id: config.id, entity_extraction_enabled: true })
          }
          break
        case 'review_orphans':
          break
      }
    } finally {
      setRunningAction(null)
    }
  }

  const isActionRunning = (action: GraphifyCoverageData['suggestions'][0]['action']) => {
    if (runningAction === action) return true
    switch (action) {
      case 'run_relationship_sync':
        return relationshipSync.isPending
      case 'run_backfill':
        return backfill.isPending
      case 're_embed_meetings':
        return reEmbedMeetings.isPending
      case 're_embed_knowledge':
        return reEmbedKnowledge.isPending
      case 'enable_entity_extraction':
        return updateConfig.isPending
      default:
        return false
    }
  }

  return { runSuggestion, isActionRunning }
}

export type { GraphifyCoverageData }
