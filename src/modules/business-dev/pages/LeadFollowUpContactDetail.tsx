/**
 * Lead Follow-Up Contact Detail Page
 * 8-tab layout: Quick Actions, Communications, Timeline, Meetings, Intelligence, Opportunities, Vector, AI Agents
 */

import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Mail,
  Phone,
  Linkedin,
  ArrowLeft,
  Edit2,
  Save,
  X,
  Calendar,
  MessageSquare,
  BarChart3,
  Zap,
  Send,
  Clock,
  User,
  Building2,
  Globe,
} from 'lucide-react'
import { format } from 'date-fns'

interface ContactDetail {
  id: string
  first_name: string
  last_name?: string
  email?: string
  phone?: string
  company?: string
  title?: string
  website?: string
  linkedin_url?: string
  department?: string
  lead_score?: number
  lead_temperature?: 'hot' | 'warm' | 'cold'
  current_mood_label?: 'warm' | 'neutral' | 'cold'
  current_mood_score?: number
  current_intent_status?: 'active' | 'stalled' | 'dormant'
  followup_status?: string
  next_followup_date?: string
  last_contact_date?: string
  followup_notes?: string
  preferred_contact_channel?: string
}

export default function LeadFollowUpContactDetail() {
  const { contactSlug } = useParams<{ contactSlug: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('quick-actions')
  const [isEditing, setIsEditing] = useState(false)

  // Mock contact data
  const [contact, setContact] = useState<ContactDetail>({
    id: '1',
    first_name: 'John',
    last_name: 'Smith',
    email: 'john@acme.com',
    phone: '+1 (555) 123-4567',
    company: 'ACME Corp',
    title: 'Chief Technology Officer',
    website: 'https://acme.com',
    linkedin_url: 'https://linkedin.com/in/johnsmith',
    department: 'Technology',
    lead_score: 85,
    lead_temperature: 'hot',
    current_mood_label: 'warm',
    current_mood_score: 78,
    current_intent_status: 'active',
    followup_status: 'engaged',
    next_followup_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    last_contact_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    followup_notes: 'Interested in enterprise solution. Decision maker for tech stack.',
    preferred_contact_channel: 'email',
  })

  const [editForm, setEditForm] = useState(contact)

  const getTemperatureColor = (temp?: string) => {
    switch (temp) {
      case 'hot':
        return 'bg-red-100 text-red-800'
      case 'warm':
        return 'bg-yellow-100 text-yellow-800'
      case 'cold':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getMoodColor = (mood?: string) => {
    switch (mood) {
      case 'warm':
        return 'text-green-600'
      case 'neutral':
        return 'text-yellow-600'
      case 'cold':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  const handleSave = () => {
    setContact(editForm)
    setIsEditing(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/lead-followup')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">
                {contact.first_name} {contact.last_name}
              </h1>
              <Badge className={getTemperatureColor(contact.lead_temperature)}>
                {contact.lead_temperature || 'N/A'}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {contact.title} at {contact.company}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="icon">
            <Phone className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon">
            <Mail className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsEditing(!isEditing)}
          >
            <Edit2 className="h-4 w-4 mr-2" />
            {isEditing ? 'Cancel' : 'Edit'}
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Lead Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{contact.lead_score}</div>
            <p className="text-xs text-muted-foreground mt-1">out of 100</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Mood</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getMoodColor(contact.current_mood_label)}`}>
              {contact.current_mood_label}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {contact.current_mood_score || 0}/100
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Intent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">
              {contact.current_intent_status}
            </div>
            <p className="text-xs text-muted-foreground mt-1">momentum</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Next Follow-Up</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-semibold">
              {contact.next_followup_date
                ? format(new Date(contact.next_followup_date), 'MMM d')
                : '-'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {contact.next_followup_date
                ? format(new Date(contact.next_followup_date), 'EEEE')
                : 'Not set'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="quick-actions" className="text-xs">Quick</TabsTrigger>
          <TabsTrigger value="communications" className="text-xs">Messages</TabsTrigger>
          <TabsTrigger value="timeline" className="text-xs">Timeline</TabsTrigger>
          <TabsTrigger value="meetings" className="text-xs">Meetings</TabsTrigger>
          <TabsTrigger value="intelligence" className="text-xs">Intel</TabsTrigger>
          <TabsTrigger value="opportunities" className="text-xs">Deals</TabsTrigger>
          <TabsTrigger value="vector" className="text-xs">Vector</TabsTrigger>
          <TabsTrigger value="ai-agents" className="text-xs">AI</TabsTrigger>
        </TabsList>

        {/* Quick Actions Tab */}
        <TabsContent value="quick-actions" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Contact Info Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {isEditing ? (
                  <>
                    <div>
                      <Label>Email</Label>
                      <Input
                        value={editForm.email || ''}
                        onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Phone</Label>
                      <Input
                        value={editForm.phone || ''}
                        onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Title</Label>
                      <Input
                        value={editForm.title || ''}
                        onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Department</Label>
                      <Input
                        value={editForm.department || ''}
                        onChange={e => setEditForm({ ...editForm, department: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Website</Label>
                      <Input
                        value={editForm.website || ''}
                        onChange={e => setEditForm({ ...editForm, website: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>LinkedIn URL</Label>
                      <Input
                        value={editForm.linkedin_url || ''}
                        onChange={e => setEditForm({ ...editForm, linkedin_url: e.target.value })}
                      />
                    </div>
                    <Button onClick={handleSave} className="w-full">
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <a href={`mailto:${contact.email}`} className="hover:underline">
                        {contact.email}
                      </a>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <a href={`tel:${contact.phone}`} className="hover:underline">
                        {contact.phone}
                      </a>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>{contact.title}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span>{contact.department}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <a href={contact.website} target="_blank" rel="noopener noreferrer" className="hover:underline">
                        {contact.website}
                      </a>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Linkedin className="h-4 w-4 text-muted-foreground" />
                      <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                        LinkedIn Profile
                      </a>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button className="w-full" onClick={() => navigate(`/lead-followup/${contact.id}/email-draft`)}>
                  <Mail className="h-4 w-4 mr-2" />
                  Compose Email
                </Button>
                <Button variant="outline" className="w-full">
                  <Phone className="h-4 w-4 mr-2" />
                  Log Call
                </Button>
                <Button variant="outline" className="w-full">
                  <Calendar className="h-4 w-4 mr-2" />
                  Schedule Meeting
                </Button>
                <Button variant="outline" className="w-full">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Log Note
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Follow-Up Management */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Follow-Up Management</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Status</Label>
                  <Select defaultValue={contact.followup_status}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="engaged">Engaged</SelectItem>
                      <SelectItem value="awaiting_response">Awaiting Response</SelectItem>
                      <SelectItem value="follow_up_needed">Follow-Up Needed</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Preferred Channel</Label>
                  <Select defaultValue={contact.preferred_contact_channel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="phone">Phone</SelectItem>
                      <SelectItem value="linkedin">LinkedIn</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Follow-Up Notes</Label>
                <Textarea
                  value={contact.followup_notes}
                  readOnly={!isEditing}
                  onChange={e => setEditForm({ ...editForm, followup_notes: e.target.value })}
                  className="min-h-24"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Communications Tab */}
        <TabsContent value="communications">
          <Card>
            <CardHeader>
              <CardTitle>Communication History</CardTitle>
              <CardDescription>All emails and messages with this contact</CardDescription>
            </CardHeader>
            <CardContent className="text-center py-12">
              <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">No communications yet</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle>Activity Timeline</CardTitle>
              <CardDescription>Complete history of all interactions</CardDescription>
            </CardHeader>
            <CardContent className="text-center py-12">
              <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">No activities yet</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Meetings Tab */}
        <TabsContent value="meetings">
          <Card>
            <CardHeader>
              <CardTitle>Meetings & Events</CardTitle>
              <CardDescription>Scheduled and past meetings</CardDescription>
            </CardHeader>
            <CardContent className="text-center py-12">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">No meetings scheduled</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Intelligence Tab */}
        <TabsContent value="intelligence">
          <Card>
            <CardHeader>
              <CardTitle>AI Intelligence</CardTitle>
              <CardDescription>Mood and intent analysis</CardDescription>
            </CardHeader>
            <CardContent className="text-center py-12">
              <Zap className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">Analysis coming soon</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Opportunities Tab */}
        <TabsContent value="opportunities">
          <Card>
            <CardHeader>
              <CardTitle>Associated Deals</CardTitle>
              <CardDescription>Opportunities and deals</CardDescription>
            </CardHeader>
            <CardContent className="text-center py-12">
              <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">No associated deals</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vector Tab */}
        <TabsContent value="vector">
          <Card>
            <CardHeader>
              <CardTitle>Knowledge Base</CardTitle>
              <CardDescription>Indexed information about this contact</CardDescription>
            </CardHeader>
            <CardContent className="text-center py-12">
              <Send className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">No data indexed</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Agents Tab */}
        <TabsContent value="ai-agents">
          <Card>
            <CardHeader>
              <CardTitle>AI Insights</CardTitle>
              <CardDescription>Research and conversation openers</CardDescription>
            </CardHeader>
            <CardContent className="text-center py-12">
              <Zap className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">Generate insights coming soon</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
