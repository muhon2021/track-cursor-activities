import type { ConfidenceTier } from '@/types/knowledgeV2'

/** V2 confidence tiers: High >= 0.7, Medium >= 0.45, else Low */
export function getConfidenceScore(result: {
  rerank_score?: number
  similarity: number
}): number {
  return result.rerank_score ?? result.similarity
}

export function getConfidenceTier(score: number): ConfidenceTier {
  if (score >= 0.7) return 'high'
  if (score >= 0.45) return 'medium'
  return 'low'
}

export function getConfidenceTierLabel(tier: ConfidenceTier): string {
  const labels: Record<ConfidenceTier, string> = {
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  }
  return labels[tier]
}

export function getConfidenceTierClassName(tier: ConfidenceTier): string {
  const classes: Record<ConfidenceTier, string> = {
    high: 'text-green-700 bg-green-50 border-green-200 dark:text-green-300 dark:bg-green-950/40 dark:border-green-800',
    medium: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/40 dark:border-amber-800',
    low: 'text-muted-foreground bg-muted border-border',
  }
  return classes[tier]
}
