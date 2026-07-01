/**
 * Email Draft Step 2 - Review & Send
 * User reviews, edits, and sends or schedules email
 */

import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  ArrowLeft,
  Send,
  Clock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { format, addDays } from 'date-fns'

interface EmailDraft {
  to: string
  cc?: string
  bcc?: string
  subject: string
  body: string
}

export default function LeadFollowUpEmailDraftStep2() {
  const { contactSlug } = useParams<{ contactSlug: string }>()
  const navigate = useNavigate()

  const [email, setEmail] = useState<EmailDraft>({
    to: 'john@acme.com',
    cc: '',
    bcc: '',
    subject: 'Quick check-in – Let\'s explore opportunities together',
    body: `Hi John,

I hope this message finds you well. I wanted to reach out personally about how we might be able to help ACME Corp streamline your technology stack and improve operational efficiency.

Given your role as CTO and focus on enterprise solutions, I think there could be significant value in discussing how our platform has helped similar organizations reduce costs and improve deployment speed.

Would you be open to a brief 20-minute call next week? I could show you exactly how we've helped companies in your industry.

Looking forward to connecting.

Best regards,
Your Name`,
  })

  const [sendMode, setSendMode] = useState<'now' | 'schedule'>('now')
  const [scheduleDate, setScheduleDate] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'))
  const [scheduleTime, setScheduleTime] = useState('09:00')
  const [isSending, setIsSending] = useState(false)
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)

  const handleSend = async () => {
    setIsSending(true)
    // Simulate sending
    setTimeout(() => {
      setIsSending(false)
      setShowSuccessDialog(true)
    }, 1500)
  }

  const handleClose = () => {
    setShowSuccessDialog(false)
    navigate(`/lead-followup/${contactSlug}`)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/lead-followup/${contactSlug}/email-draft-step1`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Review & Send Email</h1>
          <p className="text-muted-foreground">Make final adjustments before sending</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Email Form (Left) */}
        <div className="md:col-span-2 space-y-4">
          {/* Recipients */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Recipients</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="to">To *</Label>
                <Input
                  id="to"
                  value={email.to}
                  onChange={e => setEmail({ ...email, to: e.target.value })}
                  placeholder="recipient@example.com"
                />
              </div>
              <div>
                <Label htmlFor="cc">CC</Label>
                <Input
                  id="cc"
                  value={email.cc}
                  onChange={e => setEmail({ ...email, cc: e.target.value })}
                  placeholder="cc@example.com"
                />
              </div>
              <div>
                <Label htmlFor="bcc">BCC</Label>
                <Input
                  id="bcc"
                  value={email.bcc}
                  onChange={e => setEmail({ ...email, bcc: e.target.value })}
                  placeholder="bcc@example.com"
                />
              </div>
            </CardContent>
          </Card>

          {/* Subject & Body */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Email Content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="subject">Subject *</Label>
                <Input
                  id="subject"
                  value={email.subject}
                  onChange={e => setEmail({ ...email, subject: e.target.value })}
                  placeholder="Email subject"
                />
              </div>
              <div>
                <Label htmlFor="body">Body *</Label>
                <Textarea
                  id="body"
                  value={email.body}
                  onChange={e => setEmail({ ...email, body: e.target.value })}
                  className="min-h-64 font-mono text-sm"
                />
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <span className="font-semibold">To:</span> {email.to}
              </div>
              {email.cc && (
                <div>
                  <span className="font-semibold">CC:</span> {email.cc}
                </div>
              )}
              {email.bcc && (
                <div>
                  <span className="font-semibold">BCC:</span> {email.bcc}
                </div>
              )}
              <div className="pt-2 mt-2 border-t">
                <div className="font-semibold text-base mb-2">{email.subject}</div>
                <div className="whitespace-pre-wrap text-xs">{email.body}</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Send Options (Right) */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Send Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Send Mode */}
              <div className="space-y-3">
                <Label>Send Mode</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="now"
                      value="now"
                      checked={sendMode === 'now'}
                      onChange={e => setSendMode(e.target.value as 'now' | 'schedule')}
                      className="w-4 h-4"
                    />
                    <label htmlFor="now" className="text-sm cursor-pointer">
                      Send Now
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="schedule"
                      value="schedule"
                      checked={sendMode === 'schedule'}
                      onChange={e => setSendMode(e.target.value as 'now' | 'schedule')}
                      className="w-4 h-4"
                    />
                    <label htmlFor="schedule" className="text-sm cursor-pointer">
                      Schedule for Later
                    </label>
                  </div>
                </div>
              </div>

              {/* Schedule Options */}
              {sendMode === 'schedule' && (
                <div className="space-y-3 p-3 bg-muted rounded-lg">
                  <div>
                    <Label htmlFor="date">Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={scheduleDate}
                      onChange={e => setScheduleDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="time">Time</Label>
                    <Input
                      id="time"
                      type="time"
                      value={scheduleTime}
                      onChange={e => setScheduleTime(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Tracking */}
              <div className="space-y-2 pt-4 border-t">
                <Label className="text-sm font-semibold">Email Tracking</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically enabled to track opens and clicks
                </p>
              </div>

              {/* Send Button */}
              <Button
                onClick={handleSend}
                disabled={isSending || !email.to || !email.subject || !email.body}
                className="w-full"
                size="lg"
              >
                {isSending ? (
                  <>
                    <Send className="h-4 w-4 mr-2 animate-pulse" />
                    Sending...
                  </>
                ) : sendMode === 'now' ? (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Email
                  </>
                ) : (
                  <>
                    <Clock className="h-4 w-4 mr-2" />
                    Schedule Email
                  </>
                )}
              </Button>

              {/* Info Alert */}
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  {sendMode === 'now'
                    ? 'Email will be sent immediately'
                    : `Email will be sent on ${format(new Date(scheduleDate), 'MMM d')} at ${scheduleTime}`}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              {sendMode === 'now' ? 'Email Sent!' : 'Email Scheduled!'}
            </DialogTitle>
            <DialogDescription>
              {sendMode === 'now'
                ? 'Your email has been sent successfully with tracking enabled.'
                : `Your email has been scheduled for ${format(new Date(scheduleDate), 'MMM d')} at ${scheduleTime}`}
            </DialogDescription>
          </DialogHeader>
          <div className="pt-4 space-y-3">
            <Button onClick={handleClose} className="w-full">
              Back to Contact
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                handleClose()
                navigate(`/lead-followup/${contactSlug}/email-draft`)
              }}
              className="w-full"
            >
              Send Another Email
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
