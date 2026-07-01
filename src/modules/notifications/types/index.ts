export type NotificationSeverity = "info" | "success" | "warning" | "error" | "critical";
export type NotificationPriority = "low" | "medium" | "high" | "urgent";
export type NotificationCategory =
  | "tasks"
  | "meetings"
  | "eos"
  | "system"
  | "integrations"
  | "ai"
  | "mentions"
  | "users"
  | "departments";

export type NotificationFilterType =
  | "all"
  | "unread"
  | "mentions"
  | "tasks"
  | "meetings"
  | "system"
  | "integrations"
  | "ai"
  | "eos"
  | "archived";

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  severity?: NotificationSeverity;
  priority?: NotificationPriority;
  category?: NotificationCategory | string | null;
  event_key?: string | null;
  is_read: boolean;
  read_at: string | null;
  archived_at?: string | null;
  link: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  tenant_id?: string | null;
}

export interface NotificationListFilters {
  filter?: NotificationFilterType;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface NotificationEvent {
  event_key: string;
  category: NotificationCategory;
  description: string;
  default_severity: NotificationSeverity;
  default_priority: NotificationPriority;
  default_channels: string[];
  is_subscribable: boolean;
}

export interface NotificationPreferences {
  id?: string;
  user_id?: string;
  email_enabled: boolean;
  in_app_enabled: boolean;
  digest_mode: "instant" | "hourly" | "daily" | "weekly";
  mute_until: string | null;
  timezone: string;
  language: string;
  working_hours: {
    start: string;
    end: string;
    days: number[];
  };
}

export interface NotificationEventSubscription {
  id?: string;
  event_key: string;
  in_app: boolean;
  email: boolean;
}

export interface NotificationRule {
  id: string;
  name: string;
  description?: string | null;
  conditions: Record<string, unknown>;
  channels: string[];
  target_roles: string[];
  target_departments: string[];
  escalation: Record<string, unknown>;
  priority_override?: NotificationPriority | null;
  sort_order: number;
  is_active: boolean;
}

export interface NotificationLog {
  id: string;
  notification_id?: string | null;
  user_id: string;
  event_key?: string | null;
  channel: string;
  status: "pending" | "delivered" | "read" | "failed" | "expired";
  sent_at?: string | null;
  delivered_at?: string | null;
  read_at?: string | null;
  error_message?: string | null;
  retry_count: number;
  created_at: string;
}

export interface NotificationTemplate {
  id: string;
  event_key: string;
  channel: string;
  subject?: string | null;
  body: string;
  locale: string;
  version: number;
  is_active: boolean;
}

export const FILTER_CATEGORY_MAP: Partial<Record<NotificationFilterType, string>> = {
  mentions: "mentions",
  tasks: "tasks",
  meetings: "meetings",
  system: "system",
  integrations: "integrations",
  ai: "ai",
  eos: "eos",
};

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  email_enabled: true,
  in_app_enabled: true,
  digest_mode: "instant",
  mute_until: null,
  timezone: "UTC",
  language: "en",
  working_hours: { start: "09:00", end: "17:00", days: [1, 2, 3, 4, 5] },
};
