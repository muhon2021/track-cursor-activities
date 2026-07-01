/**
 * Lead Score Badge
 * Displays lead score with temperature classification
 */

import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { TrendingUp } from 'lucide-react'

interface LeadScoreBadgeProps {
  score?: number
  temperature?: 'hot' | 'warm' | 'cold'
  breakdown?: {
    engagement?: number
    profile?: number
    dealPotential?: number
    recency?: number
  }
}

const tempColors: Record<string, string> = {
  hot: 'bg-red-100 text-red-800',
  warm: 'bg-yellow-100 text-yellow-800',
  cold: 'bg-blue-100 text-blue-800',
}

export function LeadScoreBadge({ score = 0, temperature, breakdown }: LeadScoreBadgeProps) {
  const colorClass = temperature ? tempColors[temperature] : 'bg-gray-100 text-gray-800'

  const content = (
    <div className="space-y-2">
      <div className="font-semibold">Score Breakdown</div>
      <div className="text-sm space-y-1">
        {breakdown?.engagement !== undefined && (
          <div>Engagement: {breakdown.engagement}/40</div>
        )}
        {breakdown?.profile !== undefined && (
          <div>Profile: {breakdown.profile}/20</div>
        )}
        {breakdown?.dealPotential !== undefined && (
          <div>Deal Potential: {breakdown.dealPotential}/30</div>
        )}
        {breakdown?.recency !== undefined && (
          <div>Recency: {breakdown.recency}/10</div>
        )}
      </div>
      <div className="border-t pt-2 font-semibold">Total: {score}/100</div>
    </div>
  )

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className={`${colorClass} cursor-help`}>
            <TrendingUp className="h-3 w-3 mr-1" />
            {score}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="left">{content}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
