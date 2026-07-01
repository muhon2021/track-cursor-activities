/**
 * Hook for creating Zoom meetings
 * Handles validation, Zoom API call, and database storage
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { createZoomMeeting, CreatedZoomMeeting } from "@/lib/zoomMeetingService";
import { CreateZoomMeetingInput, createZoomMeetingSchema } from "@/lib/validation";
import { z } from "zod";

export interface CreateZoomMeetingResult {
  meeting: CreatedZoomMeeting;
  dbMeetingId: string;
  joinUrl: string;
}

export function useCreateZoomMeeting() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateZoomMeetingInput): Promise<CreateZoomMeetingResult> => {
      if (!user) {
        throw new Error("User not authenticated");
      }

      // Validate input with Zod schema
      let validated: CreateZoomMeetingInput;
      try {
        validated = createZoomMeetingSchema.parse(input);
      } catch (error) {
        if (error instanceof z.ZodError) {
          const messages = error.errors.map(e => e.message).join(', ');
          throw new Error(messages);
        }
        throw error;
      }

      console.log('[CreateZoomMeeting] Creating meeting:', validated.title);

      // Calculate duration in minutes
      const startDate = new Date(validated.startDateTime);
      const endDate = new Date(validated.endDateTime);
      const durationMinutes = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60));

      // Create meeting in Zoom
      const zoomMeeting = await createZoomMeeting({
        topic: validated.title,
        start_time: validated.startDateTime,
        duration: durationMinutes,
        agenda: validated.agenda,
        registrants: validated.attendees?.map(email => ({ email })),
      });

      console.log('[CreateZoomMeeting] Zoom meeting created, saving to DB...');

      // Store in database
      const { data: dbMeeting, error: insertError } = await supabase
        .from('meetings')
        .insert({
          title: zoomMeeting.title,
          scheduled_at: zoomMeeting.scheduled_at,
          duration_minutes: zoomMeeting.duration_minutes,
          zoom_meeting_id: zoomMeeting.zoom_meeting_id,
          zoom_join_url: zoomMeeting.join_url,
          join_url: zoomMeeting.join_url,
          host_url: zoomMeeting.start_url,
          provider: "zoom",
          external_meeting_id: zoomMeeting.zoom_meeting_id,
          meeting_type: 'zoom',
          status: 'scheduled',
          organizer_id: user.id,
          description: validated.agenda || null,
          metadata: {
            zoom_meeting_id: zoomMeeting.zoom_meeting_id,
            created_from: 'app',
            created_at: new Date().toISOString(),
            attendees: validated.attendees || [],
          },
        })
        .select()
        .single();

      if (insertError) {
        console.error('[CreateZoomMeeting] DB insert error:', insertError);
        // Meeting was created in Zoom but failed to save locally
        throw new Error(`Meeting created in Zoom but failed to save locally: ${insertError.message}`);
      }

      console.log('[CreateZoomMeeting] Meeting saved to DB:', dbMeeting.id);

      return {
        meeting: zoomMeeting,
        dbMeetingId: dbMeeting.id,
        joinUrl: zoomMeeting.join_url,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      
      toast({
        title: "Zoom Meeting Created",
        description: `"${result.meeting.title}" has been scheduled.`,
      });
      
      // Copy join URL to clipboard
      if (navigator.clipboard) {
        navigator.clipboard.writeText(result.joinUrl).then(() => {
          toast({
            title: "Join URL Copied",
            description: "Meeting join URL has been copied to your clipboard.",
          });
        }).catch((err) => {
          console.warn('[CreateZoomMeeting] Failed to copy join URL:', err);
        });
      }
    },
    onError: (error: Error) => {
      console.error('[CreateZoomMeeting] Failed:', error);
      
      let description = error.message;
      let title = "Failed to Create Meeting";
      
      if (error instanceof z.ZodError) {
        description = error.errors.map(e => e.message).join(', ');
        title = "Validation Error";
      } else if (error.message?.includes('not connected') || error.message?.includes('authentication')) {
        description = "Please connect your Zoom account first.";
        title = "Zoom Account Required";
      } else if (error.message?.includes('permission') || error.message?.includes('scope')) {
        description = "Missing Zoom permissions. Please disconnect and reconnect your Zoom account to grant meeting:write:meeting permission.";
        title = "Permission Required";
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

