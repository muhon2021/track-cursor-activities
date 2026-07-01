import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { queryKeys } from '@/lib/cache'
import { toast } from 'sonner'
import type { KbSlackChannelRow, KbSlackSyncLedgerRow } from '@/types/knowledgeV2'

const db = supabase as any

export function useKbSlackChannels() {
  return useQuery({
    queryKey: queryKeys.knowledge.slackChannels,
    queryFn: async (): Promise<KbSlackChannelRow[]> => {
      const { data, error } = await db
        .from('kb_slack_channels')
        .select('*')
        .eq('is_public', true)
        .order('channel_name')
      if (error) throw error
      return (data ?? []) as KbSlackChannelRow[]
    },
  })
}

export function useKbSlackSyncLedger(limit = 20) {
  return useQuery({
    queryKey: queryKeys.knowledge.slackSyncLedger(limit),
    queryFn: async (): Promise<KbSlackSyncLedgerRow[]> => {
      const { data, error } = await db
        .from('kb_slack_sync_ledger')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return (data ?? []) as KbSlackSyncLedgerRow[]
    },
  })
}

export function useToggleKbSlackChannel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ channelId, enabled }: { channelId: string; enabled: boolean }) => {
      const { error } = await db
        .from('kb_slack_channels')
        .update({ is_enabled: enabled })
        .eq('channel_id', channelId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.slackChannels })
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useSyncKbSlackChannels() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (channelIds?: string[]) => {
      const { data, error } = await supabase.functions.invoke('kb-sync-slack', {
        body: { channel_ids: channelIds },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      return data
    },
    onSuccess: () => {
      toast.success('Slack sync started')
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.slackChannels })
      queryClient.invalidateQueries({ queryKey: ['knowledge', 'slackSyncLedger'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useDiscoverKbSlackChannels() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('kb-sync-slack', {
        body: { action: 'discover' },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      return data
    },
    onSuccess: () => {
      toast.success('Slack channels refreshed')
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.slackChannels })
    },
    onError: (e: Error) => toast.error(e.message),
  })
}
