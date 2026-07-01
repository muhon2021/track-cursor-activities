/**
 * Microsoft Teams Meeting Service
 * Handles fetching and normalizing Teams online meetings from Graph API
 */

import { callGraphAPI, ForbiddenError } from './microsoftGraphClient';

// ============================================================================
// Types
// ============================================================================

export interface TeamsMeeting {
  id: string;
  subject: string | null;
  startDateTime: string | null;
  endDateTime: string | null;
  joinWebUrl: string;
  createdDateTime: string;
  participants?: {
    organizer?: {
      upn?: string;
      identity?: {
        user?: {
          displayName?: string;
        };
      };
    };
  };
}

export interface TeamsOnlineMeetingsResponse {
  '@odata.context': string;
  '@odata.nextLink'?: string;
  value: TeamsMeeting[];
}

export interface NormalizedMeeting {
  title: string;
  scheduled_at: string | null;
  duration_minutes: number | null;
  join_url: string;
  teams_meeting_id: string;
  meeting_type: 'teams';
  status: 'scheduled' | 'completed' | 'cancelled';
}

// ============================================================================
// Utilities
// ============================================================================

const RATE_LIMIT_DELAY_MS = 100;
const MAX_RETRIES = 3;
const RATE_LIMIT_BACKOFF_MULTIPLIER = 2;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withRateLimitRetry<T>(
  fn: () => Promise<T>,
  context: string = 'API call'
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const backoffMs = RATE_LIMIT_DELAY_MS * Math.pow(RATE_LIMIT_BACKOFF_MULTIPLIER, attempt);
        console.log(`[TeamsMeetings] Rate limit backoff: ${backoffMs}ms (attempt ${attempt + 1})`);
        await sleep(backoffMs);
      }
      
      return await fn();
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Check for rate limit error (429)
      if (error && typeof error === 'object' && 'statusCode' in error && (error as { statusCode: number }).statusCode === 429) {
        const retryAfter = (error as { headers?: { 'retry-after'?: number } }).headers?.['retry-after'] || 5;
        console.warn(`[TeamsMeetings] Rate limited on ${context}. Waiting ${retryAfter}s...`);
        await sleep(retryAfter * 1000);
        continue;
      }
      
      throw error;
    }
  }
  
  throw lastError || new Error(`${context} failed after ${MAX_RETRIES} retries`);
}

// ============================================================================
// Duration & Status Helpers
// ============================================================================

/**
 * Calculate duration in minutes from start and end datetime strings
 */
export function calculateDurationMinutes(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  
  try {
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      console.warn('[TeamsMeetings] Invalid date format for duration calculation');
      return null;
    }
    
    const diffMs = endDate.getTime() - startDate.getTime();
    if (diffMs < 0) {
      console.warn('[TeamsMeetings] End time is before start time');
      return null;
    }
    
    return Math.round(diffMs / 60000); // Convert to minutes
  } catch (error) {
    console.error('[TeamsMeetings] Error calculating duration:', error);
    return null;
  }
}

/**
 * Determine meeting status based on end time
 */
export function determineStatus(meeting: TeamsMeeting): 'scheduled' | 'completed' {
  if (!meeting.endDateTime) return 'scheduled';
  
  try {
    const endDate = new Date(meeting.endDateTime);
    if (isNaN(endDate.getTime())) return 'scheduled';
    
    return endDate < new Date() ? 'completed' : 'scheduled';
  } catch {
    return 'scheduled';
  }
}

// ============================================================================
// Normalization
// ============================================================================

/**
 * Normalize a Teams meeting to our app's meeting format
 * Returns null if the meeting is invalid (missing required fields)
 */
export function normalizeMeeting(meeting: TeamsMeeting): NormalizedMeeting | null {
  // Skip meetings without essential fields
  if (!meeting.id || !meeting.joinWebUrl) {
    console.warn('[TeamsMeetings] Skipping meeting with missing required fields:', {
      id: meeting.id,
      hasJoinUrl: !!meeting.joinWebUrl,
    });
    return null;
  }
  
  return {
    title: meeting.subject || 'Untitled Teams Meeting',
    scheduled_at: meeting.startDateTime || null,
    duration_minutes: calculateDurationMinutes(meeting.startDateTime, meeting.endDateTime),
    join_url: meeting.joinWebUrl,
    teams_meeting_id: meeting.id,
    meeting_type: 'teams',
    status: determineStatus(meeting),
  };
}

// ============================================================================
// API Operations
// ============================================================================

/**
 * Fetch a specific online meeting by ID
 * 
 * @param meetingId - The Teams meeting ID
 * @returns The Teams meeting details
 * @throws ForbiddenError if missing OnlineMeetings.Read permission
 */
export async function getOnlineMeetingById(meetingId: string): Promise<TeamsMeeting> {
  console.log(`[TeamsMeetings] Fetching meeting ${meetingId}...`);
  
  try {
    const response = await withRateLimitRetry(
      () => callGraphAPI<TeamsMeeting>(`/me/onlineMeetings/${meetingId}`),
      'Fetching meeting by ID'
    );
    
    return response;
  } catch (error) {
    if (error instanceof ForbiddenError) {
      throw new ForbiddenError(
        'Missing OnlineMeetings.Read permission. Please disconnect and reconnect your Microsoft account to grant this permission.'
      );
    }
    throw error;
  }
}

/**
 * NOTE: Microsoft Graph API does NOT support listing all online meetings.
 * The /me/onlineMeetings endpoint requires a $filter parameter.
 * 
 * For listing meetings, use the local database (meetings table with meeting_type='teams').
 * 
 * This function is deprecated and returns an empty array.
 * @deprecated Use database query instead
 */
export async function fetchAndNormalizeMeetings(): Promise<NormalizedMeeting[]> {
  console.warn('[TeamsMeetings] Bulk listing from Graph API is not supported. Use database query instead.');
  return [];
}

// ============================================================================
// Calendar Event Types
// ============================================================================

interface CalendarEvent {
  id: string;
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  isOnlineMeeting: boolean;
  onlineMeeting?: {
    joinUrl: string;
  };
  onlineMeetingUrl?: string;
  createdDateTime?: string;
}

interface CalendarEventsResponse {
  '@odata.context'?: string;
  '@odata.nextLink'?: string;
  value: CalendarEvent[];
}

// ============================================================================
// Calendar Sync
// ============================================================================

/**
 * Fetch calendar events that have online meetings (Teams links)
 * Requires Calendars.Read permission
 * 
 * NOTE: This requires an Exchange Online mailbox. Will fail gracefully
 * for users with only Teams licensing.
 * 
 * @param daysAhead - Number of days in the future to fetch (default: 30)
 * @param daysBehind - Number of days in the past to fetch (default: 7)
 * @returns Normalized meetings from calendar
 */
export async function getOnlineMeetingsFromCalendar(
  daysAhead: number = 30,
  daysBehind: number = 7
): Promise<NormalizedMeeting[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBehind);
  
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + daysAhead);

  // NOTE: isOnlineMeeting is NOT a filterable property in Graph API - filter client-side instead
  const filter = `start/dateTime ge '${startDate.toISOString()}' and start/dateTime le '${endDate.toISOString()}'`;
  const url = `/me/calendar/events?$filter=${encodeURIComponent(filter)}&$select=id,subject,start,end,isOnlineMeeting,onlineMeeting,onlineMeetingUrl,createdDateTime&$orderby=start/dateTime&$top=100`;

  console.log('[TeamsMeetings] Fetching calendar events with Teams meetings...');

  try {
    const response = await withRateLimitRetry(
      () => callGraphAPI<CalendarEventsResponse>(url),
      'Fetching calendar events'
    );

    const meetings = response.value
      .filter(event => event.onlineMeeting?.joinUrl || event.onlineMeetingUrl)
      .map(event => {
        const joinUrl = event.onlineMeeting?.joinUrl || event.onlineMeetingUrl || '';
        const duration = calculateDurationMinutes(event.start.dateTime, event.end.dateTime);
        const endDateTime = new Date(event.end.dateTime);
        const status: 'scheduled' | 'completed' = endDateTime < new Date() ? 'completed' : 'scheduled';

        return {
          title: event.subject || 'Untitled Meeting',
          scheduled_at: event.start.dateTime,
          duration_minutes: duration,
          join_url: joinUrl,
          teams_meeting_id: event.id, // Using calendar event ID as reference
          meeting_type: 'teams' as const,
          status,
        };
      });

    console.log(`[TeamsMeetings] Found ${meetings.length} calendar events with Teams meetings`);
    return meetings;
  } catch (error: unknown) {
    // Handle users without Exchange mailbox gracefully
    if (error instanceof Error) {
      if (error.message?.includes('MailboxNotEnabledForRESTAPI') || 
          error.message?.includes('MailboxNotSupportedForRESTAPI')) {
        console.warn('[TeamsMeetings] Calendar sync not available - no Exchange mailbox');
        throw new Error('Calendar sync requires an Exchange Online mailbox. Your account may only have Teams licensing.');
      }
      if (error.message?.includes('Calendars.Read')) {
        throw new Error('Missing Calendars.Read permission. Please disconnect and reconnect your Microsoft account.');
      }
    }
    throw error;
  }
}

// ============================================================================
// Meeting Creation Types
// ============================================================================

export interface CreateMeetingRequest {
  subject: string;
  startDateTime: string;
  endDateTime: string;
  attendees?: Array<{
    upn?: string;
    emailAddress?: string;
  }>;
}

/**
 * Response from POST /me/onlineMeetings endpoint
 */
export interface OnlineMeetingResponse {
  id: string;
  subject: string;
  startDateTime: string;
  endDateTime: string;
  joinWebUrl: string;
  audioConferencing?: {
    dialinUrl?: string;
    tollNumber?: string;
  };
}

export interface CreatedTeamsMeeting {
  teams_meeting_id: string;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  join_url: string;
  meeting_type: 'teams';
  status: 'scheduled';
  calendar_event_id?: string;
  calendar_synced: boolean;
}

// ============================================================================
// Calendar Event Creation
// ============================================================================

interface CreateCalendarEventRequest {
  subject: string;
  startDateTime: string;
  endDateTime: string;
  joinUrl: string;
  attendees?: string[];
}

interface CalendarEventResponse {
  id: string;
  webLink: string;
}

/**
 * Create a calendar event with Teams meeting link
 * Requires Calendars.ReadWrite permission and Exchange mailbox
 * 
 * @param input - Event details with Teams join URL
 * @returns Event ID and web link, or null if creation failed
 */
async function createCalendarEventWithMeeting(
  input: CreateCalendarEventRequest
): Promise<{ eventId: string; webLink: string } | null> {
  const requestBody = {
    subject: input.subject,
    start: {
      dateTime: input.startDateTime,
      timeZone: 'UTC',
    },
    end: {
      dateTime: input.endDateTime,
      timeZone: 'UTC',
    },
    body: {
      contentType: 'HTML',
      content: `<p>Join the Teams meeting: <a href="${input.joinUrl}">${input.joinUrl}</a></p>`,
    },
    isOnlineMeeting: true,
    onlineMeetingProvider: 'teamsForBusiness',
    attendees: input.attendees?.map(email => ({
      emailAddress: { address: email },
      type: 'required',
    })) || [],
  };

  console.log('[TeamsMeetings] Creating calendar event for meeting:', input.subject);

  try {
    const response = await callGraphAPI<CalendarEventResponse>(
      '/me/calendar/events',
      { method: 'POST', body: JSON.stringify(requestBody) }
    );
    
    console.log('[TeamsMeetings] Calendar event created:', response.id);
    return { eventId: response.id, webLink: response.webLink };
  } catch (error) {
    // Return null if calendar creation fails (user may not have Exchange)
    if (error instanceof Error) {
      if (error.message?.includes('MailboxNotEnabledForRESTAPI') || 
          error.message?.includes('MailboxNotSupportedForRESTAPI')) {
        console.warn('[TeamsMeetings] Calendar event creation skipped - no Exchange mailbox');
      } else if (error.message?.includes('Calendars.ReadWrite')) {
        console.warn('[TeamsMeetings] Calendar event creation skipped - missing Calendars.ReadWrite permission');
      } else {
        console.warn('[TeamsMeetings] Calendar event creation failed:', error.message);
      }
    }
    return null;
  }
}

// ============================================================================
// Meeting Creation
// ============================================================================

/**
 * Create a new online meeting in Microsoft Teams
 * Uses /me/onlineMeetings endpoint which works for all Teams users
 * (doesn't require Exchange Online mailbox like the calendar approach)
 * 
 * @param input - Meeting details (subject, start/end times, attendees)
 * @returns Created meeting details including join URL
 * @throws ForbiddenError if missing OnlineMeetings.ReadWrite permission
 */
export async function createOnlineMeeting(
  input: CreateMeetingRequest
): Promise<CreatedTeamsMeeting> {
  // Validate input dates
  const startDate = new Date(input.startDateTime);
  const endDate = new Date(input.endDateTime);
  
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw new Error('Invalid date format');
  }
  
  if (endDate <= startDate) {
    throw new Error('End time must be after start time');
  }
  
  if (startDate.getTime() < Date.now() - 60000) { // 1 minute buffer
    throw new Error('Start time must be in the future');
  }
  
  // Validate subject
  const subject = input.subject?.trim();
  if (!subject || subject.length === 0) {
    throw new Error('Meeting title is required');
  }
  
  if (subject.length > 200) {
    throw new Error('Meeting title must be less than 200 characters');
  }

  // Build onlineMeetings request body
  const requestBody: Record<string, unknown> = {
    subject: subject,
    startDateTime: startDate.toISOString(),
    endDateTime: endDate.toISOString(),
    lobbyBypassSettings: {
      scope: 'organization', // Only org members bypass lobby
    },
  };

  // Add participants if attendees provided
  if (input.attendees && input.attendees.length > 0) {
    const validAttendees = input.attendees
      .filter(a => a.upn || a.emailAddress)
      .map(a => ({
        upn: a.upn || a.emailAddress,
      }));
    
    if (validAttendees.length > 0) {
      requestBody.participants = {
        attendees: validAttendees,
      };
    }
  }

  console.log('[TeamsMeetings] Creating online meeting:', subject);

  try {
    // Create online meeting directly (no calendar/Exchange dependency)
    const response = await withRateLimitRetry(
      () => callGraphAPI<OnlineMeetingResponse>(
        '/me/onlineMeetings',
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
        }
      ),
      'Creating online meeting'
    );
    
    if (!response.id || !response.joinWebUrl) {
      throw new Error('Invalid response from Microsoft Graph API - missing meeting ID or join URL');
    }
    
    const durationMinutes = calculateDurationMinutes(
      response.startDateTime,
      response.endDateTime
    );
    
    console.log('[TeamsMeetings] Online meeting created successfully:', response.id);
    
    // Step 2: Try to create calendar event (optional, may fail without Exchange mailbox)
    const attendeeEmails = input.attendees
      ?.map(a => a.emailAddress || a.upn || '')
      .filter(email => email.length > 0) || [];
    
    const calendarEvent = await createCalendarEventWithMeeting({
      subject: response.subject,
      startDateTime: response.startDateTime,
      endDateTime: response.endDateTime,
      joinUrl: response.joinWebUrl,
      attendees: attendeeEmails,
    });
    
    return {
      teams_meeting_id: response.id,
      title: response.subject,
      scheduled_at: response.startDateTime,
      duration_minutes: durationMinutes || 60,
      join_url: response.joinWebUrl,
      meeting_type: 'teams',
      status: 'scheduled',
      calendar_event_id: calendarEvent?.eventId,
      calendar_synced: !!calendarEvent,
    };
  } catch (error) {
    if (error instanceof ForbiddenError) {
      throw new ForbiddenError(
        'Missing OnlineMeetings.ReadWrite permission. Please disconnect and reconnect your Microsoft account to grant this permission.'
      );
    }
    console.error('[TeamsMeetings] Failed to create online meeting:', error);
    throw error;
  }
}

// ============================================================================
// Outlook Calendar Events (All Events, not just Teams)
// ============================================================================

export interface OutlookCalendarEvent {
  id: string;
  subject: string;
  bodyPreview?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  location?: { displayName?: string };
  isOnlineMeeting: boolean;
  onlineMeeting?: { joinUrl?: string };
  showAs?: 'free' | 'tentative' | 'busy' | 'oof' | 'workingElsewhere';
  organizer?: { emailAddress: { name: string; address: string } };
  isAllDay?: boolean;
}

interface OutlookCalendarEventsResponse {
  '@odata.context'?: string;
  '@odata.nextLink'?: string;
  value: OutlookCalendarEvent[];
}

/**
 * Fetch ALL calendar events (not just Teams meetings)
 * Requires Calendars.Read permission
 * 
 * @param startDate - Start of date range
 * @param endDate - End of date range
 * @returns Array of calendar events
 */
export async function getCalendarEvents(
  startDate: Date,
  endDate: Date
): Promise<OutlookCalendarEvent[]> {
  const filter = `start/dateTime ge '${startDate.toISOString()}' and end/dateTime le '${endDate.toISOString()}'`;
  const url = `/me/calendar/events?$filter=${encodeURIComponent(filter)}&$select=id,subject,bodyPreview,start,end,location,isOnlineMeeting,onlineMeeting,showAs,organizer,isAllDay&$orderby=start/dateTime&$top=100`;

  console.log('[Calendar] Fetching calendar events...');

  try {
    const response = await withRateLimitRetry(
      () => callGraphAPI<OutlookCalendarEventsResponse>(url),
      'Fetching calendar events'
    );

    console.log(`[Calendar] Found ${response.value.length} calendar events`);
    return response.value;
  } catch (error: unknown) {
    // Handle users without Exchange mailbox gracefully
    if (error instanceof Error) {
      if (error.message?.includes('MailboxNotEnabledForRESTAPI') || 
          error.message?.includes('MailboxNotSupportedForRESTAPI')) {
        console.warn('[Calendar] Calendar not available - no Exchange mailbox');
        throw new Error('Calendar requires an Exchange Online mailbox. Your account may only have Teams licensing.');
      }
      if (error.message?.includes('Calendars.Read')) {
        throw new Error('Missing Calendars.Read permission. Please disconnect and reconnect your Microsoft account.');
      }
    }
    throw error;
  }
}
