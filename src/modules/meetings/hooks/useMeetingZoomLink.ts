/**
 * Meeting Zoom Link Hook
 *
 * Queries meeting_files for Zoom-provided recordings linked to a meeting.
 * Also provides a mutation to link a Zoom recording to a meeting.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { MeetingFile } from "../types";

const ZOOM_LINK_KEY = "meeting-zoom-link";

interface ZoomFileRow {
  id: string;
  meeting_id: string | null;
  provider: string;
  file_type: string;
  file_name: string;
  file_size: number | null;
  download_url: string | null;
  transcript_text: string | null;
  processing_status: string;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch Zoom recording files linked to a specific meeting.
 */
export function useMeetingZoomLink(meetingId: string) {
  return useQuery({
    queryKey: [ZOOM_LINK_KEY, meetingId],
    queryFn: async (): Promise<ZoomFileRow[]> => {
      const { data, error } = await supabase
        .from("meeting_files")
        .select(
          "id, meeting_id, provider, file_type, file_name, file_size, download_url, transcript_text, processing_status, created_at, updated_at"
        )
        .eq("meeting_id", meetingId)
        .eq("provider", "zoom")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as ZoomFileRow[];
    },
    enabled: !!meetingId,
  });
}

/**
 * Link a Zoom recording file to a meeting by updating the meeting_id field.
 */
export function useLinkZoomRecording() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      fileId,
      meetingId,
    }: {
      fileId: string;
      meetingId: string;
    }) => {
      const { data, error } = await supabase
        .from("meeting_files")
        .update({ meeting_id: meetingId })
        .eq("id", fileId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: [ZOOM_LINK_KEY, vars.meetingId] });
      queryClient.invalidateQueries({ queryKey: ["meeting-files"] });
      toast.success("Zoom recording linked to meeting");
    },
    onError: (error: Error) => {
      toast.error("Failed to link Zoom recording", {
        description: error.message,
      });
    },
  });
}
