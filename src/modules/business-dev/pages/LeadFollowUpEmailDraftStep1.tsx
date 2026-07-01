/**
 * Email Draft Step 1 - AI Draft Generation
 * User configures context and AI generates email draft
 */

import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import {
  ArrowLeft,
  Loader2,
  Wand2,
  Send,
  RefreshCw,
  ChevronRight,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface EmailDraft {
  subject: string
  body: string
  tone?: string
}

export default function LeadFollowUpEmailDraftStep1() {
  const { contactSlug } = useParams<{ contactSlug: string }>()
  const navigate = useNavigate()

  const [isGenerating, setIsGenerating] = useState(false)
  const [emailIntent, setEmailIntent] = useState('regular')
  const [meetingLimit, setMeetingLimit] = useState('5')
  const [includeCompanyInfo, setIncludeCompanyInfo] = useState(true)
  const [includeProjectData, setIncludeProjectData] = useState(true)
  const [emailHistory, setEmailHistory] = useState('all')
  const [draftEmail, setDraftEmail] = useState<EmailDraft | null>(null)

  const handleGenerate = async () => {
    setIsGenerating(true)
    // Simulate API call
    setTimeout(() => {
      setDraftEmail({
        subject: 'Quick check-in – Let\'s explore opportunities together',
        body: `Hi John,

I hope this message finds you well. I wanted to reach out personally about how we might be able to help ACME Corp streamline your technology stack and improve operational efficiency.

Given your role as CTO and focus on enterprise solutions, I think there could be significant value in discussing how our platform has helped similar organizations reduce costs and improve deployment speed.

Would you be open to a brief 20-minute call next week? I could show you exactly how we've helped companies in your industry.

Looking forward to connecting.

Best regards,
Your Name`,
        tone: 'professional'
      })
      setIsGenerating(false)
    }, 2000)
  }

  const handleProceedToStep2 = () => {
    // Store draft in state/context and proceed
    navigate(`/lead-followup/${contactSlug}/email-draft-step2`)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/lead-followup/${contactSlug}`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Generate Email Draft</h1>
          <p className="text-muted-foreground">AI-powered email composition</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Context Panel (Left) */}
        <div className="md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Email Context</CardTitle>
              <CardDescription>Configure AI generation parameters</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Email Intent */}
              <div className="space-y-2">
                <Label htmlFor="intent">Email Intent</Label>
                <Select value={emailIntent} onValueChange={setEmailIntent}>
                  <SelectTrigger id="intent">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="regular">Regular Check-in</SelectItem>
                    <SelectItem value="sales">Sales Pitch</SelectItem>
                    <SelectItem value="upsell">Upsell/Cross-sell</SelectItem>
                    <SelectItem value="reengage">Re-engagement</SelectItem>
                    <SelectItem value="thankyou">Thank You Note</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Data Source Toggles */}
              <div className="space-y-3">
                <Label>Data Sources</Label>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="company"
                    checked={includeCompanyInfo}
                    onCheckedChange={() => setIncludeCompanyInfo(!includeCompanyInfo)}
                  />
                  <label htmlFor="company" className="text-sm cursor-pointer">
                    Company Information
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="project"
                    checked={includeProjectData}
                    onCheckedChange={() => setIncludeProjectData(!includeProjectData)}
                  />
                  <label htmlFor="project" className="text-sm cursor-pointer">
                    Project Data
                  </label>
                </div>
              </div>

              {/* Meeting Limit */}
              <div className="space-y-2">
                <Label htmlFor="meetings">Recent Meetings</Label>
                <Select value={meetingLimit} onValueChange={setMeetingLimit}>
                  <SelectTrigger id="meetings">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">Last 5</SelectItem>
                    <SelectItem value="10">Last 10</SelectItem>
                    <SelectItem value="all">All</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Email History */}
              <div className="space-y-2">
                <Label htmlFor="history">Email History</Label>
                <Select value={emailHistory} onValueChange={setEmailHistory}>
                  <SelectTrigger id="history">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">Last 5</SelectItem>
                    <SelectItem value="10">Last 10</SelectItem>
                    <SelectItem value="all">All</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Generate Button */}
              <Button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full"
                size="lg"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4 mr-2" />
                    Generate Draft
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Draft Display (Right) */}
        <div className="md:col-span-2">
          {!draftEmail ? (
            <Card>
              <CardHeader>
                <CardTitle>Generated Draft</CardTitle>
                <CardDescription>Your AI-generated email will appear here</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isGenerating ? (
                  <>
                    <Skeleton className="h-8 w-3/4" />
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </>
                ) : (
                  <div className="text-center py-12">
                    <Wand2 className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                    <p className="text-muted-foreground font-medium">No draft generated yet</p>
                    <p className="text-sm text-muted-foreground">
                      Click "Generate Draft" to create an AI-powered email
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Subject */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Subject Line</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="p-3 bg-muted rounded-md text-sm font-semibold">
                    {draftEmail.subject}
                  </div>
                </CardContent>
              </Card>

              {/* Body */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Email Body</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="p-3 bg-muted rounded-md text-sm whitespace-pre-wrap font-mono">
                    {draftEmail.body}
                  </div>
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleProceedToStep2}
                >
                  Continue to Review
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>

              <Alert>
                <AlertDescription className="text-sm">
                  You'll be able to edit and customize this draft in the next step before sending.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
