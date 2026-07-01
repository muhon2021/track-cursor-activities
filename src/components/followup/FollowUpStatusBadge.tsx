/**
 * Follow-Up Status Badge
 * Color-coded status indicator
 */

import { Badge } from '@/components/ui/badge'

interface FollowUpStatusBadgeProps {
  status?: string
  variant?: 'default' | 'secondary' | 'destructive' | 'outline'
}

const statusColors: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  engaged: 'bg-green-100 text-green-800',
  awaiting_response: 'bg-yellow-100 text-yellow-800',
  follow_up_needed: 'bg-orange-100 text-orange-800',
  scheduled: 'bg-cyan-100 text-cyan-800',
  completed: 'bg-gray-100 text-gray-800',
  inactive: 'bg-red-100 text-red-800',
}

const statusLabels: Record<string, string> = {
  new: 'New',
  engaged: 'Engaged',
  awaiting_response: 'Awaiting Response',
  follow_up_needed: 'Follow-Up Needed',
  scheduled: 'Scheduled',
  completed: 'Completed',
  inactive: 'Inactive',
}

export function FollowUpStatusBadge({ status, variant = 'default' }: FollowUpStatusBadgeProps) {
  if (!status) return null

  const colorClass = statusColors[status] || 'bg-gray-100 text-gray-800'
  const label = statusLabels[status] || status

  return (
    <Badge variant={variant} className={colorClass}>
      {label}
    </Badge>
  )
}
