/**
 * Zoom Meeting Service
 * Handles creating Zoom meetings via Zoom API
 */

import { supabase } from "@/integrations/supabase/client";

export interface CreateZoomMeetingRequest {
  topic: string;
  start_time: string; // ISO 8601 format
  duration: number; // minutes
  timezone?: string;
  agenda?: string;
  settings?: {
    host_video?: boolean;
    participant_video?: boolean;
    join_before_host?: boolean;
    mute_upon_entry?: boolean;
    waiting_room?: boolean;
    registrants_email_notification?: boolean;
  };
  registrants?: Array<{
    email: string;
    first_name?: string;
    last_name?: string;
  }>;
}

export interface CreatedZoomMeeting {
  zoom_meeting_id: string;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  join_url: string;
  start_url: string;
  meeting_type: 'zoom';
  status: 'scheduled';
}

interface ZoomMeetingResponse {
  id: number;
  uuid: string;
  host_id: string;
  host_email: string;
  topic: string;
  type: number;
  status: string;
  start_time: string;
  duration: number;
  timezone: string;
  created_at: string;
  start_url: string;
  join_url: string;
  password?: string;
  h323_password?: string;
  pstn_password?: string;
  encrypted_password?: string;
  settings: {
    host_video: boolean;
    participant_video: boolean;
    cn_meeting: boolean;
    in_meeting: boolean;
    join_before_host: boolean;
    jbh_time: number;
    mute_upon_entry: boolean;
    watermark: boolean;
    use_pmi: boolean;
    approval_type: number;
    audio: string;
    auto_recording: string;
    enforce_login: boolean;
    enforce_login_domains: string;
    alternative_hosts: string;
    alternative_hosts_email_notification: boolean;
    close_registration: boolean;
    show_share_button: boolean;
    allow_multiple_devices: boolean;
    registrants_confirmation_email: boolean;
    waiting_room: boolean;
    request_permission_to_unmute_participants: boolean;
    global_dial_in_countries: string[];
    global_dial_in_numbers: Array<{
      country: string;
      country_name: string;
      city: string;
      number: string;
      type: string;
    }>;
    contact_name: string;
    contact_email: string;
    registrants_email_notification: boolean;
    meeting_authentication: boolean;
    authentication_option: string;
    authentication_domains: string;
    authentication_name: string;
    additional_data_center_regions: string[];
    breakout_room: {
      enable: boolean;
    };
    language_interpretation: {
      enable: boolean;
    };
  };
  recurrence?: {
    type: number;
    repeat_interval: number;
    weekly_days: string;
    monthly_day: number;
    monthly_week: number;
    monthly_week_day: number;
    end_times: number;
    end_date_time: string;
  };
}

/**
 * Create a new Zoom meeting via edge function
 * 
 * @param input - Meeting details (topic, start time, duration, attendees)
 * @returns Created meeting details including join URL
 */
export async function createZoomMeeting(
  input: CreateZoomMeetingRequest
): Promise<CreatedZoomMeeting> {
  // Validate input dates
  const startDate = new Date(input.start_time);
  
  if (isNaN(startDate.getTime())) {
    throw new Error('Invalid date format');
  }
  
  if (startDate.getTime() < Date.now() - 60000) { // 1 minute buffer
    throw new Error('Start time must be in the future');
  }

  // Validate topic
  const topic = input.topic?.trim();
  if (!topic || topic.length === 0) {
    throw new Error('Meeting title is required');
  }
  
  if (topic.length > 200) {
    throw new Error('Meeting title must be less than 200 characters');
  }

  // Validate duration
  if (input.duration < 1) {
    throw new Error('Duration must be at least 1 minute');
  }
  
  if (input.duration > 1440) { // 24 hours
    throw new Error('Duration cannot exceed 24 hours');
  }

  console.log('[ZoomMeetings] Creating Zoom meeting via edge function:', topic);

  try {
    const { data, error } = await supabase.functions.invoke('create-zoom-meeting', {
      body: {
        topic: topic,
        start_time: startDate.toISOString(),
        duration: input.duration,
        timezone: input.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        agenda: input.agenda || '',
        settings: input.settings,
        registrants: input.registrants,
      },
    });

    if (error) {
      console.error('[ZoomMeetings] Edge function error:', error);
      throw new Error(error.message || 'Failed to create Zoom meeting');
    }

    if (data?.error) {
      console.error('[ZoomMeetings] API error:', data.error);
      throw new Error(data.error);
    }

    if (!data?.zoom_meeting_id || !data?.join_url) {
      throw new Error('Invalid response from server - missing meeting ID or join URL');
    }

    console.log('[ZoomMeetings] Zoom meeting created successfully:', data.zoom_meeting_id);

    return {
      zoom_meeting_id: data.zoom_meeting_id,
      title: data.title,
      scheduled_at: data.scheduled_at,
      duration_minutes: data.duration_minutes,
      join_url: data.join_url,
      start_url: data.start_url,
      meeting_type: 'zoom',
      status: 'scheduled',
    };
  } catch (error) {
    console.error('[ZoomMeetings] Failed to create Zoom meeting:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Unknown error occurred while creating Zoom meeting');
  }
}

