/**
 * Lead Follow-Up Dashboard
 * Main page with three tabs: Today's Follow-Ups, My Follow-Ups, All Follow-Ups
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Calendar,
  Mail,
  Phone,
  Search,
  TrendingUp,
  Users,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Loader2,
  BarChart3,
  Target,
  UserCheck,
  CalendarCheck,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { format, isSameDay, isBefore, startOfToday, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns'
import { Skeleton } from '@/components/ui/skeleton'
import { EmailIntegrationBanner } from '@/components/common/EmailIntegrationBanner'

interface Contact {
  id: string
  first_name: string
  last_name?: string
  email?: string
  company?: string
  title?: string
  lead_score?: number
  lead_temperature?: 'hot' | 'warm' | 'cold'
  current_mood_label?: 'warm' | 'neutral' | 'cold'
  current_intent_status?: 'active' | 'stalled' | 'dormant'
  next_followup_date?: string
  last_contact_date?: string
  followup_status?: string
  followup_assigned_to?: string
  assigned_user?: { full_name: string }
}

export default function LeadFollowUp() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [tab, setTab] = useState('today')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [assigneeFilter, setAssigneeFilter] = useState('all')
  const [isLoading, setIsLoading] = useState(false)
  const [contacts, setContacts] = useState<Contact[]>([])

  // Mock data - replace with actual API call
  const mockContacts: Contact[] = [
    {
      id: '1',
      first_name: 'John',
      last_name: 'Smith',
      email: 'john@acme.com',
      company: 'ACME Corp',
      title: 'CTO',
      lead_score: 85,
      lead_temperature: 'hot',
      current_mood_label: 'warm',
      current_intent_status: 'active',
      next_followup_date: new Date().toISOString(),
      last_contact_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      followup_status: 'engaged',
      assigned_user: { full_name: 'You' },
    },
    {
      id: '2',
      first_name: 'Jane',
      last_name: 'Doe',
      email: 'jane@techco.com',
      company: 'TechCo',
      title: 'VP Sales',
      lead_score: 72,
      lead_temperature: 'warm',
      current_mood_label: 'neutral',
      current_intent_status: 'stalled',
      next_followup_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      last_contact_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      followup_status: 'follow_up_needed',
      assigned_user: { full_name: 'You' },
    },
  ]

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

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'engaged':
        return 'bg-green-100 text-green-800'
      case 'follow_up_needed':
        return 'bg-orange-100 text-orange-800'
      case 'awaiting_response':
        return 'bg-blue-100 text-blue-800'
      case 'completed':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const assigneeOptions = Array.from(new Set(mockContacts.map(c => c.assigned_user?.full_name).filter(Boolean))) as string[]

  const filteredContacts = mockContacts.filter(c => {
    if (search && !`${c.first_name} ${c.last_name} ${c.email || ''}`.toLowerCase().includes(search.toLowerCase())) {
      return false
    }
    if (statusFilter !== 'all' && c.followup_status !== statusFilter) {
      return false
    }
    if (assigneeFilter !== 'all' && c.assigned_user?.full_name !== assigneeFilter) {
      return false
    }
    return true
  })

  const todayContacts = filteredContacts.filter(c => {
    if (!c.next_followup_date) return false
    const nextDate = new Date(c.next_followup_date)
    return isSameDay(nextDate, startOfToday()) || isBefore(nextDate, new Date())
  })

  const overdueContacts = filteredContacts.filter(c => {
    if (!c.next_followup_date) return false
    const nextDate = new Date(c.next_followup_date)
    return isBefore(nextDate, startOfToday())
  })

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 })

  const followUpsThisWeek = (list: Contact[]) =>
    list.filter(c => c.next_followup_date && isWithinInterval(new Date(c.next_followup_date), { start: weekStart, end: weekEnd })).length
  const activitiesThisWeek = (list: Contact[]) =>
    list.filter(c => c.last_contact_date && isWithinInterval(new Date(c.last_contact_date), { start: weekStart, end: weekEnd })).length
  const overdueCount = (list: Contact[]) =>
    list.filter(c => c.next_followup_date && isBefore(new Date(c.next_followup_date), startOfToday())).length

  const allOverdue = mockContacts.filter(c => c.next_followup_date && isBefore(new Date(c.next_followup_date), startOfToday())).length
  const allFollowUpsThisWeek = followUpsThisWeek(mockContacts)
  const allActivitiesThisWeek = activitiesThisWeek(mockContacts)

  const searchFilterBar = (
    <div className="w-full rounded-lg border border-border/60 bg-muted/30 p-4 flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10 rounded-md bg-background"
        />
      </div>
      <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
        <SelectTrigger className="w-[180px] rounded-md bg-background border-primary/50 focus:ring-2 focus:ring-primary/20">
          <SelectValue placeholder="All Assignees" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Assignees</SelectItem>
          {assigneeOptions.map(name => (
            <SelectItem key={name} value={name}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-[160px] rounded-md bg-background">
          <SelectValue placeholder="All Statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="engaged">Engaged</SelectItem>
          <SelectItem value="follow_up_needed">Follow Up Needed</SelectItem>
          <SelectItem value="awaiting_response">Awaiting Response</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )

  const ContactRow = ({ contact }: { contact: Contact }) => (
    <TableRow
      className="cursor-pointer hover:bg-muted"
      onClick={() => navigate(`/lead-followup/${contact.id}`)}
    >
      <TableCell className="font-medium">
        {contact.first_name} {contact.last_name}
      </TableCell>
      <TableCell>{contact.title || '-'}</TableCell>
      <TableCell>{contact.assigned_user?.full_name || '-'}</TableCell>
      <TableCell>
        <Badge className={getTemperatureColor(contact.lead_temperature)}>
          {contact.lead_temperature || 'N/A'}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{contact.lead_score || 0}</span>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </div>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {contact.last_contact_date
          ? format(new Date(contact.last_contact_date), 'MMM d')
          : '-'}
      </TableCell>
      <TableCell>
        <Badge className={getStatusColor(contact.followup_status)}>
          {contact.followup_status || 'pending'}
        </Badge>
      </TableCell>
      <TableCell>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </TableCell>
    </TableRow>
  )

  return (
    <div className="space-y-6">
      <EmailIntegrationBanner page="lead-followup" />
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Lead Follow-Up</h1>
        <p className="text-muted-foreground mt-2">
          Manage your lead follow-ups with AI-powered insights
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList>
          <TabsTrigger value="today">
            <Calendar className="h-4 w-4 mr-2" />
            Today's Follow-Up ({todayContacts.length})
          </TabsTrigger>
          <TabsTrigger value="my">
            <Users className="h-4 w-4 mr-2" />
            My Follow-Ups ({filteredContacts.length})
          </TabsTrigger>
          <TabsTrigger value="all">
            <Target className="h-4 w-4 mr-2" />
            All Follow-Ups ({mockContacts.length})
          </TabsTrigger>
        </TabsList>

        {/* Card section: changes by tab */}
        {tab === 'today' && (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-3 mt-6">
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Overdue</CardTitle>
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <AlertCircle className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overdueContacts.length}</div>
              </CardContent>
            </Card>
            <Card className="border-primary/30">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Lead Follow-Up Pending</CardTitle>
                <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
                  <UserCheck className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{todayContacts.length}</div>
                <p className="text-xs text-muted-foreground mt-1">Total pending leads</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Overall Progress</CardTitle>
              </CardHeader>
                <CardContent>
                <div className="space-y-2">
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{
                        width: todayContacts.length
                          ? `${Math.min(100, (Math.max(0, todayContacts.length - overdueContacts.length) / todayContacts.length) * 100)}%`
                          : '0%',
                      }}
                    />
                  </div>
                  <p className="text-sm font-medium tabular-nums">
                    {Math.max(0, todayContacts.length - overdueContacts.length)}/{todayContacts.length}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        {(tab === 'my' || tab === 'all') && (() => {
          const list = tab === 'my' ? filteredContacts : mockContacts
          const total = list.length
          const weekFollowUps = tab === 'my' ? followUpsThisWeek(filteredContacts) : allFollowUpsThisWeek
          const weekActivities = tab === 'my' ? activitiesThisWeek(filteredContacts) : allActivitiesThisWeek
          const overdue = tab === 'my' ? overdueCount(filteredContacts) : allOverdue
          return (
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4 mt-6">
              <Card>
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Lead Follow-ups</CardTitle>
                  <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
                    <UserCheck className="h-4 w-4 text-primary" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{total}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Follow-ups This Week</CardTitle>
                  <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
                    <CalendarCheck className="h-4 w-4 text-primary" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{weekFollowUps}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Activities This Week</CardTitle>
                  <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
                    <CalendarCheck className="h-4 w-4 text-primary" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{weekActivities}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Overdue Follow-ups</CardTitle>
                  <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
                    <AlertCircle className="h-4 w-4 text-primary" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{overdue}</div>
                </CardContent>
              </Card>
            </div>
          )
        })()}

        {/* Today Tab */}
        <TabsContent value="today" className="space-y-4">
          {searchFilterBar}
          {overdueContacts.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {overdueContacts.length} leads are overdue for follow-up
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Today's Follow-Ups</CardTitle>
                  <CardDescription>Contacts due for follow-up today</CardDescription>
                </div>
                <Button size="sm">
                  <Mail className="h-4 w-4 mr-2" />
                  Send Batch Email
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {todayContacts.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-2 opacity-50" />
                  <p className="text-muted-foreground font-medium">All caught up!</p>
                  <p className="text-sm text-muted-foreground">No follow-ups due today</p>
                </div>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Assigned To</TableHead>
                        <TableHead>Temp</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Last Contact</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {todayContacts.map(contact => (
                        <ContactRow key={contact.id} contact={contact} />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* My Follow-Ups Tab */}
        <TabsContent value="my" className="space-y-4">
          {searchFilterBar}
          <Card>
            <CardHeader>
              <CardTitle>My Follow-Ups</CardTitle>
              <CardDescription>Contacts assigned to you</CardDescription>
            </CardHeader>
            <CardContent>
              {filteredContacts.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-2 opacity-50" />
                  <p className="text-muted-foreground font-medium">No contacts found</p>
                </div>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Assigned To</TableHead>
                        <TableHead>Temp</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Last Contact</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredContacts.map(contact => (
                        <ContactRow key={contact.id} contact={contact} />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* All Follow-Ups Tab */}
        <TabsContent value="all" className="space-y-4">
          {searchFilterBar}
          <Card>
            <CardHeader>
              <CardTitle>All Follow-Ups</CardTitle>
              <CardDescription>Complete view of all team follow-ups</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Temp</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Last Contact</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredContacts.map(contact => (
                      <ContactRow key={contact.id} contact={contact} />
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
