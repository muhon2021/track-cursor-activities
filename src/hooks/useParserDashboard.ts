/**
 * useParserDashboard — data hook for the Parser tab in KnowledgeDashboard.
 * Queries parsed_documents with aggregation for summary cards, failure log,
 * and per-format breakdown.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

export interface ParsedDocSummary {
  total: number
  completed: number
  failed: number
  pending: number
  processing: number
  avgParseTimeMs: number | null
}

export interface ParsedDocRow {
  id: string
  source_type: string
  source_id: string
  file_name: string | null
  mime_type: string | null
  parse_status: string
  parse_version: string
  parse_errors: Record<string, unknown> | null
  page_count: number
  table_count: number
  image_count: number
  word_count: number
  processed_at: string | null
  created_at: string
}

export interface MimeBreakdown {
  mime_type: string
  count: number
}

export function useParserDashboard() {
  const queryClient = useQueryClient()

  // ── Summary counts ───────────────────────────────────────────────────────
  const summaryQuery = useQuery({
    queryKey: ['parser-dashboard', 'summary'],
    queryFn: async (): Promise<ParsedDocSummary> => {
      const { data, error } = await supabase
        .from('parsed_documents')
        .select('parse_status, processed_at, created_at')

      if (error) throw error

      const rows = data ?? []
      const total = rows.length
      const completed = rows.filter((r) => r.parse_status === 'completed').length
      const failed = rows.filter((r) => r.parse_status === 'failed').length
      const pending = rows.filter((r) => r.parse_status === 'pending').length
      const processing = rows.filter((r) => r.parse_status === 'processing').length

      const completedWithTime = rows.filter(
        (r) => r.parse_status === 'completed' && r.processed_at && r.created_at
      )
      const avgParseTimeMs = completedWithTime.length > 0
        ? completedWithTime.reduce((sum, r) => {
            const diff = new Date(r.processed_at!).getTime() - new Date(r.created_at).getTime()
            return sum + diff
          }, 0) / completedWithTime.length
        : null

      return { total, completed, failed, pending, processing, avgParseTimeMs }
    },
    staleTime: 30_000,
  })

  // ── Failure log ──────────────────────────────────────────────────────────
  const failuresQuery = useQuery({
    queryKey: ['parser-dashboard', 'failures'],
    queryFn: async (): Promise<ParsedDocRow[]> => {
      const { data, error } = await supabase
        .from('parsed_documents')
        .select('*')
        .eq('parse_status', 'failed')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      return (data ?? []) as ParsedDocRow[]
    },
    staleTime: 30_000,
  })

  // ── All docs (for table) ─────────────────────────────────────────────────
  const allDocsQuery = useQuery({
    queryKey: ['parser-dashboard', 'all'],
    queryFn: async (): Promise<ParsedDocRow[]> => {
      const { data, error } = await supabase
        .from('parsed_documents')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)

      if (error) throw error
      return (data ?? []) as ParsedDocRow[]
    },
    staleTime: 30_000,
  })

  // ── MIME breakdown ───────────────────────────────────────────────────────
  const mimeBreakdownQuery = useQuery({
    queryKey: ['parser-dashboard', 'mime-breakdown'],
    queryFn: async (): Promise<MimeBreakdown[]> => {
      const { data, error } = await supabase
        .from('parsed_documents')
        .select('mime_type')

      if (error) throw error

      const counts: Record<string, number> = {}
      for (const row of data ?? []) {
        const key = row.mime_type || 'unknown'
        counts[key] = (counts[key] ?? 0) + 1
      }

      return Object.entries(counts)
        .map(([mime_type, count]) => ({ mime_type, count }))
        .sort((a, b) => b.count - a.count)
    },
    staleTime: 60_000,
  })

  // ── Mutations ────────────────────────────────────────────────────────────
  const reprocessOneMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const { data, error } = await supabase.functions.invoke('kb-reprocess', {
        body: { action: 'reprocess_one', document_id: documentId },
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast.success('Document queued for reprocessing')
      queryClient.invalidateQueries({ queryKey: ['parser-dashboard'] })
    },
    onError: (err: Error) => {
      toast.error(`Reprocess failed: ${err.message}`)
    },
  })

  const reprocessAllFailedMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('kb-reprocess', {
        body: { action: 'reprocess_all', batch_size: 50 },
      })
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      toast.success(`Reprocessing ${data?.total ?? ''} failed documents`)
      queryClient.invalidateQueries({ queryKey: ['parser-dashboard'] })
    },
    onError: (err: Error) => {
      toast.error(`Reprocess all failed: ${err.message}`)
    },
  })

  const reprocessSourceMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      const { data, error } = await supabase.functions.invoke('kb-reprocess', {
        body: { action: 'reprocess_source', source_id: sourceId },
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast.success('Source queued for reprocessing')
      queryClient.invalidateQueries({ queryKey: ['parser-dashboard'] })
    },
    onError: (err: Error) => {
      toast.error(`Reprocess source failed: ${err.message}`)
    },
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['parser-dashboard'] })

  return {
    summary: summaryQuery.data,
    summaryLoading: summaryQuery.isLoading,
    failures: failuresQuery.data ?? [],
    failuresLoading: failuresQuery.isLoading,
    allDocs: allDocsQuery.data ?? [],
    allDocsLoading: allDocsQuery.isLoading,
    mimeBreakdown: mimeBreakdownQuery.data ?? [],
    mimeBreakdownLoading: mimeBreakdownQuery.isLoading,
    reprocessOne: reprocessOneMutation.mutate,
    reprocessAllFailed: reprocessAllFailedMutation.mutate,
    reprocessSource: reprocessSourceMutation.mutate,
    isReprocessing: reprocessOneMutation.isPending || reprocessAllFailedMutation.isPending,
    refresh: invalidate,
  }
}
