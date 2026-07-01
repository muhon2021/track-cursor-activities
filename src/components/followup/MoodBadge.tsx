/**
 * Mood Badge
 * Displays mood with score
 */

import { Badge } from '@/components/ui/badge'

interface MoodBadgeProps {
  label?: 'warm' | 'neutral' | 'cold'
  score?: number
}

const moodColors: Record<string, string> = {
  warm: 'bg-green-100 text-green-800',
  neutral: 'bg-yellow-100 text-yellow-800',
  cold: 'bg-red-100 text-red-800',
}

const moodLabels: Record<string, string> = {
  warm: 'Warm',
  neutral: 'Neutral',
  cold: 'Cold',
}

export function MoodBadge({ label, score }: MoodBadgeProps) {
  if (!label) return null

  const colorClass = moodColors[label] || 'bg-gray-100 text-gray-800'
  const displayLabel = moodLabels[label] || label

  return (
    <Badge className={colorClass}>
      {displayLabel} {score !== undefined && `(${score}/100)`}
    </Badge>
  )
}
