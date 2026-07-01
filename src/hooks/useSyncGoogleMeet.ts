import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export interface SyncGoogleMeetOptions {
  meeting_id?: string;
  force_refresh?: boolean;
  sync_recordings?: boolean;
  sync_transcripts?: boolean;
}

export function useSyncGoogleMeet() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (options: SyncGoogleMeetOptions = {}) => {
      if (!user) {
        throw new Error("User not authenticated");
      }

      const { data, error } = await supabase.functions.invoke('sync-google-meet', {
        body: {
          user_id: user.id,
          meeting_id: options.meeting_id,
          force_refresh: options.force_refresh ?? false,
          sync_recordings: options.sync_recordings ?? true,
          sync_transcripts: options.sync_transcripts ?? true,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['google-meet-files'] });
      queryClient.invalidateQueries({ queryKey: ['meetings'] });

      toast({
        title: "Success",
        description: data.message || "Google Meet meetings synced successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync Google Meet meetings. Check your Google integration settings.",
        variant: "destructive",
      });
    },
  });
}

export function useSyncGoogleMeetMeeting(meetingId: string) {
  const syncGoogleMeet = useSyncGoogleMeet();

  const syncMeeting = () => {
    return syncGoogleMeet.mutate({ meeting_id: meetingId });
  };

  return {
    syncMeeting,
    isLoading: syncGoogleMeet.isPending,
    error: syncGoogleMeet.error,
  };
}

