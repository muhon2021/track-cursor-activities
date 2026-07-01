import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type MeetingProvider =
  | "zoom"
  | "google_meet"
  | "microsoft_teams"
  | "webex"
  | "other";

interface SyncMeetingProviderInput {
  provider: MeetingProvider;
  action?: "sync";
  dateFrom?: string;
  dateTo?: string;
}

interface SyncMeetingProviderResult {
  success: boolean;
  synced_count?: number;
  meetings_found?: number;
  error?: string;
}

export function useSyncMeetingProvider() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ provider, action = "sync", dateFrom, dateTo }: SyncMeetingProviderInput) => {
      if (provider !== "zoom") {
        throw new Error("File sync is only available for Zoom meetings right now.");
      }

      const { data, error } = await supabase.functions.invoke("sync-zoom-files", {
        body: {
          action,
          date_from: dateFrom,
          date_to: dateTo,
          provider,
        },
      });

      if (error) {
        throw new Error(error.message || "Failed to sync meeting files.");
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      return data as SyncMeetingProviderResult;
    },
    onSuccess: (data) => {
      toast({
        title: "Sync complete",
        description: data?.synced_count
          ? `Synced ${data.synced_count} meeting file${data.synced_count === 1 ? "" : "s"}.`
          : "Meeting files are up to date.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Sync failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useSyncZoomFiles() {
  const mutation = useSyncMeetingProvider();

  return {
    ...mutation,
    syncZoomFiles: (options?: Omit<SyncMeetingProviderInput, "provider">) =>
      mutation.mutateAsync({
        provider: "zoom",
        ...options,
      }),
  };
}
