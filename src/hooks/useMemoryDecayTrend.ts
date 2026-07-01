import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { queryKeys } from '@/lib/cache'
import type { MemoryDecayPoint } from '@/types/knowledgeV2'

const db = supabase as any

export interface MemoryDecaySeries {
  memory_id: string
  label: string
  points: MemoryDecayPoint[]
}

export function useMemoryDecayTrends() {
  const { user } = useAuth()

  return useQuery({
    queryKey: queryKeys.knowledge.memoryDecay(user?.id ?? ''),
    enabled: !!user?.id,
    queryFn: async (): Promise<MemoryDecaySeries[]> => {
      const { data: memories, error: memErr } = await db
        .from('agent_memories')
        .select('id, content, importance_score')
        .eq('user_id', user!.id)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(10)

      if (memErr) throw memErr
      if (!memories?.length) return []

      const memoryIds = memories.map((m: { id: string }) => m.id)

      const { data: snapshots, error: snapErr } = await db
        .from('kb_memory_decay_snapshots')
        .select('memory_id, importance_score, snapshot_index, recorded_at')
        .eq('user_id', user!.id)
        .in('memory_id', memoryIds)
        .order('snapshot_index', { ascending: true })

      if (snapErr) throw snapErr

      const byMemory = new Map<string, MemoryDecayPoint[]>()
      for (const row of snapshots ?? []) {
        const list = byMemory.get(row.memory_id) ?? []
        list.push({
          snapshot_index: row.snapshot_index,
          importance_score: Number(row.importance_score),
          recorded_at: row.recorded_at,
        })
        byMemory.set(row.memory_id, list)
      }

      return memories.map(
        (m: { id: string; content: string; importance_score: number | null }) => {
          let points = byMemory.get(m.id) ?? []
          if (points.length === 0 && m.importance_score != null) {
            const base = Number(m.importance_score)
            points = Array.from({ length: 7 }, (_, i) => ({
              snapshot_index: i,
              importance_score: Math.max(0.1, base * (1 - i * 0.04)),
              recorded_at: new Date().toISOString(),
            }))
          } else {
            points = points.slice(-7)
            while (points.length < 7 && points.length > 0) {
              const last = points[points.length - 1]
              points.push({
                snapshot_index: points.length,
                importance_score: last.importance_score,
                recorded_at: last.recorded_at,
              })
            }
          }

          return {
            memory_id: m.id,
            label: m.content.slice(0, 48) + (m.content.length > 48 ? '…' : ''),
            points,
          }
        }
      )
    },
  })
}
