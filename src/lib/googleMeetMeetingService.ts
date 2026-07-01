/**
 * Google Meet Meeting Service
 * Handles creating Google Calendar events with Google Meet links
 */

import { supabase } from "@/integrations/supabase/client";

export interface CreateGoogleMeetMeetingRequest {
  title: string;
  startDateTime: string;
  endDateTime: string;
  description?: string;
  attendees?: string[];
}

export interface CreatedGoogleMeetMeeting {
  google_meet_id: string;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  join_url: string;
  meeting_type: 'google-meet';
  status: 'scheduled';
  calendar_event_id: string;
  calendar_synced: boolean;
}

// Type for organization integration config
interface OrgIntegrationConfig {
  client_id?: string;
  client_secret?: string;
}

/**
 * Get user's Google OAuth access token
 * @param userId - User ID to get token for
 */
async function getGoogleAccessToken(userId: string): Promise<string> {

  // Get user's OAuth token
  const { data: tokenData, error: tokenError } = await supabase
    .from('user_oauth_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .eq('provider_slug', 'google-meet')
    .eq('is_active', true)
    .single();

  if (tokenError || !tokenData) {
    throw new Error('Google account not connected. Please connect your Google account first.');
  }

  let access_token = tokenData.access_token;

  // Check if token is expired and refresh if needed
  const expiresAt = new Date(tokenData.expires_at);
  const now = new Date();
  if (expiresAt <= now && tokenData.refresh_token) {
    console.log('[GoogleMeet] Token expired, refreshing...');
    
      // Get org credentials for refresh
      const { data: orgIntegration } = await supabase
        .from('organization_integrations')
        .select('config')
        .eq('user_id', userId)
      .eq('provider_id', '550e8400-e29b-41d4-a716-446655440001') // Google Meet provider ID
      .single();

    const config = orgIntegration?.config as OrgIntegrationConfig | null;
    if (config?.client_id && config?.client_secret) {
      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: tokenData.refresh_token,
          client_id: config.client_id,
          client_secret: config.client_secret,
        }),
      });

      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        access_token = refreshData.access_token;

        // Update token in database
        await supabase
          .from('user_oauth_tokens')
          .update({
            access_token: refreshData.access_token,
            refresh_token: refreshData.refresh_token || tokenData.refresh_token,
            expires_at: new Date(Date.now() + (refreshData.expires_in * 1000)).toISOString(),
            last_refreshed_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
          .eq('provider_slug', 'google-meet');

        console.log('[GoogleMeet] Token refreshed successfully');
      } else {
        const errorText = await refreshResponse.text();
        console.error('[GoogleMeet] Token refresh failed:', errorText);
        throw new Error('Google token expired. Please reconnect your Google account.');
      }
    } else {
      throw new Error('Google token expired. Please reconnect your Google account.');
    }
  }

  return access_token;
}

/**
 * Create a Google Calendar event with Google Meet link
 * Uses Google Calendar API to create an event with conferenceData
 * 
 * @param input - Meeting details (title, start/end times, description, attendees)
 * @param userId - User ID to create meeting for
 * @returns Created meeting details including join URL
 */
export async function createGoogleMeetMeeting(
  input: CreateGoogleMeetMeetingRequest,
  userId: string
): Promise<CreatedGoogleMeetMeeting> {
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
  
  // Validate title
  const title = input.title?.trim();
  if (!title || title.length === 0) {
    throw new Error('Meeting title is required');
  }
  
  if (title.length > 200) {
    throw new Error('Meeting title must be less than 200 characters');
  }

  // Get access token
  const accessToken = await getGoogleAccessToken(userId);

  // Calculate duration in minutes
  const durationMinutes = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60));

  // Build Google Calendar API request body
  const requestBody: any = {
    summary: title,
    description: input.description || '',
    start: {
      dateTime: startDate.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    end: {
      dateTime: endDate.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    // Add Google Meet conference data
    conferenceData: {
      createRequest: {
        requestId: `meet-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        conferenceSolutionKey: {
          type: 'hangoutsMeet',
        },
      },
    },
  };

  // Add attendees if provided
  if (input.attendees && input.attendees.length > 0) {
    requestBody.attendees = input.attendees.map(email => ({
      email: email,
    }));
  }

  console.log('[GoogleMeet] Creating calendar event with Google Meet:', title);

  try {
    // Build URL with sendUpdates query parameter if attendees are present
    let apiUrl = 'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1';
    if (input.attendees && input.attendees.length > 0) {
      apiUrl += '&sendUpdates=all';
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[GoogleMeet] Calendar API error:', response.status, errorText);
      
      if (response.status === 401) {
        throw new Error('Google token expired. Please reconnect your Google account.');
      } else if (response.status === 403) {
        throw new Error('Missing Calendar permission. Please disconnect and reconnect your Google account to grant Calendar access.');
      }
      
      throw new Error(`Failed to create Google Calendar event: ${response.status}`);
    }

    const eventData = await response.json();
    
    if (!eventData.id) {
      throw new Error('Invalid response from Google Calendar API - missing event ID');
    }

    // Extract Google Meet link
    const meetLink = eventData.hangoutLink || 
                     eventData.conferenceData?.entryPoints?.find((ep: any) => ep.entryPointType === 'video')?.uri;

    if (!meetLink) {
      throw new Error('Google Meet link not found in calendar event response');
    }

    console.log('[GoogleMeet] Calendar event created successfully:', eventData.id);

    return {
      google_meet_id: eventData.id,
      title: eventData.summary || title,
      scheduled_at: startDate.toISOString(),
      duration_minutes: durationMinutes,
      join_url: meetLink,
      meeting_type: 'google-meet',
      status: 'scheduled',
      calendar_event_id: eventData.id,
      calendar_synced: true,
    };
  } catch (error) {
    console.error('[GoogleMeet] Failed to create Google Meet meeting:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Unknown error occurred while creating Google Meet meeting');
  }
}

