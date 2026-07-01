import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ZoomFile {
  id: string;
  meeting_id: string;
  file_type: string;
  file_name: string;
  file_size: number | null;
  file_path: string | null;
  storage_path: string | null;
  download_url: string | null;
  transcript_text: string | null;
  transcript_content: any;
  is_processed: boolean;
  has_embeddings: boolean;
  processing_status: string;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export function useZoomFiles(meetingId?: string) {
  return useQuery({
    queryKey: ['zoom-files', meetingId],
    queryFn: async () => {
      let query = supabase
        .from('zoom_files')
        .select('*')
        .order('created_at', { ascending: false });

      if (meetingId) {
        query = query.eq('meeting_id', meetingId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ZoomFile[];
    },
    enabled: !!meetingId,
  });
}

export function useZoomFile(fileId: string) {
  return useQuery({
    queryKey: ['zoom-files', fileId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zoom_files')
        .select('*')
        .eq('id', fileId)
        .single();

      if (error) throw error;
      return data as ZoomFile;
    },
    enabled: !!fileId,
  });
}

export function useUpdateZoomFile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ZoomFile> }) => {
      const { data: file, error } = await supabase
        .from('zoom_files')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return file as ZoomFile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zoom-files'] });
      toast({
        title: "Success",
        description: "Zoom file updated successfully",
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

export function useDeleteZoomFile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('zoom_files')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zoom-files'] });
      toast({
        title: "Success",
        description: "Zoom file deleted successfully",
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

export function useProcessZoomFile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (fileId: string) => {
      const { data, error } = await supabase.functions.invoke('zoom-transcript-processing', {
        body: { file_id: fileId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zoom-files'] });
      toast({
        title: "Success",
        description: "Zoom file processing started",
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
