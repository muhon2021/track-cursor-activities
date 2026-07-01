import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface MeetingFile {
  id: string;
  meeting_id: string | null;
  provider: string;
  external_meeting_id: string | null;
  file_type: string;
  file_name: string;
  file_size: number | null;
  file_path: string | null;
  storage_path: string | null;
  download_url: string | null;
  transcript_text: string | null;
  transcript_content: any;
  is_processed: boolean | null;
  has_embeddings: boolean | null;
  processing_status: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export function useMeetingFiles(meetingId?: string) {
  return useQuery({
    queryKey: ["meeting-files", meetingId],
    queryFn: async () => {
      let query = supabase
        .from("meeting_files")
        .select("*")
        .order("created_at", { ascending: false });

      if (meetingId) {
        query = query.eq("meeting_id", meetingId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as MeetingFile[];
    },
    enabled: !!meetingId,
  });
}

export function useMeetingFile(fileId: string) {
  return useQuery({
    queryKey: ["meeting-files", fileId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_files")
        .select("*")
        .eq("id", fileId)
        .single();

      if (error) throw error;
      return data as MeetingFile;
    },
    enabled: !!fileId,
  });
}

export function useUpdateMeetingFile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<MeetingFile> }) => {
      const { data: file, error } = await supabase
        .from("meeting_files")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return file as MeetingFile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting-files"] });
      toast({
        title: "Success",
        description: "Meeting file updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useDeleteMeetingFile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("meeting_files")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting-files"] });
      toast({
        title: "Success",
        description: "Meeting file deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useProcessMeetingFile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ fileId, provider }: { fileId: string; provider?: string }) => {
      const { data, error } = await supabase.functions.invoke("zoom-transcript-processing", {
        body: { file_id: fileId, use_generic_table: true, provider },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting-files"] });
      toast({
        title: "Success",
        description: "Meeting file processing started",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Processing failed: ${error.message}`,
        variant: "destructive",
      });
    },
  });
}
