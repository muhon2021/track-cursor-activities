import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { queryKeys, invalidateKeys } from "@/lib/cache";
import type { NotificationEvent, NotificationEventSubscription } from "../types";

export function useNotificationEvents() {
  return useQuery({
    queryKey: queryKeys.notifications.events,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_events")
        .select("*")
        .eq("is_subscribable", true)
        .order("category");

      if (error) throw error;
      return (data || []) as NotificationEvent[];
    },
  });
}

export function useNotificationSubscriptions() {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.notifications.subscriptions(user?.id ?? ""),
    queryFn: async () => {
      if (!user) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from("notification_event_subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .is("department_id", null);

      if (error) throw error;
      return (data || []) as NotificationEventSubscription[];
    },
    enabled: !!user,
  });
}

export function useUpdateSubscription() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sub: { event_key: string; in_app: boolean; email: boolean }) => {
      if (!user) throw new Error("User not authenticated");

      const { error } = await supabase.from("notification_event_subscriptions").upsert(
        {
          user_id: user.id,
          event_key: sub.event_key,
          in_app: sub.in_app,
          email: sub.email,
          department_id: null,
        },
        { onConflict: "user_id,event_key,department_id" }
      );

      if (error) throw error;
    },
    onSuccess: () => {
      if (user) {
        invalidateKeys.notificationSubscriptions(queryClient, user.id);
      }
    },
    onError: () => toast.error("Failed to update subscription"),
  });
}
