import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { invalidateKeys } from "@/lib/cache";

export function useNotificationRealtime(showToast = true) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const initialLoad = useRef(true);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          invalidateKeys.notifications(queryClient);

          if (showToast && !initialLoad.current) {
            const row = payload.new as { title?: string; message?: string };
            toast.info(row.title || "New notification", {
              description: row.message,
              duration: 5000,
            });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => invalidateKeys.notifications(queryClient)
      )
      .subscribe();

    const timer = setTimeout(() => {
      initialLoad.current = false;
    }, 2000);

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [user, queryClient, showToast]);
}
