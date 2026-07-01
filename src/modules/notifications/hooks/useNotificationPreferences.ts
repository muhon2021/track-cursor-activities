import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { queryKeys, invalidateKeys } from "@/lib/cache";
import { DEFAULT_PREFERENCES, type NotificationPreferences } from "../types";

export function useNotificationPreferences() {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.notifications.preferences(user?.id ?? ""),
    queryFn: async () => {
      if (!user) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        return {
          ...DEFAULT_PREFERENCES,
          ...data,
          working_hours: {
            ...DEFAULT_PREFERENCES.working_hours,
            ...(data.working_hours as Record<string, unknown>),
          },
        } as NotificationPreferences;
      }

      return { ...DEFAULT_PREFERENCES };
    },
    enabled: !!user,
  });
}

export function useUpdateNotificationPreferences() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (prefs: Partial<NotificationPreferences>) => {
      if (!user) throw new Error("User not authenticated");

      const payload = {
        user_id: user.id,
        email_enabled: prefs.email_enabled ?? true,
        in_app_enabled: prefs.in_app_enabled ?? true,
        digest_mode: prefs.digest_mode ?? "instant",
        mute_until: prefs.mute_until ?? null,
        timezone: prefs.timezone ?? "UTC",
        language: prefs.language ?? "en",
        working_hours: prefs.working_hours ?? DEFAULT_PREFERENCES.working_hours,
      };

      const { error } = await supabase
        .from("notification_preferences")
        .upsert(payload, { onConflict: "user_id" });

      if (error) throw error;
    },
    onSuccess: () => {
      if (user) {
        invalidateKeys.notificationPreferences(queryClient, user.id);
      }
      toast.success("Notification preferences saved");
    },
    onError: () => toast.error("Failed to save preferences"),
  });
}
