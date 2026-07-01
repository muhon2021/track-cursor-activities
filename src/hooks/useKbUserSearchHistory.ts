import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { queryKeys } from '@/lib/cache'
import type { KbSearchPlatform, KbUserSearchHistoryRow } from '@/types/knowledgeV2'

const db = supabase as any

export function useKbUserSearchHistory(limit = 15) {
  const { user } = useAuth()
  return useQuery({
    queryKey: queryKeys.knowledge.userSearchHistory(user?.id ?? '', limit),
    enabled: !!user?.id,
    queryFn: async (): Promise<KbUserSearchHistoryRow[]> => {
      const { data, error } = await db
        .from('kb_user_search_history')
        .select('id, user_id, query, platform, result_count, created_at')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return (data ?? []) as KbUserSearchHistoryRow[]
    },
  })
}

export function useRecordKbSearch() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      query: string
      platform?: KbSearchPlatform
      result_count?: number
    }) => {
      if (!user?.id || !input.query.trim()) return
      const { error } = await db.from('kb_user_search_history').insert({
        user_id: user.id,
        query: input.query.trim(),
        platform: input.platform ?? 'web',
        result_count: input.result_count ?? 0,
      })
      if (error) throw error
    },
    onSuccess: () => {
      if (user?.id) {
        queryClient.invalidateQueries({
          queryKey: ['knowledge', 'userSearchHistory', user.id],
        })
      }
    },
  })
}
