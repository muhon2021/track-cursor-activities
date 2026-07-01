import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { queryKeys } from '@/lib/cache'
import type { OcrConfidenceBucket } from '@/types/knowledgeV2'

const LOW_CONFIDENCE_THRESHOLD = 0.45

const BUCKET_DEFS: { range: string; min: number; max: number }[] = [
  { range: '0–20%', min: 0, max: 0.2 },
  { range: '20–40%', min: 0.2, max: 0.4 },
  { range: '40–60%', min: 0.4, max: 0.6 },
  { range: '60–80%', min: 0.6, max: 0.8 },
  { range: '80–100%', min: 0.8, max: 1.01 },
]

export function useOcrQualityStats() {
  return useQuery({
    queryKey: queryKeys.knowledge.ocrQuality,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('document_images')
        .select('ocr_confidence')
        .not('ocr_confidence', 'is', null)

      if (error) throw error

      const scores = (data ?? [])
        .map((r) => Number(r.ocr_confidence))
        .filter((n) => !Number.isNaN(n))

      const histogram: OcrConfidenceBucket[] = BUCKET_DEFS.map((b) => ({
        ...b,
        count: scores.filter((s) => s >= b.min && s < b.max).length,
      }))

      const lowConfidenceCount = scores.filter((s) => s < LOW_CONFIDENCE_THRESHOLD).length
      const total = scores.length
      const avgConfidence =
        total > 0 ? scores.reduce((a, b) => a + b, 0) / total : null

      return {
        histogram,
        lowConfidenceCount,
        total,
        avgConfidence,
        hasLowConfidenceAlerts: lowConfidenceCount > 0,
      }
    },
    staleTime: 60_000,
  })
}

export { LOW_CONFIDENCE_THRESHOLD }
