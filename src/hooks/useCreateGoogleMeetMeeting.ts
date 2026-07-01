/**
 * Hook for creating Google Meet meetings
 * Handles validation, Google Calendar API call, and database storage
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { createGoogleMeetMeeting, CreatedGoogleMeetMeeting } from "@/lib/googleMeetMeetingService";
import { CreateGoogleMeetMeetingInput, createGoogleMeetMeetingSchema } from "@/lib/validation";
import { z } from "zod";

export interface CreateGoogleMeetMeetingResult {
  meeting: CreatedGoogleMeetMeeting;
  dbMeetingId: string;
  joinUrl: string;
}

export function useCreateGoogleMeetMeeting() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateGoogleMeetMeetingInput): Promise<CreateGoogleMeetMeetingResult> => {
      if (!user) {
        throw new Error("User not authenticated");
      }

      // Validate input with Zod schema
      let validated: CreateGoogleMeetMeetingInput;
      try {
        validated = createGoogleMeetMeetingSchema.parse(input);
      } catch (error) {
        if (error instanceof z.ZodError) {
          const messages = error.errors.map(e => e.message).join(', ');
          throw new Error(messages);
        }
        throw error;
      }

      console.log('[CreateGoogleMeetMeeting] Creating meeting:', validated.title);

      // Create meeting in Google Calendar with Google Meet link
      const googleMeetMeeting = await createGoogleMeetMeeting({
        title: validated.title,
        startDateTime: validated.startDateTime,
        endDateTime: validated.endDateTime,
        description: validated.description,
        attendees: validated.attendees,
      }, user.id);

      console.log('[CreateGoogleMeetMeeting] Google Meet meeting created, saving to DB...');

      // Store in database
      const { data: dbMeeting, error: insertError } = await supabase
        .from('meetings')
        .insert({
          title: googleMeetMeeting.title,
          scheduled_at: googleMeetMeeting.scheduled_at,
          duration_minutes: googleMeetMeeting.duration_minutes,
          join_url: googleMeetMeeting.join_url,
          host_url: googleMeetMeeting.join_url,
          provider: "google_meet",
          external_meeting_id: googleMeetMeeting.google_meet_id,
          external_id: googleMeetMeeting.google_meet_id,
          external_uuid: googleMeetMeeting.google_meet_id,
          meeting_type: 'google-meet',
          status: 'scheduled',
          organizer_id: user.id,
          metadata: {
            google_meet_id: googleMeetMeeting.google_meet_id,
            calendar_event_id: googleMeetMeeting.calendar_event_id,
            calendar_synced: googleMeetMeeting.calendar_synced,
            created_from: 'app',
            created_at: new Date().toISOString(),
            attendees: validated.attendees || [],
          },
        })
        .select()
        .single();

      if (insertError) {
        console.error('[CreateGoogleMeetMeeting] DB insert error:', insertError);
        // Meeting was created in Google Calendar but failed to save locally
        // This is a partial success - we should still return the Google Meet info
        throw new Error(`Meeting created in Google Calendar but failed to save locally: ${insertError.message}`);
      }

      console.log('[CreateGoogleMeetMeeting] Meeting saved to DB:', dbMeeting.id);

      return {
        meeting: googleMeetMeeting,
        dbMeetingId: dbMeeting.id,
        joinUrl: googleMeetMeeting.join_url,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      
      if (result.meeting.calendar_synced) {
        toast({
          title: "Google Meet Meeting Created",
          description: `"${result.meeting.title}" has been scheduled and added to your Google Calendar.`,
        });
      } else {
        toast({
          title: "Google Meet Meeting Created",
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
          console.warn('[CreateGoogleMeetMeeting] Failed to copy join URL:', err);
        });
      }
    },
    onError: (error: Error) => {
      console.error('[CreateGoogleMeetMeeting] Failed:', error);
      
      let description = error.message;
      let title = "Failed to Create Meeting";
      
      if (error instanceof z.ZodError) {
        description = error.errors.map(e => e.message).join(', ');
        title = "Validation Error";
      } else if (error.message?.includes('token expired') || error.message?.includes('401')) {
        description = "Google token expired. Please disconnect and reconnect your Google account.";
        title = "Token Expired";
      } else if (error.message?.includes('Calendar permission') || error.message?.includes('403')) {
        description = "Missing Calendar permission. Please disconnect and reconnect your Google account to grant Calendar access.";
        title = "Permission Required";
      } else if (error.message?.includes('not connected')) {
        description = "Google account not connected. Please connect your Google account first.";
        title = "Account Not Connected";
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

