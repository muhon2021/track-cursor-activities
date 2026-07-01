import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { queryKeys, invalidateKeys } from "@/lib/cache";
import type { Notification, NotificationListFilters } from "../types";
import { FILTER_CATEGORY_MAP } from "../types";

const PAGE_SIZE = 20;

export function useNotificationCenter(filters: NotificationListFilters = {}) {
  const { user } = useAuth();
  const { filter = "all", search = "", page = 0, pageSize = PAGE_SIZE } = filters;

  return useQuery({
    queryKey: queryKeys.notifications.list({ filter, search, page, pageSize }),
    queryFn: async () => {
      if (!user) throw new Error("User not authenticated");

      let query = supabase
        .from("notifications")
        .select("*", { count: "exact" })
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (filter === "unread") {
        query = query.eq("is_read", false);
      } else if (filter === "archived") {
        query = query.not("archived_at", "is", null);
      } else {
        query = query.is("archived_at", null);
        if (filter !== "all") {
          const category = FILTER_CATEGORY_MAP[filter];
          if (category) {
            query = query.eq("category", category);
          }
        }
      }

      if (search.trim()) {
        query = query.or(`title.ilike.%${search}%,message.ilike.%${search}%`);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      return {
        items: (data || []) as Notification[],
        total: count ?? 0,
        page,
        pageSize,
        totalPages: Math.ceil((count ?? 0) / pageSize),
      };
    },
    enabled: !!user,
  });
}

export function useUnreadCount() {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.notifications.count,
    queryFn: async () => {
      if (!user) return 0;

      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false)
        .is("archived_at", null);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateKeys.notifications(queryClient),
    onError: () => toast.error("Failed to mark as read"),
  });
}

export function useMarkAllAsRead() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("User not authenticated");
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateKeys.notifications(queryClient);
      toast.success("All notifications marked as read");
    },
    onError: () => toast.error("Failed to mark all as read"),
  });
}

export function useArchiveNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateKeys.notifications(queryClient);
      toast.success("Notification archived");
    },
    onError: () => toast.error("Failed to archive notification"),
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateKeys.notifications(queryClient);
      toast.success("Notification deleted");
    },
    onError: () => toast.error("Failed to delete notification"),
  });
}

/** @deprecated Use notification-router edge function */
export async function createNotification(data: {
  user_id: string;
  title: string;
  message: string;
  type?: "info" | "success" | "warning" | "error";
  link?: string;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await supabase.from("notifications").insert({
    user_id: data.user_id,
    title: data.title,
    message: data.message,
    type: data.type || "info",
    link: data.link || null,
    metadata: data.metadata || {},
    is_read: false,
  } as never);
  if (error) throw error;
}

// Legacy alias
export function useNotifications(filter?: "all" | "unread") {
  return useNotificationCenter({ filter: filter ?? "all", pageSize: 100 });
}
