/**
 * Communication History Page
 * Paginated list of all contact interactions
 */

import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowLeft,
  Mail,
  Phone,
  MessageSquare,
  Calendar,
  FileText,
  Filter,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'

interface CommunicationItem {
  id: string
  type: 'email' | 'phone' | 'meeting' | 'note' | 'linkedin'
  direction: 'inbound' | 'outbound'
  subject?: string
  content: string
  timestamp: Date
  duration?: number
  status?: 'sent' | 'opened' | 'clicked'
}

export default function LeadFollowUpCommunication() {
  const { contactSlug } = useParams<{ contactSlug: string }>()
  const navigate = useNavigate()
  const [filterType, setFilterType] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Mock data
  const communications: CommunicationItem[] = [
    {
      id: '1',
      type: 'email',
      direction: 'outbound',
      subject: 'Quick check-in – Let\'s explore opportunities',
      content: 'Hi John, I wanted to reach out about our enterprise solution...',
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      status: 'opened'
    },
    {
      id: '2',
      type: 'meeting',
      direction: 'inbound',
      subject: 'Product demo call',
      content: 'Discussed pricing and implementation timeline',
      timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      duration: 45
    },
    {
      id: '3',
      type: 'email',
      direction: 'inbound',
      subject: 'Re: Quick check-in',
      content: 'Thanks for reaching out. We\'re interested in learning more...',
      timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    },
  ]

  const filtered = filterType === 'all'
    ? communications
    : communications.filter(c => c.type === filterType)

  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const paginatedItems = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'email':
        return <Mail className="h-4 w-4" />
      case 'phone':
        return <Phone className="h-4 w-4" />
      case 'meeting':
        return <Calendar className="h-4 w-4" />
      case 'note':
        return <FileText className="h-4 w-4" />
      case 'linkedin':
        return <MessageSquare className="h-4 w-4" />
      default:
        return null
    }
  }

  const getDirectionColor = (direction: string) => {
    return direction === 'outbound'
      ? 'bg-blue-100 text-blue-800'
      : 'bg-green-100 text-green-800'
  }

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'sent':
        return 'text-gray-600'
      case 'opened':
        return 'text-green-600'
      case 'clicked':
        return 'text-blue-600'
      default:
        return 'text-gray-600'
    }
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
          <h1 className="text-3xl font-bold">Communication History</h1>
          <p className="text-muted-foreground">All interactions with this contact</p>
        </div>
      </div>

      {/* Filter */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm">Filter Communications</CardTitle>
              <CardDescription>View communications by type</CardDescription>
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-40">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="email">Emails</SelectItem>
                <SelectItem value="phone">Phone Calls</SelectItem>
                <SelectItem value="meeting">Meetings</SelectItem>
                <SelectItem value="note">Notes</SelectItem>
                <SelectItem value="linkedin">LinkedIn</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      {/* Communications List */}
      <div className="space-y-2">
        {paginatedItems.map(item => (
          <Card key={item.id} className="hover:bg-muted/50 transition-colors">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1">
                  {/* Icon */}
                  <div className="mt-1 text-muted-foreground">
                    {getTypeIcon(item.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-sm truncate">
                        {item.subject || `${item.type.charAt(0).toUpperCase() + item.type.slice(1)} - ${item.content.substring(0, 50)}...`}
                      </h3>
                      <Badge variant="outline" className={`capitalize ${getDirectionColor(item.direction)}`}>
                        {item.direction === 'outbound' ? 'Sent' : 'Received'}
                      </Badge>
                      {item.status && (
                        <Badge variant="outline" className={getStatusColor(item.status)}>
                          {item.status === 'clicked' ? 'Clicked' : item.status === 'opened' ? 'Opened' : 'Sent'}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {item.content}
                    </p>
                  </div>
                </div>

                {/* Time & Duration */}
                <div className="text-right text-xs text-muted-foreground whitespace-nowrap">
                  <div>{format(item.timestamp, 'MMM d, yyyy')}</div>
                  <div>{format(item.timestamp, 'h:mm a')}</div>
                  {item.duration && <div className="mt-1 font-semibold">{item.duration}m</div>}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {paginatedItems.length === 0 && (
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground font-medium">No communications found</p>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages} • {filtered.length} total
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
