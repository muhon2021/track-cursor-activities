export type MeetingProvider =
  | 'zoom'
  | 'google_meet'
  | 'microsoft_teams'
  | 'webex'
  | 'other'

export interface MeetingProviderConfig {
  provider: MeetingProvider
  externalId?: string
  externalMeetingId?: string
  externalUuid?: string
  joinUrl?: string
  hostUrl?: string
}

export interface MeetingFileInput {
  meetingId: string
  provider: MeetingProvider
  externalMeetingId?: string
  fileType: string
  fileName: string
  fileSize?: number
  downloadUrl?: string
  metadata?: Record<string, unknown>
}

export function getMeetingProviderFromUrl(url: string): MeetingProvider {
  if (url.includes('zoom.us')) return 'zoom'
  if (url.includes('meet.google.com')) return 'google_meet'
  if (url.includes('teams.microsoft.com')) return 'microsoft_teams'
  if (url.includes('webex.com')) return 'webex'
  return 'other'
}
