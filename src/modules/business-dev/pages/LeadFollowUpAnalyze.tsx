/**
 * Lead Analysis Page
 * Mood and intent analysis with history and insights
 */

import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  ArrowLeft,
  Zap,
  BarChart3,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
} from 'lucide-react'
import { format } from 'date-fns'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface Analysis {
  type: 'mood' | 'intent'
  score: number
  label: string
  confidence: 'high' | 'medium' | 'low'
  signals: string[]
  reasoning: string
  suggestedAction: string
  analyzedAt: Date
}

export default function LeadFollowUpAnalyze() {
  const { contactSlug } = useParams<{ contactSlug: string }>()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)

  // Mock data
  const moodAnalysis: Analysis = {
    type: 'mood',
    score: 78,
    label: 'Warm',
    confidence: 'high',
    signals: [
      'Positive response to initial outreach',
      'Engaged during demo call',
      'Asked detailed technical questions',
      'Responsive to emails',
    ],
    reasoning: 'John showed genuine interest during our demo and asked specific questions about implementation. His response times have been prompt, suggesting active engagement.',
    suggestedAction: 'respond_soon',
    analyzedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  }

  const intentAnalysis: Analysis = {
    type: 'intent',
    score: 72,
    label: 'Active',
    confidence: 'high',
    signals: [
      '5 interactions in last 14 days',
      'Meeting scheduled for next week',
      'Discussing budget and timeline',
      'Involved decision makers',
    ],
    reasoning: 'High momentum with consistent engagement. John has brought in additional stakeholders and is actively discussing implementation details, which indicates serious buying intent.',
    suggestedAction: 'respond_soon',
    analyzedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  }

  const analysisHistory = [
    { ...moodAnalysis, analyzedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), score: 65, label: 'Neutral' },
    { ...moodAnalysis, analyzedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000), score: 52, label: 'Cold' },
  ]

  const getMoodColor = (label: string) => {
    switch (label) {
      case 'Warm':
        return 'text-green-600 bg-green-50'
      case 'Neutral':
        return 'text-yellow-600 bg-yellow-50'
      case 'Cold':
        return 'text-red-600 bg-red-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  const getIntentColor = (label: string) => {
    switch (label) {
      case 'Active':
        return 'text-green-600 bg-green-50'
      case 'Stalled':
        return 'text-yellow-600 bg-yellow-50'
      case 'Dormant':
        return 'text-red-600 bg-red-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high':
        return 'bg-green-100 text-green-800'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800'
      case 'low':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const handleRefreshAnalysis = () => {
    setIsLoading(true)
    setTimeout(() => setIsLoading(false), 2000)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/lead-followup/${contactSlug}`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Lead Analysis</h1>
            <p className="text-muted-foreground">AI-powered mood and intent analysis</p>
          </div>
        </div>
        <Button onClick={handleRefreshAnalysis} disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Zap className="h-4 w-4 mr-2" />
              Refresh Analysis
            </>
          )}
        </Button>
      </div>

      {/* Current Analysis */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Mood Analysis */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Mood Analysis</CardTitle>
                <CardDescription>Emotional sentiment towards your solution</CardDescription>
              </div>
              <Badge className={getConfidenceColor(moodAnalysis.confidence)}>
                {moodAnalysis.confidence} confidence
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Score */}
            <div className={`p-4 rounded-lg ${getMoodColor(moodAnalysis.label)}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold">Sentiment Score</span>
                <span className="text-2xl font-bold">{moodAnalysis.score}</span>
              </div>
              <Progress value={moodAnalysis.score} className="h-2" />
              <div className="mt-2 text-sm font-semibold">
                {moodAnalysis.label}
              </div>
            </div>

            {/* Signals */}
            <div>
              <h4 className="text-sm font-semibold mb-3">Key Signals</h4>
              <div className="space-y-2">
                {moodAnalysis.signals.map((signal, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>{signal}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Reasoning */}
            <div>
              <h4 className="text-sm font-semibold mb-2">Analysis</h4>
              <p className="text-sm text-muted-foreground">
                {moodAnalysis.reasoning}
              </p>
            </div>

            {/* Last Updated */}
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Last analyzed {format(moodAnalysis.analyzedAt, 'MMM d, h:mm a')}
            </div>
          </CardContent>
        </Card>

        {/* Intent Analysis */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Intent & Momentum</CardTitle>
                <CardDescription>Likelihood to purchase or progress</CardDescription>
              </div>
              <Badge className={getConfidenceColor(intentAnalysis.confidence)}>
                {intentAnalysis.confidence} confidence
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Score */}
            <div className={`p-4 rounded-lg ${getIntentColor(intentAnalysis.label)}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold">Momentum Score</span>
                <span className="text-2xl font-bold">{intentAnalysis.score}</span>
              </div>
              <Progress value={intentAnalysis.score} className="h-2" />
              <div className="mt-2 text-sm font-semibold">
                {intentAnalysis.label} Deal
              </div>
            </div>

            {/* Signals */}
            <div>
              <h4 className="text-sm font-semibold mb-3">Momentum Signals</h4>
              <div className="space-y-2">
                {intentAnalysis.signals.map((signal, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <TrendingUp className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <span>{signal}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Reasoning */}
            <div>
              <h4 className="text-sm font-semibold mb-2">Analysis</h4>
              <p className="text-sm text-muted-foreground">
                {intentAnalysis.reasoning}
              </p>
            </div>

            {/* Last Updated */}
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Last analyzed {format(intentAnalysis.analyzedAt, 'MMM d, h:mm a')}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recommended Action */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Recommended Action:</strong> Respond soon with a personalized proposal and schedule a follow-up meeting to move the deal forward.
        </AlertDescription>
      </Alert>

      {/* Analysis History */}
      <Card>
        <CardHeader>
          <CardTitle>Analysis History</CardTitle>
          <CardDescription>Previous mood and intent analyses</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {analysisHistory.map((analysis, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-muted rounded-lg text-sm">
                <div className="flex items-center gap-3 flex-1">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-semibold">
                      {analysis.label} sentiment
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(analysis.analyzedAt, 'MMM d, yyyy h:mm a')}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Progress value={analysis.score} className="w-24 h-2" />
                  <span className="font-semibold w-10 text-right">{analysis.score}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
