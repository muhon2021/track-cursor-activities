import { AlertTriangle, ScanText } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { Loader2 } from 'lucide-react'
import { useOrganization } from '@/contexts/OrganizationContext'
import { useOcrQualityStats, LOW_CONFIDENCE_THRESHOLD } from '@/hooks/useOcrQuality'

const chartConfig: ChartConfig = {
  count: { label: 'Images', color: 'hsl(var(--primary))' },
}

export function OcrQualitySection() {
  const org = useOrganization()
  const { data, isLoading } = useOcrQualityStats()

  if (!org.features.enableKbOcr) return null

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!data || data.total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ScanText className="h-4 w-4 text-primary" />
            OCR Quality
          </CardTitle>
          <CardDescription>No OCR confidence data yet</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {data.hasLowConfidenceAlerts ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Low-confidence OCR reads detected</AlertTitle>
          <AlertDescription>
            {data.lowConfidenceCount} image
            {data.lowConfidenceCount !== 1 ? 's' : ''} scored below{' '}
            {(LOW_CONFIDENCE_THRESHOLD * 100).toFixed(0)}% confidence. Consider re-processing
            with a different OCR language or higher heading sensitivity.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ScanText className="h-4 w-4 text-primary" />
            OCR Quality Histogram
          </CardTitle>
          <CardDescription>
            Distribution of OCR confidence across {data.total} extracted images
            {data.avgConfidence != null
              ? ` · avg ${(data.avgConfidence * 100).toFixed(1)}%`
              : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[200px] w-full">
            <BarChart data={data.histogram}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="range" fontSize={11} />
              <YAxis allowDecimals={false} fontSize={11} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}
