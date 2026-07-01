/**
 * Hook for syncing Microsoft Teams meetings to the local database
 * 
 * Supports two sync sources:
 * 1. 'local' - Refresh existing meetings stored in database from Graph API
 * 2. 'calendar' - Import new meetings from Outlook/Exchange calendar
 * 3. 'both' - Do both (default)
 * 
 * NOTE: Calendar sync requires an Exchange Online mailbox.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { 
  getOnlineMeetingById, 
  getOnlineMeetingsFromCalendar,
  normalizeMeeting 
} from "@/lib/microsoftTeamsMeetingService";

export interface SyncResult {
  synced: number;
  updated: number;
  errors: number;
  total: number;
  calendarAvailable?: boolean;
}

export interface SyncOptions {
  source?: 'local' | 'calendar' | 'both';
  daysAhead?: number;
  daysBehind?: number;
}

export function useSyncTeamsMeetings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (options: SyncOptions = { source: 'both' }): Promise<SyncResult> => {
      if (!user) {
        throw new Error("User not authenticated");
      }

      const result: SyncResult = {
        synced: 0,
        updated: 0,
        errors: 0,
        total: 0,
        calendarAvailable: true,
      };

      const source = options.source || 'both';

      // ================================================================
      // Phase 1: Sync from Calendar (import new meetings)
      // ================================================================
      if (source === 'calendar' || source === 'both') {
        try {
          console.log('[SyncTeamsMeetings] Fetching meetings from calendar...');
          const calendarMeetings = await getOnlineMeetingsFromCalendar(
            options.daysAhead || 30,
            options.daysBehind || 7
          );
          
          for (const meeting of calendarMeetings) {
            // Check if meeting already exists by join URL
            const { data: existing } = await supabase
              .from('meetings')
              .select('id')
              .or(`join_url.eq.${meeting.join_url},zoom_join_url.eq.${meeting.join_url}`)
              .maybeSingle();

            if (!existing) {
              // Insert new meeting from calendar
              const { error: insertError } = await supabase
                .from('meetings')
                .insert({
                  title: meeting.title,
                  scheduled_at: meeting.scheduled_at,
                  duration_minutes: meeting.duration_minutes,
                  zoom_join_url: meeting.join_url,
                  join_url: meeting.join_url,
                  provider: 'microsoft_teams',
                  external_meeting_id: meeting.teams_meeting_id,
                  meeting_type: 'teams',
                  status: meeting.status,
                  organizer_id: user.id,
                  metadata: { 
                    outlook_event_id: meeting.teams_meeting_id,
                    synced_from_calendar: true,
                    synced_at: new Date().toISOString(),
                  },
                });

              if (!insertError) {
                result.synced++;
              } else {
                console.error('[SyncTeamsMeetings] Insert error:', insertError);
                result.errors++;
              }
            }
          }
          
          result.total += calendarMeetings.length;
        } catch (error) {
          console.warn('[SyncTeamsMeetings] Calendar sync failed:', error);
          result.calendarAvailable = false;
          
          // Only throw if calendar was the only source requested
          if (source === 'calendar') {
            throw error;
          }
        }
      }

      // ================================================================
      // Phase 2: Refresh existing local meetings
      // ================================================================
      if (source === 'local' || source === 'both') {
        // Get locally stored Teams meetings
        const { data: localMeetings, error: fetchError } = await supabase
          .from('meetings')
          .select('id, metadata')
          .eq('meeting_type', 'teams')
          .eq('organizer_id', user.id);

        if (fetchError) {
          console.error('[SyncTeamsMeetings] Failed to fetch local meetings:', fetchError);
          throw new Error('Failed to fetch local meetings');
        }

        if (localMeetings && localMeetings.length > 0) {
          result.total += localMeetings.length;

          // Refresh each meeting's details from Graph API
          for (const meeting of localMeetings) {
            const metadata = meeting.metadata as Record<string, unknown> | null;
            const teamsId = metadata?.teams_meeting_id as string | undefined;
            
            // Skip calendar-synced meetings (they don't have a direct Teams meeting ID)
            if (!teamsId || metadata?.synced_from_calendar) {
              continue;
            }

            try {
              // Fetch latest details from Graph API
              const graphMeeting = await getOnlineMeetingById(teamsId);
              const normalized = normalizeMeeting(graphMeeting);
              
              if (!normalized) {
                continue;
              }

              // Update local record with latest info
              const { error: updateError } = await supabase
                .from('meetings')
                .update({
                  title: normalized.title,
                  scheduled_at: normalized.scheduled_at,
                  duration_minutes: normalized.duration_minutes,
                  zoom_join_url: normalized.join_url,
                  join_url: normalized.join_url,
                  provider: 'microsoft_teams',
                  external_meeting_id: normalized.teams_meeting_id,
                  status: normalized.status,
                  metadata: {
                    ...metadata,
                    last_synced_at: new Date().toISOString(),
                  },
                })
                .eq('id', meeting.id);

              if (updateError) {
                console.error('[SyncTeamsMeetings] Update error:', updateError);
                result.errors++;
              } else {
                result.updated++;
              }
            } catch (error) {
              // Meeting may have been deleted in Teams, or other error
              console.error('[SyncTeamsMeetings] Error refreshing meeting:', error);
              result.errors++;
            }
          }
        }
      }

      return result;
    },
    onSuccess: (result) => {
      // Invalidate meetings queries to refresh the list
      queryClient.invalidateQueries({ queryKey: ['meetings'] });

      const messages: string[] = [];
      
      if (result.synced > 0) {
        messages.push(`Imported ${result.synced} meeting${result.synced !== 1 ? 's' : ''} from calendar`);
      }
      if (result.updated > 0) {
        messages.push(`Updated ${result.updated} meeting${result.updated !== 1 ? 's' : ''}`);
      }
      
      if (messages.length > 0) {
        toast({
          title: "Sync Complete",
          description: messages.join('. ') + '.',
        });
      } else if (result.total === 0) {
        toast({
          title: "No Teams Meetings Found",
          description: result.calendarAvailable 
            ? "No Teams meetings found in your calendar. Create a meeting to get started."
            : "Calendar sync not available. Create a meeting in this app to get started.",
        });
      } else {
        toast({
          title: "Meetings Up to Date",
          description: "All Teams meetings are already synced.",
        });
      }
      
      // Warn about calendar availability
      if (!result.calendarAvailable && result.synced === 0 && result.updated === 0) {
        toast({
          title: "Calendar Sync Unavailable",
          description: "Your account may not have an Exchange mailbox. Meetings created in this app will still be saved.",
          variant: "default",
        });
      }
    },
    onError: (error: Error) => {
      console.error('[SyncTeamsMeetings] Sync failed:', error);
      
      let title = "Sync Failed";
      let description = error.message || "Failed to sync Teams meetings.";
      
      // Handle specific error cases
      if (error.message?.includes('MailboxNotEnabledForRESTAPI') || 
          error.message?.includes('inactive, soft-deleted, or is hosted on-premise')) {
        title = "Calendar Not Available";
        description = "Your Microsoft account doesn't have an Exchange Online mailbox. You can still create Teams meetings directly using the 'New Teams Meeting' button below.";
      }
      // Handle token expiration specifically
      else if (error.message?.includes('Session expired') || 
          error.message?.includes('No access token') ||
          error.name === 'TokenExpiredError') {
        title = "Session Expired";
        description = "Your Microsoft session has expired. Please reconnect your account using the button above.";
      }
      // Provide more helpful error messages
      else if (error.message?.includes('OnlineMeetings.Read') || error.message?.includes('Calendars.Read')) {
        description = "Missing permission. Please disconnect and reconnect your Microsoft account.";
      } else if (error.message?.includes('Exchange') || error.message?.includes('Mailbox')) {
        title = "Calendar Not Available";
        description = "Calendar sync requires an Exchange Online mailbox. You can still create meetings directly.";
      } else if (error.message?.includes('Filter expression expected')) {
        description = "Teams API limitation. Meetings you create in this app are automatically saved.";
      }
      
      toast({
        title,
        description,
        variant: "destructive",
      });
    },
  });
}
