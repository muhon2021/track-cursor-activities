import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { deliverInApp } from "./notification-channels/in-app.ts";
import { deliverEmail } from "./notification-channels/email.ts";
import { deliverSlack } from "./notification-channels/slack.ts";
import { deliverStub } from "./notification-channels/stub.ts";
import type {
  ChannelContext,
  ChannelResult,
  EventDefinition,
  EventSubscription,
  NotificationChannel,
  NotificationPriority,
  NotificationRule,
  NotificationSeverity,
  RouterPayload,
  UserPrefs,
} from "./notification-channels/types.ts";

const DEFAULT_TENANT = "00000000-0000-0000-0000-000000000001";

function mapSeverity(input?: string): NotificationSeverity {
  const allowed = ["info", "success", "warning", "error", "critical"];
  return allowed.includes(input ?? "") ? (input as NotificationSeverity) : "info";
}

function mapPriority(input?: string): NotificationPriority {
  const allowed = ["low", "medium", "high", "urgent"];
  return allowed.includes(input ?? "") ? (input as NotificationPriority) : "medium";
}

async function loadEvent(
  supabase: SupabaseClient,
  eventKey?: string
): Promise<EventDefinition | null> {
  if (!eventKey) return null;
  const { data } = await supabase
    .from("notification_events")
    .select("event_key, category, default_severity, default_priority, default_channels")
    .eq("event_key", eventKey)
    .maybeSingle();
  return data as EventDefinition | null;
}

async function loadUserPrefs(
  supabase: SupabaseClient,
  userId: string
): Promise<UserPrefs> {
  const { data } = await supabase
    .from("notification_preferences")
    .select("email_enabled, in_app_enabled, digest_mode, mute_until")
    .eq("user_id", userId)
    .maybeSingle();

  return {
    email_enabled: data?.email_enabled ?? true,
    in_app_enabled: data?.in_app_enabled ?? true,
    digest_mode: data?.digest_mode ?? "instant",
    mute_until: data?.mute_until ?? null,
  };
}

async function loadSubscription(
  supabase: SupabaseClient,
  userId: string,
  eventKey?: string
): Promise<EventSubscription | null> {
  if (!eventKey) return null;
  const { data } = await supabase
    .from("notification_event_subscriptions")
    .select("in_app, email")
    .eq("user_id", userId)
    .eq("event_key", eventKey)
    .is("department_id", null)
    .maybeSingle();
  return data as EventSubscription | null;
}

async function loadRules(
  supabase: SupabaseClient,
  tenantId: string
): Promise<NotificationRule[]> {
  const { data } = await supabase
    .from("notification_rules")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  return (data ?? []) as NotificationRule[];
}

function applyRules(
  rules: NotificationRule[],
  eventKey: string | undefined,
  severity: NotificationSeverity,
  priority: NotificationPriority
): { channels: NotificationChannel[]; priority: NotificationPriority } {
  let channels: NotificationChannel[] = [];
  let finalPriority = priority;

  for (const rule of rules) {
    const cond = rule.conditions ?? {};
    const matchEvent = !cond.event_key || cond.event_key === eventKey;
    const matchSeverity = !cond.severity || cond.severity === severity;
    const matchPriority = !cond.priority || cond.priority === priority;

    if (matchEvent && matchSeverity && matchPriority) {
      channels = [...new Set([...channels, ...(rule.channels ?? [])])];
      if (rule.priority_override) {
        finalPriority = rule.priority_override;
      }
    }
  }

  return { channels, priority: finalPriority };
}

function resolveChannels(
  requested: NotificationChannel[] | undefined,
  event: EventDefinition | null,
  prefs: UserPrefs,
  subscription: EventSubscription | null,
  ruleChannels: NotificationChannel[]
): NotificationChannel[] {
  let channels =
    requested ??
    (ruleChannels.length > 0 ? ruleChannels : null) ??
    (event?.default_channels as NotificationChannel[]) ??
    (["in_app"] as NotificationChannel[]);

  if (!prefs.in_app_enabled) {
    channels = channels.filter((c) => c !== "in_app");
  }
  if (!prefs.email_enabled) {
    channels = channels.filter((c) => c !== "email");
  }
  if (subscription) {
    const allowed: NotificationChannel[] = [];
    if (subscription.in_app) allowed.push("in_app");
    if (subscription.email) allowed.push("email");
    channels = channels.filter(
      (c) => c === "slack" || c === "teams" || c === "sms" || c === "webhook" || c === "push" || allowed.includes(c)
    );
  }

  return [...new Set(channels)];
}

function isMuted(prefs: UserPrefs): boolean {
  if (!prefs.mute_until) return false;
  return new Date(prefs.mute_until) > new Date();
}

async function checkIdempotency(
  supabase: SupabaseClient,
  key: string
): Promise<boolean> {
  const { data } = await supabase
    .from("notification_logs")
    .select("id")
    .eq("idempotency_key", key)
    .maybeSingle();
  return !!data;
}

async function queueForDigest(
  supabase: SupabaseClient,
  userId: string,
  tenantId: string,
  eventKey: string | undefined,
  title: string,
  message: string,
  digestMode: string,
  payload: Record<string, unknown>
) {
  if (digestMode === "instant") return;
  await supabase.from("notification_digest_queue").insert({
    user_id: userId,
    tenant_id: tenantId,
    event_key: eventKey ?? null,
    title,
    message,
    payload,
    digest_mode: digestMode,
    scheduled_for: new Date().toISOString(),
  });
}

async function deliverChannel(
  ctx: ChannelContext,
  channel: NotificationChannel
): Promise<ChannelResult> {
  switch (channel) {
    case "in_app":
      return deliverInApp(ctx);
    case "email":
      return deliverEmail(ctx);
    case "slack":
      return deliverSlack(ctx);
    case "teams":
    case "sms":
    case "webhook":
    case "push":
      return deliverStub(ctx, channel);
    default:
      return { channel, success: false, error: `Unknown channel: ${channel}` };
  }
}

export async function routeNotification(
  supabase: SupabaseClient,
  body: RouterPayload
): Promise<{ success: boolean; results: ChannelResult[]; skipped?: string }> {
  const userIds = body.user_ids?.length
    ? body.user_ids
    : body.user_id
      ? [body.user_id]
      : [];

  if (!userIds.length) {
    return { success: false, results: [], skipped: "No user_ids provided" };
  }

  const event = await loadEvent(supabase, body.event_key);
  const severity = mapSeverity(body.severity ?? body.type ?? event?.default_severity);
  const basePriority = mapPriority(body.priority ?? event?.default_priority);
  const tenantId = body.tenant_id ?? DEFAULT_TENANT;
  const rules = await loadRules(supabase, tenantId);
  const ruleResult = applyRules(rules, body.event_key, severity, basePriority);
  const metadata = { ...(body.metadata ?? {}), ...(body.payload ?? {}) };
  const entityId = body.entity_id ?? (metadata.entity_id as string | undefined);

  const allResults: ChannelResult[] = [];

  for (const userId of userIds) {
    const prefs = await loadUserPrefs(supabase, userId);
    if (isMuted(prefs)) {
      allResults.push({
        channel: "in_app",
        success: false,
        error: "User notifications muted",
      });
      continue;
    }

    const subscription = await loadSubscription(supabase, userId, body.event_key);
    const channels = resolveChannels(
      body.channels as NotificationChannel[] | undefined,
      event,
      prefs,
      subscription,
      ruleResult.channels
    );

    if (prefs.digest_mode !== "instant" && body.event_key) {
      await queueForDigest(
        supabase,
        userId,
        tenantId,
        body.event_key,
        body.title,
        body.message,
        prefs.digest_mode,
        metadata
      );
      if (!channels.includes("in_app") && !channels.includes("email")) {
        continue;
      }
    }

    const idempotencyKey = body.event_key && entityId
      ? `${body.event_key}:${userId}:${entityId}:${new Date().toISOString().slice(0, 13)}`
      : undefined;

    if (idempotencyKey && (await checkIdempotency(supabase, idempotencyKey))) {
      allResults.push({
        channel: "in_app",
        success: false,
        error: "Duplicate notification suppressed",
      });
      continue;
    }

    const ctx: ChannelContext = {
      supabase,
      userId,
      title: body.title,
      message: body.message,
      severity,
      priority: ruleResult.priority,
      eventKey: body.event_key,
      category: event?.category,
      link: body.link,
      metadata,
      tenantId,
      idempotencyKey,
    };

    for (const channel of channels) {
      const result = await deliverChannel(ctx, channel);
      allResults.push(result);
    }
  }

  return {
    success: allResults.some((r) => r.success),
    results: allResults,
  };
}
