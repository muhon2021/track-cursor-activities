/**
 * Remaining Follow-Up Components (Batch 1)
 * Action Center, Scheduled Emails, Email History, AI Insights
 */

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Mail, Phone, Linkedin, MessageSquare, CheckCircle2, Clock, AlertCircle, Trash2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { format } from 'date-fns'

// ============ ACTION CENTER ============

interface ActionCenterProps {
  onEmail?: () => void
  onCall?: () => void
  onLinkedIn?: () => void
  onNote?: () => void
  onSnooze?: (days: number) => void
  onComplete?: () => void
}

export function ActionCenter({
  onEmail,
  onCall,
  onLinkedIn,
  onNote,
  onSnooze,
  onComplete,
}: ActionCenterProps) {
  const [snoozOpen, setSnoozOpen] = useState(false)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Quick Actions</CardTitle>
        <CardDescription>Interact with this contact</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        <Button onClick={onEmail} variant="outline" className="justify-start">
          <Mail className="h-4 w-4 mr-2" />
          Send Email
        </Button>
        <Button onClick={onCall} variant="outline" className="justify-start">
          <Phone className="h-4 w-4 mr-2" />
          Log Call
        </Button>
        <Button onClick={onLinkedIn} variant="outline" className="justify-start">
          <Linkedin className="h-4 w-4 mr-2" />
          LinkedIn
        </Button>
        <Button onClick={onNote} variant="outline" className="justify-start">
          <MessageSquare className="h-4 w-4 mr-2" />
          Add Note
        </Button>
        <div className="border-t pt-2 mt-2">
          <Button
            onClick={onComplete}
            variant="outline"
            className="w-full justify-start text-green-600"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Mark Complete
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ============ SCHEDULED EMAILS LIST ============

interface ScheduledEmail {
  id: string
  recipient: string
  subject: string
  scheduledFor: string
  status: 'scheduled' | 'sent' | 'failed'
}

interface ScheduledEmailsListProps {
  emails: ScheduledEmail[]
  onSendNow?: (id: string) => void
  onCancel?: (id: string) => void
  isLoading?: boolean
}

export function ScheduledEmailsList({
  emails,
  onSendNow,
  onCancel,
  isLoading = false,
}: ScheduledEmailsListProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null)

  if (emails.length === 0) {
    return (
      <Card>
        <CardContent className="pt-12 pb-12 text-center">
          <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground">No scheduled emails</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scheduled Emails</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {emails.map(email => (
          <div
            key={email.id}
            className="flex items-start justify-between p-3 bg-muted rounded-lg"
          >
            <div className="flex-1">
              <div className="font-semibold text-sm">{email.subject}</div>
              <div className="text-xs text-muted-foreground mt-1">
                To: {email.recipient}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Scheduled: {format(new Date(email.scheduledFor), 'MMM d, h:mm a')}
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onSendNow?.(email.id)}
                disabled={email.status !== 'scheduled'}
              >
                Send Now
              </Button>
              <AlertDialog open={deleteId === email.id} onOpenChange={open => setDeleteId(open ? email.id : null)}>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDeleteId(email.id)}
                  disabled={email.status !== 'scheduled'}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel scheduled email?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This email will not be sent.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogCancel>Keep</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      onCancel?.(email.id)
                      setDeleteId(null)
                    }}
                  >
                    Cancel Email
                  </AlertDialogAction>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// ============ EMAIL HISTORY ============

interface EmailHistoryItem {
  id: string
  subject: string
  recipient: string
  direction: 'sent' | 'received'
  status?: 'sent' | 'opened' | 'clicked'
  sentAt: string
}

interface EmailHistoryProps {
  emails: EmailHistoryItem[]
  isLoading?: boolean
}

export function EmailHistory({ emails, isLoading = false }: EmailHistoryProps) {
  if (emails.length === 0) {
    return (
      <Card>
        <CardContent className="pt-12 pb-12 text-center">
          <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground">No email history</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email History</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {emails.map(email => (
          <div key={email.id} className="flex items-start justify-between p-3 bg-muted rounded-lg text-sm">
            <div className="flex-1">
              <div className="font-semibold">{email.subject}</div>
              <div className="text-xs text-muted-foreground">{email.recipient}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {format(new Date(email.sentAt), 'MMM d, h:mm a')}
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Badge variant="outline">{email.direction === 'sent' ? 'Sent' : 'Received'}</Badge>
              {email.status && (
                <Badge
                  variant="outline"
                  className={
                    email.status === 'opened'
                      ? 'bg-green-100 text-green-800'
                      : email.status === 'clicked'
                        ? 'bg-blue-100 text-blue-800'
                        : ''
                  }
                >
                  {email.status === 'opened' ? 'Opened' : email.status === 'clicked' ? 'Clicked' : 'Sent'}
                </Badge>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// ============ AI INSIGHTS CARD ============

interface AIInsightsCardProps {
  moodScore?: number
  moodLabel?: string
  intentStatus?: string
  momentumScore?: number
  keySignals?: string[]
  onAnalyze?: () => void
  isAnalyzing?: boolean
}

export function AIInsightsCard({
  moodScore,
  moodLabel,
  intentStatus,
  momentumScore,
  keySignals = [],
  onAnalyze,
  isAnalyzing = false,
}: AIInsightsCardProps) {
  const moodColors: Record<string, string> = {
    warm: 'text-green-600',
    neutral: 'text-yellow-600',
    cold: 'text-red-600',
  }

  const intentColors: Record<string, string> = {
    active: 'text-green-600',
    stalled: 'text-yellow-600',
    dormant: 'text-red-600',
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>AI Insights</CardTitle>
          <CardDescription>Mood and intent analysis</CardDescription>
        </div>
        <Button size="sm" onClick={onAnalyze} disabled={isAnalyzing} variant="outline">
          {isAnalyzing ? 'Analyzing...' : 'Analyze'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {moodScore !== undefined && (
          <div>
            <div className="text-sm font-semibold mb-2">Mood</div>
            <div className={`text-2xl font-bold ${moodColors[moodLabel || ''] || ''}`}>
              {moodLabel}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Score: {moodScore}/100</div>
          </div>
        )}

        {intentStatus && (
          <div className="border-t pt-4">
            <div className="text-sm font-semibold mb-2">Intent</div>
            <div className={`text-2xl font-bold ${intentColors[intentStatus] || ''}`}>
              {intentStatus.charAt(0).toUpperCase() + intentStatus.slice(1)}
            </div>
            {momentumScore !== undefined && (
              <div className="text-xs text-muted-foreground mt-1">Score: {momentumScore}/100</div>
            )}
          </div>
        )}

        {keySignals.length > 0 && (
          <div className="border-t pt-4">
            <div className="text-sm font-semibold mb-2">Key Signals</div>
            <ul className="space-y-1">
              {keySignals.map((signal, i) => (
                <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                  <CheckCircle2 className="h-3 w-3 mt-0.5 flex-shrink-0 text-green-600" />
                  {signal}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
