/**
 * Meeting Notifications Hook
 *
 * Provides a mutation to send meeting-related notifications
 * (reminder, updated, cancelled, created) via the edge function.
 */

import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const MEETING_NOTIFICATIONS_KEY = "meeting-notifications";

type MeetingNotificationType = "reminder" | "updated" | "cancelled" | "created";

interface SendNotificationResult {
  success: boolean;
  sent_to: number;
}

/**
 * Send a meeting notification of the specified type.
 */
export function useSendMeetingNotification() {
  return useMutation({
    mutationFn: async ({
      meeting_id,
      type,
    }: {
      meeting_id: string;
      type: MeetingNotificationType;
    }): Promise<SendNotificationResult> => {
      const { data, error } = await supabase.functions.invoke(
        "send-meeting-notification",
        {
          body: { meeting_id, type },
        }
      );

      if (error) throw error;
      return data as SendNotificationResult;
    },
    onSuccess: (data, vars) => {
      const typeLabels: Record<MeetingNotificationType, string> = {
        reminder: "Reminder",
        updated: "Update",
        cancelled: "Cancellation",
        created: "Creation",
      };
      toast.success(
        `${typeLabels[vars.type]} notification sent to ${data.sent_to} recipient${data.sent_to !== 1 ? "s" : ""}`
      );
    },
    onError: (error: Error) => {
      toast.error("Failed to send meeting notification", {
        description: error.message,
      });
    },
  });
}
