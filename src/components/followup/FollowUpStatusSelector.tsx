/**
 * Follow-Up Status Selector
 * Searchable dropdown for status changes
 */

import { useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'

interface FollowUpStatusSelectorProps {
  value?: string
  onValueChange?: (value: string) => void
  disabled?: boolean
}

const statuses = [
  { value: 'new', label: 'New', description: 'Fresh lead, no contact yet' },
  { value: 'awaiting_response', label: 'Awaiting Response', description: 'Outreach sent, waiting for reply' },
  { value: 'follow_up_needed', label: 'Follow-Up Needed', description: 'No response after X days' },
  { value: 'engaged', label: 'Engaged', description: 'Active two-way conversation' },
  { value: 'nurturing', label: 'Nurturing', description: 'Long-term relationship building' },
  { value: 'scheduled', label: 'Scheduled', description: 'Meeting or call scheduled' },
  { value: 'completed', label: 'Completed', description: 'Deal won/lost, no longer pursuing' },
]

export function FollowUpStatusSelector({
  value,
  onValueChange,
  disabled = false,
}: FollowUpStatusSelectorProps) {
  const [search, setSearch] = useState('')

  const filtered = statuses.filter(s =>
    s.label.toLowerCase().includes(search.toLowerCase()) ||
    s.description.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger>
        <SelectValue placeholder="Select status..." />
      </SelectTrigger>
      <SelectContent>
        <div className="p-2 border-b mb-2">
          <Input
            placeholder="Search status..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8"
          />
        </div>
        {filtered.map(status => (
          <SelectItem key={status.value} value={status.value}>
            <div>
              <div className="font-medium">{status.label}</div>
              <div className="text-xs text-muted-foreground">{status.description}</div>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
