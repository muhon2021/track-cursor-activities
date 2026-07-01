/**
 * Engagement Pulse
 * Visual engagement level indicator
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface EngagementPulseProps {
  level: 'limited' | 'moderate' | 'strong'
  score?: number
  trend?: 'up' | 'down' | 'stable'
  lastInteraction?: Date
}

const levelColors: Record<string, string> = {
  limited: 'text-red-600',
  moderate: 'text-yellow-600',
  strong: 'text-green-600',
}

const levelLabels: Record<string, string> = {
  limited: 'Limited',
  moderate: 'Moderate',
  strong: 'Strong',
}

const levelScores: Record<string, number> = {
  limited: 25,
  moderate: 60,
  strong: 90,
}

export function EngagementPulse({
  level,
  score = levelScores[level],
  trend,
  lastInteraction,
}: EngagementPulseProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Engagement Level</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Level with trend */}
        <div className="flex items-center justify-between">
          <span className={`text-2xl font-bold ${levelColors[level]}`}>
            {levelLabels[level]}
          </span>
          {trend && (
            <div>
              {trend === 'up' && (
                <TrendingUp className="h-5 w-5 text-green-600" />
              )}
              {trend === 'down' && (
                <TrendingDown className="h-5 w-5 text-red-600" />
              )}
              {trend === 'stable' && (
                <Minus className="h-5 w-5 text-gray-600" />
              )}
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground">Score</span>
            <span className="font-semibold">{score}/100</span>
          </div>
          <Progress value={score} className="h-2" />
        </div>

        {/* Last interaction */}
        {lastInteraction && (
          <div className="text-xs text-muted-foreground pt-2 border-t">
            Last interaction:{' '}
            {lastInteraction.toLocaleDateString()} at{' '}
            {lastInteraction.toLocaleTimeString()}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
