/**
 * Contact AI Summary Tab
 * Cached AI-generated executive summary
 */

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'

interface ContactAISummaryProps {
  summaryText?: string
  talkingPoints?: string[]
  recommendedApproach?: string
  engagementLevel?: 'limited' | 'moderate' | 'strong'
  leadScore?: number
  generatedAt?: Date
  expiresAt?: Date
  onRefresh?: () => void
  isLoading?: boolean
}

export function ContactAISummary({
  summaryText,
  talkingPoints = [],
  recommendedApproach,
  engagementLevel,
  leadScore,
  generatedAt,
  expiresAt,
  onRefresh,
  isLoading = false,
}: ContactAISummaryProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    if (onRefresh) {
      await onRefresh()
    }
    setIsRefreshing(false)
  }

  const engagementColors: Record<string, string> = {
    limited: 'bg-red-100 text-red-800',
    moderate: 'bg-yellow-100 text-yellow-800',
    strong: 'bg-green-100 text-green-800',
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-12 pb-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
          <p className="text-muted-foreground mt-4">Generating AI summary...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Executive Summary */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Executive Summary</CardTitle>
            <CardDescription>AI-generated overview of this contact</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </>
            )}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {summaryText ? (
            <>
              <p className="text-sm leading-relaxed">{summaryText}</p>

              <div className="grid gap-4 pt-4 border-t">
                {engagementLevel && (
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-1">
                      Engagement Level
                    </div>
                    <Badge className={engagementColors[engagementLevel]}>
                      {engagementLevel.charAt(0).toUpperCase() + engagementLevel.slice(1)}
                    </Badge>
                  </div>
                )}

                {leadScore !== undefined && (
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-1">
                      Lead Score
                    </div>
                    <div className="text-2xl font-bold">{leadScore}</div>
                  </div>
                )}
              </div>

              {(generatedAt || expiresAt) && (
                <div className="text-xs text-muted-foreground space-y-1 pt-4 border-t">
                  {generatedAt && (
                    <div>Generated: {format(generatedAt, 'MMM d, yyyy h:mm a')}</div>
                  )}
                  {expiresAt && (
                    <div>Expires: {format(expiresAt, 'MMM d, yyyy h:mm a')}</div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No summary generated yet</p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="mt-4"
              >
                {isRefreshing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Generate Summary
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Talking Points */}
      {talkingPoints.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Key Discussion Points</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {talkingPoints.map((point, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="text-muted-foreground flex-shrink-0 mt-1">•</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Recommended Approach */}
      {recommendedApproach && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recommended Approach</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{recommendedApproach}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
