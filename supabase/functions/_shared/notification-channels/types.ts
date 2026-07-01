import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type NotificationChannel =
  | "in_app"
  | "email"
  | "slack"
  | "teams"
  | "sms"
  | "webhook"
  | "push";

export type NotificationSeverity = "info" | "success" | "warning" | "error" | "critical";
export type NotificationPriority = "low" | "medium" | "high" | "urgent";
export type DigestMode = "instant" | "hourly" | "daily" | "weekly";

export interface RouterPayload {
  event_key?: string;
  user_id?: string;
  user_ids?: string[];
  title: string;
  message: string;
  type?: NotificationSeverity;
  severity?: NotificationSeverity;
  priority?: NotificationPriority;
  channels?: NotificationChannel[];
  link?: string;
  metadata?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  tenant_id?: string;
  entity_id?: string;
  skip_auth?: boolean;
  ping?: boolean;
}

export interface ChannelContext {
  supabase: SupabaseClient;
  userId: string;
  title: string;
  message: string;
  severity: NotificationSeverity;
  priority: NotificationPriority;
  eventKey?: string;
  category?: string;
  link?: string;
  metadata: Record<string, unknown>;
  tenantId: string;
  idempotencyKey?: string;
}

export interface ChannelResult {
  channel: NotificationChannel;
  success: boolean;
  notificationId?: string;
  error?: string;
  logId?: string;
}

export interface EventDefinition {
  event_key: string;
  category: string;
  default_severity: NotificationSeverity;
  default_priority: NotificationPriority;
  default_channels: NotificationChannel[];
}

export interface UserPrefs {
  email_enabled: boolean;
  in_app_enabled: boolean;
  digest_mode: DigestMode;
  mute_until: string | null;
}

export interface EventSubscription {
  in_app: boolean;
  email: boolean;
}

export interface NotificationRule {
  id: string;
  conditions: Record<string, unknown>;
  channels: NotificationChannel[];
  target_roles: string[];
  target_departments: string[];
  escalation: Record<string, unknown>;
  priority_override: NotificationPriority | null;
  sort_order: number;
}
