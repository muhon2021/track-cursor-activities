/**
 * Activity Timeline
 * Chronological activity list
 */

import { Mail, Phone, Calendar, FileText, MessageSquare, Loader2 } from 'lucide-react'
import { format } from 'date-fns'

interface Activity {
  id: string
  type: 'email' | 'phone' | 'meeting' | 'note' | 'linkedin'
  subject?: string
  description?: string
  timestamp: Date
  direction?: 'inbound' | 'outbound'
}

interface ActivityTimelineProps {
  activities: Activity[]
  isLoading?: boolean
  emptyMessage?: string
}

const activityIcons: Record<string, React.ReactNode> = {
  email: <Mail className="h-4 w-4" />,
  phone: <Phone className="h-4 w-4" />,
  meeting: <Calendar className="h-4 w-4" />,
  note: <FileText className="h-4 w-4" />,
  linkedin: <MessageSquare className="h-4 w-4" />,
}

const activityColors: Record<string, string> = {
  email: 'bg-blue-100 text-blue-900',
  phone: 'bg-green-100 text-green-900',
  meeting: 'bg-purple-100 text-purple-900',
  note: 'bg-yellow-100 text-yellow-900',
  linkedin: 'bg-cyan-100 text-cyan-900',
}

export function ActivityTimeline({
  activities,
  isLoading = false,
  emptyMessage = 'No activities yet',
}: ActivityTimelineProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!activities || activities.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {activities.map((activity, index) => (
        <div key={activity.id} className="relative">
          {/* Timeline line */}
          {index !== activities.length - 1 && (
            <div className="absolute left-5 top-10 h-8 w-px bg-border" />
          )}

          {/* Activity item */}
          <div className="flex gap-4">
            {/* Icon */}
            <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${activityColors[activity.type]}`}>
              {activityIcons[activity.type]}
            </div>

            {/* Content */}
            <div className="flex-1 pb-4">
              <div className="font-semibold text-sm">
                {activity.subject || `${activity.type.charAt(0).toUpperCase() + activity.type.slice(1)} activity`}
              </div>
              {activity.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {activity.description}
                </p>
              )}
              <div className="text-xs text-muted-foreground mt-2">
                {format(activity.timestamp, 'MMM d, yyyy h:mm a')}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
