/**
 * Meeting File Summary Hook
 *
 * Fetches file-level summary data from meeting_files, including
 * transcript text and processing status.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const FILE_SUMMARY_KEY = "meeting-file-summary";

interface FileSummaryData {
  id: string;
  transcript_text: string | null;
  processing_status: string | null;
  file_name: string;
  file_type: string;
  is_processed: boolean | null;
  has_embeddings: boolean | null;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch transcript text and processing status for a specific meeting file.
 */
export function useMeetingFileSummary(fileId: string) {
  return useQuery({
    queryKey: [FILE_SUMMARY_KEY, fileId],
    queryFn: async (): Promise<FileSummaryData> => {
      const { data, error } = await supabase
        .from("meeting_files")
        .select(
          "id, transcript_text, processing_status, file_name, file_type, is_processed, has_embeddings, created_at, updated_at"
        )
        .eq("id", fileId)
        .single();

      if (error) throw error;
      return data as unknown as FileSummaryData;
    },
    enabled: !!fileId,
  });
}
