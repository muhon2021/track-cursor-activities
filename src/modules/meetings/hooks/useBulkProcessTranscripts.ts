/**
 * Bulk Process Transcripts Hook
 *
 * Provides a mutation to batch-process multiple meeting file transcripts.
 * Processes files sequentially and shows progress via toast notifications.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BulkProcessResult {
  processed: number;
  failed: number;
  errors: { fileId: string; error: string }[];
}

/**
 * Process multiple meeting file transcripts in bulk.
 * Each file is processed sequentially to avoid overwhelming the server.
 * Progress is shown via toast notifications.
 */
export function useBulkProcessTranscripts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      fileIds,
    }: {
      fileIds: string[];
    }): Promise<BulkProcessResult> => {
      let processed = 0;
      let failed = 0;
      const errors: { fileId: string; error: string }[] = [];

      toast.info(`Processing ${fileIds.length} transcript${fileIds.length !== 1 ? "s" : ""}...`);

      for (const fileId of fileIds) {
        try {
          const { error } = await supabase.functions.invoke(
            "zoom-transcript-processing",
            {
              body: { file_id: fileId, use_generic_table: true },
            }
          );

          if (error) {
            failed++;
            errors.push({ fileId, error: error.message });
          } else {
            processed++;
          }
        } catch (err) {
          failed++;
          errors.push({
            fileId,
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }

        // Show incremental progress for large batches
        if (fileIds.length > 5 && (processed + failed) % 5 === 0) {
          toast.info(
            `Progress: ${processed + failed}/${fileIds.length} processed`
          );
        }
      }

      return { processed, failed, errors };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["meeting-files"] });

      if (data.failed === 0) {
        toast.success(
          `Successfully processed ${data.processed} transcript${data.processed !== 1 ? "s" : ""}`
        );
      } else {
        toast.warning(
          `Processed ${data.processed} transcript${data.processed !== 1 ? "s" : ""}, ${data.failed} failed`
        );
      }
    },
    onError: (error: Error) => {
      toast.error("Bulk transcript processing failed", {
        description: error.message,
      });
    },
  });
}
