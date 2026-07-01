/**
 * Compact Contact Card
 * Quick summary card for a contact
 */

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Mail, Phone, Building2 } from 'lucide-react'
import { FollowUpStatusBadge } from './FollowUpStatusBadge'
import { MoodBadge } from './MoodBadge'
import { IntentBadge } from './IntentBadge'

interface CompactContactCardProps {
  firstName: string
  lastName?: string
  email?: string
  phone?: string
  company?: string
  title?: string
  status?: string
  mood?: 'warm' | 'neutral' | 'cold'
  intent?: 'active' | 'stalled' | 'dormant'
  onClick?: () => void
}

export function CompactContactCard({
  firstName,
  lastName,
  email,
  phone,
  company,
  title,
  status,
  mood,
  intent,
  onClick,
}: CompactContactCardProps) {
  return (
    <Card className="hover:bg-muted/50 cursor-pointer transition-colors" onClick={onClick}>
      <CardContent className="pt-6">
        <div className="space-y-3">
          {/* Name and Title */}
          <div>
            <h3 className="font-semibold text-base">
              {firstName} {lastName}
            </h3>
            <p className="text-sm text-muted-foreground">{title || company}</p>
          </div>

          {/* Contact Info */}
          <div className="space-y-1">
            {email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a href={`mailto:${email}`} className="hover:underline">
                  {email}
                </a>
              </div>
            )}
            {phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <a href={`tel:${phone}`} className="hover:underline">
                  {phone}
                </a>
              </div>
            )}
            {company && (
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                {company}
              </div>
            )}
          </div>

          {/* Badges */}
          <div className="flex gap-2 flex-wrap">
            {status && <FollowUpStatusBadge status={status} />}
            {mood && <MoodBadge label={mood} />}
            {intent && <IntentBadge status={intent} />}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
