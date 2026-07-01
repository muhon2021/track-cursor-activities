/**
 * Lead Follow-Up Administration Panel
 * Configure SendGrid, email tracking, and follow-up intervals
 */

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertCircle, CheckCircle2, Mail, Settings, Eye, EyeOff } from 'lucide-react'

export default function LeadFollowUpAdmin() {
  const [sendGridApiKey, setSendGridApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [fromEmail, setFromEmail] = useState('noreply@sjinnovation.com')
  const [fromName, setFromName] = useState('SJ Innovation')
  const [enableOpenTracking, setEnableOpenTracking] = useState(true)
  const [enableClickTracking, setEnableClickTracking] = useState(true)
  const [isConfigured, setIsConfigured] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const [minInterval, setMinInterval] = useState(3)
  const [maxInterval, setMaxInterval] = useState(90)
  const [defaultInterval, setDefaultInterval] = useState(7)
  const [enableAutoStatus, setEnableAutoStatus] = useState(true)

  const handleSaveSendGrid = async () => {
    setIsSaving(true)
    // Simulate saving to database
    setTimeout(() => {
      setIsConfigured(true)
      setIsSaving(false)
    }, 1000)
  }

  const handleSaveSettings = async () => {
    setIsSaving(true)
    // Simulate saving to database
    setTimeout(() => {
      setIsSaving(false)
    }, 1000)
  }

  const handleTestEmail = async () => {
    alert('Test email would be sent to your configured address')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Lead Follow-Up Administration</h1>
        <p className="text-muted-foreground mt-2">
          Configure email integration and follow-up settings
        </p>
      </div>

      <Tabs defaultValue="sendgrid" className="w-full">
        <TabsList>
          <TabsTrigger value="sendgrid">
            <Mail className="h-4 w-4 mr-2" />
            SendGrid
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="h-4 w-4 mr-2" />
            Follow-Up Settings
          </TabsTrigger>
        </TabsList>

        {/* SendGrid Configuration */}
        <TabsContent value="sendgrid" className="space-y-4">
          {isConfigured && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                SendGrid configuration saved successfully
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle>SendGrid API Configuration</CardTitle>
              <CardDescription>
                Configure SendGrid for email sending and tracking
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* API Key */}
              <div className="space-y-2">
                <Label htmlFor="api-key">API Key *</Label>
                <div className="flex gap-2">
                  <Input
                    id="api-key"
                    type={showApiKey ? 'text' : 'password'}
                    value={sendGridApiKey}
                    onChange={e => setSendGridApiKey(e.target.value)}
                    placeholder="SG.xxxxxxxxxxxxxxxxxxxxx"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Get your API key from{' '}
                  <a
                    href="https://app.sendgrid.com/settings/api_keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-foreground"
                  >
                    SendGrid Settings
                  </a>
                </p>
              </div>

              {/* From Email */}
              <div className="space-y-2">
                <Label htmlFor="from-email">From Email Address *</Label>
                <Input
                  id="from-email"
                  type="email"
                  value={fromEmail}
                  onChange={e => setFromEmail(e.target.value)}
                  placeholder="noreply@example.com"
                />
                <p className="text-xs text-muted-foreground">
                  Must be a verified sender in SendGrid
                </p>
              </div>

              {/* From Name */}
              <div className="space-y-2">
                <Label htmlFor="from-name">From Name</Label>
                <Input
                  id="from-name"
                  value={fromName}
                  onChange={e => setFromName(e.target.value)}
                  placeholder="Company Name"
                />
              </div>

              {/* Tracking Settings */}
              <div className="border-t pt-6 space-y-4">
                <h3 className="font-semibold">Email Tracking</h3>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="open-tracking"
                    checked={enableOpenTracking}
                    onCheckedChange={() => setEnableOpenTracking(!enableOpenTracking)}
                  />
                  <label htmlFor="open-tracking" className="text-sm cursor-pointer">
                    Enable open tracking (1x1 pixel)
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="click-tracking"
                    checked={enableClickTracking}
                    onCheckedChange={() => setEnableClickTracking(!enableClickTracking)}
                  />
                  <label htmlFor="click-tracking" className="text-sm cursor-pointer">
                    Enable click tracking (URL rewriting)
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4 border-t">
                <Button onClick={handleSaveSendGrid} disabled={isSaving || !sendGridApiKey}>
                  {isSaving ? 'Saving...' : 'Save Configuration'}
                </Button>
                <Button variant="outline" onClick={handleTestEmail} disabled={!sendGridApiKey}>
                  Send Test Email
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Follow-Up Settings */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Follow-Up Intervals</CardTitle>
              <CardDescription>
                Configure minimum, maximum, and default follow-up intervals
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Min Interval */}
              <div className="space-y-2">
                <Label htmlFor="min-interval">Minimum Interval (days)</Label>
                <Input
                  id="min-interval"
                  type="number"
                  min="1"
                  max="30"
                  value={minInterval}
                  onChange={e => setMinInterval(parseInt(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  Minimum days between follow-ups (1-30)
                </p>
              </div>

              {/* Max Interval */}
              <div className="space-y-2">
                <Label htmlFor="max-interval">Maximum Interval (days)</Label>
                <Input
                  id="max-interval"
                  type="number"
                  min="30"
                  max="180"
                  value={maxInterval}
                  onChange={e => setMaxInterval(parseInt(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  Maximum days between follow-ups (30-180)
                </p>
              </div>

              {/* Default Interval */}
              <div className="space-y-2">
                <Label htmlFor="default-interval">Default Interval (days)</Label>
                <Input
                  id="default-interval"
                  type="number"
                  min={minInterval}
                  max={maxInterval}
                  value={defaultInterval}
                  onChange={e => setDefaultInterval(parseInt(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  Default interval for new follow-ups
                </p>
              </div>

              {/* Auto Status Rules */}
              <div className="border-t pt-6 space-y-4">
                <h3 className="font-semibold">Automated Status Rules</h3>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="auto-status"
                    checked={enableAutoStatus}
                    onCheckedChange={() => setEnableAutoStatus(!enableAutoStatus)}
                  />
                  <label htmlFor="auto-status" className="text-sm cursor-pointer">
                    Enable automatic status updates via cron job
                  </label>
                </div>

                {enableAutoStatus && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      <strong>Rules applied daily at 6:00 AM UTC:</strong>
                      <ul className="mt-2 space-y-1 ml-4 list-disc">
                        <li>awaiting_response + 7 days → follow_up_needed</li>
                        <li>new lead + 14 days → follow_up_needed</li>
                        <li>past due date → follow_up_needed</li>
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Save Button */}
              <div className="flex gap-2 pt-4 border-t">
                <Button onClick={handleSaveSettings} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Settings'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
