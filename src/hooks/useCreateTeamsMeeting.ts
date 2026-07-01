/**
 * Hook for creating Microsoft Teams meetings
 * Handles validation, Graph API call, and database storage
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { createOnlineMeeting, CreatedTeamsMeeting } from "@/lib/microsoftTeamsMeetingService";
import { CreateTeamsMeetingInput, createTeamsMeetingSchema } from "@/lib/validation";
import { z } from "zod";
import { ForbiddenError, UnauthorizedError } from "@/lib/microsoftGraphClient";

export interface CreateTeamsMeetingResult {
  meeting: CreatedTeamsMeeting;
  dbMeetingId: string;
  joinUrl: string;
}

export function useCreateTeamsMeeting() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateTeamsMeetingInput): Promise<CreateTeamsMeetingResult> => {
      if (!user) {
        throw new Error("User not authenticated");
      }

      // Validate input with Zod schema
      let validated: CreateTeamsMeetingInput;
      try {
        validated = createTeamsMeetingSchema.parse(input);
      } catch (error) {
        if (error instanceof z.ZodError) {
          const messages = error.errors.map(e => e.message).join(', ');
          throw new Error(messages);
        }
        throw error;
      }

      console.log('[CreateTeamsMeeting] Creating meeting:', validated.title);

      // Create meeting in Microsoft Teams
      const teamsMeeting = await createOnlineMeeting({
        subject: validated.title,
        startDateTime: validated.startDateTime,
        endDateTime: validated.endDateTime,
        attendees: validated.attendees?.map(email => ({ emailAddress: email })),
      });

      console.log('[CreateTeamsMeeting] Teams meeting created, saving to DB...');

      // Store in database
      const { data: dbMeeting, error: insertError } = await supabase
        .from('meetings')
        .insert({
          title: teamsMeeting.title,
          scheduled_at: teamsMeeting.scheduled_at,
          duration_minutes: teamsMeeting.duration_minutes,
          zoom_join_url: teamsMeeting.join_url, // Reuse field for virtual meeting URL
          join_url: teamsMeeting.join_url,
          provider: "microsoft_teams",
          external_meeting_id: teamsMeeting.teams_meeting_id,
          meeting_type: 'teams',
          status: 'scheduled',
          organizer_id: user.id,
          metadata: {
            teams_meeting_id: teamsMeeting.teams_meeting_id,
            calendar_event_id: teamsMeeting.calendar_event_id,
            calendar_synced: teamsMeeting.calendar_synced,
            created_from: 'app',
            created_at: new Date().toISOString(),
            attendees: validated.attendees || [],
          },
        })
        .select()
        .single();

      if (insertError) {
        console.error('[CreateTeamsMeeting] DB insert error:', insertError);
        // Meeting was created in Teams but failed to save locally
        // This is a partial success - we should still return the Teams info
        throw new Error(`Meeting created in Teams but failed to save locally: ${insertError.message}`);
      }

      console.log('[CreateTeamsMeeting] Meeting saved to DB:', dbMeeting.id);

      return {
        meeting: teamsMeeting,
        dbMeetingId: dbMeeting.id,
        joinUrl: teamsMeeting.join_url,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      
      if (result.meeting.calendar_synced) {
        toast({
          title: "Teams Meeting Created",
          description: `"${result.meeting.title}" has been scheduled and added to your calendar.`,
        });
      } else {
        toast({
          title: "Teams Meeting Created",
          description: `"${result.meeting.title}" has been scheduled. Note: Could not add to calendar.`,
        });
      }
      
      // Copy join URL to clipboard
      if (navigator.clipboard) {
        navigator.clipboard.writeText(result.joinUrl).then(() => {
          toast({
            title: "Join URL Copied",
            description: "Meeting join URL has been copied to your clipboard.",
          });
        }).catch((err) => {
          console.warn('[CreateTeamsMeeting] Failed to copy join URL:', err);
        });
      }
    },
    onError: (error: Error) => {
      console.error('[CreateTeamsMeeting] Failed:', error);
      
      let description = error.message;
      let title = "Failed to Create Meeting";
      
      if (error instanceof z.ZodError) {
        description = error.errors.map(e => e.message).join(', ');
        title = "Validation Error";
      } else if (error instanceof UnauthorizedError || error.message?.includes('disconnect and reconnect')) {
        description = error.message;
        title = "Reconnect Microsoft Account";
      } else if (error instanceof ForbiddenError || error.message?.includes('OnlineMeetings.ReadWrite')) {
        description = "Missing permission. Please disconnect and reconnect your Microsoft account to grant OnlineMeetings.ReadWrite permission.";
        title = "Permission Required";
      } else if (error.message?.includes('MailboxNotEnabledForRESTAPI') || error.message?.includes('hosted on-premise')) {
        description = "Your account mailbox is not accessible. Please contact your IT administrator.";
        title = "Mailbox Not Available";
      } else if (error.message?.includes('network') || error.message?.includes('Network')) {
        description = "Network error. Please check your connection and try again.";
        title = "Connection Error";
      }
      
      toast({
        title,
        description,
        variant: "destructive",
      });
    },
  });
}
