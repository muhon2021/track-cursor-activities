import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { queryKeys, invalidateKeys } from "@/lib/cache";
import type { NotificationRule, NotificationLog, NotificationTemplate } from "../types";

export function useNotificationAdminMetrics() {
  return useQuery({
    queryKey: queryKeys.notifications.adminMetrics,
    queryFn: async () => {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [totalRes, unreadRes, failedRes, deliveredRes, logsRes, eventsRes] = await Promise.all([
        supabase.from("notifications").select("*", { count: "exact", head: true }),
        supabase
          .from("notifications")
          .select("*", { count: "exact", head: true })
          .eq("is_read", false),
        supabase
          .from("notification_logs")
          .select("*", { count: "exact", head: true })
          .eq("status", "failed"),
        supabase
          .from("notification_logs")
          .select("*", { count: "exact", head: true })
          .eq("status", "delivered"),
        supabase
          .from("notification_logs")
          .select("channel, status, event_key, created_at")
          .gte("created_at", weekAgo),
        supabase.from("notification_events").select("event_key, description"),
      ]);

      const logs = logsRes.data ?? [];
      const channelUsage: Record<string, number> = {};
      const eventCounts: Record<string, number> = {};
      const dailyCounts: Record<string, number> = {};

      for (const log of logs) {
        channelUsage[log.channel] = (channelUsage[log.channel] ?? 0) + 1;
        if (log.event_key) {
          eventCounts[log.event_key] = (eventCounts[log.event_key] ?? 0) + 1;
        }
        const day = log.created_at?.slice(0, 10);
        if (day) dailyCounts[day] = (dailyCounts[day] ?? 0) + 1;
      }

      const totalDeliveries = (deliveredRes.count ?? 0) + (failedRes.count ?? 0);
      const emailSuccessRate =
        totalDeliveries > 0
          ? Math.round(((deliveredRes.count ?? 0) / totalDeliveries) * 100)
          : 100;

      const topEvents = Object.entries(eventCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([key, count]) => ({
          event_key: key,
          count,
          description:
            eventsRes.data?.find((e) => e.event_key === key)?.description ?? key,
        }));

      const dailyTrend = Object.entries(dailyCounts)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, count]) => ({ date, count }));

      return {
        totalNotifications: totalRes.count ?? 0,
        unreadCount: unreadRes.count ?? 0,
        failedDeliveries: failedRes.count ?? 0,
        emailSuccessRate,
        channelUsage,
        topEvents,
        dailyTrend,
      };
    },
  });
}

export function useNotificationRules() {
  return useQuery({
    queryKey: queryKeys.notifications.rules,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_rules")
        .select("*")
        .order("sort_order");

      if (error) throw error;
      return (data || []) as NotificationRule[];
    },
  });
}

export function useUpsertNotificationRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rule: Partial<NotificationRule> & { name: string }) => {
      const { error } = await supabase.from("notification_rules").upsert(rule as never);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateKeys.notificationAdmin(queryClient);
      toast.success("Rule saved");
    },
    onError: () => toast.error("Failed to save rule"),
  });
}

export function useDeleteNotificationRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notification_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateKeys.notificationAdmin(queryClient);
      toast.success("Rule deleted");
    },
    onError: () => toast.error("Failed to delete rule"),
  });
}

export function useNotificationLogs(filters?: {
  status?: string;
  channel?: string;
  page?: number;
  pageSize?: number;
}) {
  const { status, channel, page = 0, pageSize = 25 } = filters ?? {};

  return useQuery({
    queryKey: queryKeys.notifications.logs({ status, channel, page }),
    queryFn: async () => {
      let query = supabase
        .from("notification_logs")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (status) query = query.eq("status", status);
      if (channel) query = query.eq("channel", channel);

      const { data, error, count } = await query;
      if (error) throw error;

      return {
        items: (data || []) as NotificationLog[],
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / pageSize),
      };
    },
  });
}

export function useNotificationTemplates() {
  return useQuery({
    queryKey: queryKeys.notifications.templates,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_templates")
        .select("*")
        .order("event_key");

      if (error) throw error;
      return (data || []) as NotificationTemplate[];
    },
  });
}

export function useUpsertNotificationTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (template: Partial<NotificationTemplate> & { event_key: string; channel: string; body: string }) => {
      const { error } = await supabase.from("notification_templates").upsert(template);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateKeys.notificationAdmin(queryClient);
      toast.success("Template saved");
    },
    onError: () => toast.error("Failed to save template"),
  });
}
