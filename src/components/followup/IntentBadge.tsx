/**
 * Intent Badge
 * Displays deal intent status
 */

import { Badge } from '@/components/ui/badge'

interface IntentBadgeProps {
  status?: 'active' | 'stalled' | 'dormant'
}

const intentColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  stalled: 'bg-yellow-100 text-yellow-800',
  dormant: 'bg-red-100 text-red-800',
}

const intentLabels: Record<string, string> = {
  active: 'Active',
  stalled: 'Stalled',
  dormant: 'Dormant',
}

export function IntentBadge({ status }: IntentBadgeProps) {
  if (!status) return null

  const colorClass = intentColors[status] || 'bg-gray-100 text-gray-800'
  const label = intentLabels[status] || status

  return (
    <Badge className={colorClass}>
      {label}
    </Badge>
  )
}
