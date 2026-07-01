/**
 * Enhanced Zoom Meeting Sync
 * Advanced features for Zoom integration
 * NOTE: These are placeholder implementations - some tables don't exist yet
 */

import { supabase } from '@/integrations/supabase/client';
import { getValidAccessToken } from '@/lib/oauth-token-manager';

// ============================================
// TYPES
// ============================================

export interface ZoomMeeting {
  id: string;
  uuid: string;
  topic: string;
  type: number; // 1=instant, 2=scheduled, 3=recurring, 8=recurring w/ fixed time
  status: 'waiting' | 'started' | 'finished';
  start_time: string;
  duration: number;
  timezone: string;
  created_at: string;
  host_id: string;
  join_url: string;
  agenda?: string;
}

export interface ZoomRecording {
  id: string;
  meeting_id: string;
  recording_start: string;
  recording_end: string;
  file_type: 'MP4' | 'M4A' | 'TIMELINE' | 'TRANSCRIPT' | 'CHAT' | 'CC';
  file_size: number;
  download_url: string;
  status: 'processing' | 'completed';
  recording_type: 'shared_screen_with_speaker_view' | 'shared_screen_with_gallery_view' | 'active_speaker' | 'gallery_view' | 'audio_only';
}

export interface ZoomParticipant {
  id: string;
  user_id: string;
  user_name: string;
  join_time: string;
  leave_time?: string;
  duration: number;
  attentiveness_score?: number;
}

export interface ZoomWebinar {
  id: string;
  uuid: string;
  topic: string;
  type: number;
  start_time: string;
  duration: number;
  timezone: string;
  agenda?: string;
  created_at: string;
  join_url: string;
}

export interface SyncResult {
  success: boolean;
  synced_count: number;
  error_count: number;
  errors?: string[];
}

// ============================================
// MEETING SYNC
// NOTE: organization_integrations table doesn't exist yet
// ============================================

/**
 * Sync all meetings from Zoom to database
 */
export async function syncZoomMeetings(
  orgIntegrationId: string,
  fromDate?: string,
  toDate?: string
): Promise<SyncResult> {
  try {
    // Get valid access token
    const tokenResult = await getValidAccessToken(orgIntegrationId);
    if (!tokenResult.success || !tokenResult.accessToken) {
      return {
        success: false,
        synced_count: 0,
        error_count: 1,
        errors: [tokenResult.error || 'Failed to get access token'],
      };
    }

    // Fetch meetings from Zoom API
    const meetings = await fetchZoomMeetings(
      tokenResult.accessToken,
      fromDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      toDate || new Date().toISOString()
    );

    if (!meetings.success || !meetings.data) {
      return {
        success: false,
        synced_count: 0,
        error_count: 1,
        errors: [meetings.error || 'Failed to fetch Zoom meetings'],
      };
    }

    // Store meetings in database
    let syncedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const meeting of meetings.data) {
      const result = await storeMeetingInDatabase(meeting);
      if (result.success) {
        syncedCount++;
      } else {
        errorCount++;
        errors.push(result.error || `Failed to store meeting ${meeting.id}`);
      }
    }

    return {
      success: errorCount === 0,
      synced_count: syncedCount,
      error_count: errorCount,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    return {
      success: false,
      synced_count: 0,
      error_count: 1,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

/**
 * Fetch meetings from Zoom API
 */
async function fetchZoomMeetings(
  accessToken: string,
  from: string,
  to: string
): Promise<{ success: boolean; data?: ZoomMeeting[]; error?: string }> {
  try {
    const response = await fetch(
      `https://api.zoom.us/v2/users/me/meetings?type=scheduled&from=${from}&to=${to}&page_size=300`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.message || `Zoom API error: ${response.status}`,
      };
    }

    const data = await response.json();
    return { success: true, data: data.meetings || [] };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Store Zoom meeting in database
 */
async function storeMeetingInDatabase(
  meeting: ZoomMeeting
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    // Check if meeting already exists
    const { data: existing } = await supabase
      .from('meetings')
      .select('id')
      .eq('zoom_meeting_id', meeting.id)
      .single();

    if (existing) {
      // Update existing meeting
      const { error } = await supabase
        .from('meetings')
        .update({
          title: meeting.topic,
          scheduled_at: meeting.start_time,
          duration_minutes: meeting.duration,
          zoom_join_url: meeting.join_url,
          description: meeting.agenda || '',
          status: meeting.status === 'finished' ? 'completed' : 'scheduled',
        })
        .eq('id', existing.id);

      return { success: !error, error: error?.message };
    } else {
      // Insert new meeting
      const { error } = await supabase.from('meetings').insert({
        zoom_meeting_id: meeting.id,
        title: meeting.topic,
        scheduled_at: meeting.start_time,
        duration_minutes: meeting.duration,
        zoom_join_url: meeting.join_url,
        description: meeting.agenda || '',
        status: meeting.status === 'finished' ? 'completed' : 'scheduled',
        organizer_id: user.id,
      });

      return { success: !error, error: error?.message };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// RECORDING SYNC
// NOTE: meeting_recordings table doesn't exist yet
// ============================================

/**
 * Sync meeting recordings from Zoom
 */
export async function syncMeetingRecordings(
  orgIntegrationId: string,
  meetingId: string
): Promise<SyncResult> {
  // Placeholder - meeting_recordings table doesn't exist
  console.warn('syncMeetingRecordings: meeting_recordings table not configured');
  return {
    success: false,
    synced_count: 0,
    error_count: 1,
    errors: ['Recording tables not configured. Please run migrations first.'],
  };
}

// ============================================
// PARTICIPANT SYNC
// NOTE: meeting_participants table doesn't exist yet
// ============================================

/**
 * Sync meeting participants from Zoom
 */
export async function syncMeetingParticipants(
  orgIntegrationId: string,
  meetingId: string
): Promise<SyncResult> {
  // Placeholder - meeting_participants table doesn't exist
  console.warn('syncMeetingParticipants: meeting_participants table not configured');
  return {
    success: false,
    synced_count: 0,
    error_count: 1,
    errors: ['Participant tables not configured. Please run migrations first.'],
  };
}

// ============================================
// TRANSCRIPT SYNC
// ============================================

/**
 * Sync and process transcript from Zoom
 */
export async function syncMeetingTranscript(
  orgIntegrationId: string,
  meetingId: string
): Promise<SyncResult> {
  try {
    // Get valid access token
    const tokenResult = await getValidAccessToken(orgIntegrationId);
    if (!tokenResult.success || !tokenResult.accessToken) {
      return {
        success: false,
        synced_count: 0,
        error_count: 1,
        errors: [tokenResult.error || 'Failed to get access token'],
      };
    }

    // Note: Implementation would fetch transcript from Zoom and store in zoom_files table
    console.warn('syncMeetingTranscript: Full implementation requires zoom_files table');
    
    return {
      success: false,
      synced_count: 0,
      error_count: 1,
      errors: ['Transcript sync not fully implemented'],
    };
  } catch (error) {
    return {
      success: false,
      synced_count: 0,
      error_count: 1,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Map Zoom meeting type to human-readable label
 */
export function getZoomMeetingTypeLabel(type: number): string {
  const types: Record<number, string> = {
    1: 'Instant',
    2: 'Scheduled',
    3: 'Recurring (No Fixed Time)',
    8: 'Recurring (Fixed Time)',
  };
  return types[type] || 'Unknown';
}

/**
 * Map Zoom recording type to human-readable label
 */
export function getZoomRecordingTypeLabel(type: string): string {
  const types: Record<string, string> = {
    shared_screen_with_speaker_view: 'Screen + Speaker',
    shared_screen_with_gallery_view: 'Screen + Gallery',
    active_speaker: 'Active Speaker',
    gallery_view: 'Gallery View',
    audio_only: 'Audio Only',
  };
  return types[type] || type;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
