/**
 * Re-exports from notifications module for backward compatibility.
 */
export {
  useNotifications,
  useNotificationCenter,
  useUnreadCount,
  useMarkAsRead,
  useMarkAllAsRead,
  useDeleteNotification,
  useArchiveNotification,
  createNotification,
} from "@/modules/notifications/hooks/useNotificationCenter";

export type { Notification } from "@/modules/notifications/types";
