import { Badge } from '@/components/ui/badge'
import {
  getConfidenceScore,
  getConfidenceTier,
  getConfidenceTierClassName,
  getConfidenceTierLabel,
} from '@/lib/kb-confidence'

interface KbConfidenceBadgeProps {
  similarity: number
  rerank_score?: number
  showPercent?: boolean
}

export function KbConfidenceBadge({
  similarity,
  rerank_score,
  showPercent = true,
}: KbConfidenceBadgeProps) {
  const score = getConfidenceScore({ similarity, rerank_score })
  const tier = getConfidenceTier(score)

  return (
    <div className="shrink-0 text-right space-y-1">
      <div
        className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold ${getConfidenceTierClassName(tier)}`}
      >
        {showPercent ? `${(score * 100).toFixed(1)}%` : getConfidenceTierLabel(tier)}
      </div>
      <p className="text-xs text-muted-foreground">{getConfidenceTierLabel(tier)} confidence</p>
    </div>
  )
}
