import type { ChannelContext, ChannelResult } from "./types.ts";

const DEFAULT_TENANT = "00000000-0000-0000-0000-000000000001";

export async function deliverInApp(ctx: ChannelContext): Promise<ChannelResult> {
  const type = ["info", "success", "warning", "error"].includes(ctx.severity)
    ? ctx.severity
    : "warning";

  const { data, error } = await ctx.supabase
    .from("notifications")
    .insert({
      user_id: ctx.userId,
      title: ctx.title,
      message: ctx.message,
      type,
      severity: ctx.severity,
      priority: ctx.priority,
      event_key: ctx.eventKey ?? null,
      category: ctx.category ?? null,
      tenant_id: ctx.tenantId || DEFAULT_TENANT,
      link: ctx.link ?? null,
      metadata: ctx.metadata,
      is_read: false,
    })
    .select("id")
    .single();

  if (error) {
    return { channel: "in_app", success: false, error: error.message };
  }

  const log = await writeLog(ctx, "in_app", "delivered", data.id);
  return {
    channel: "in_app",
    success: true,
    notificationId: data.id,
    logId: log?.id,
  };
}

async function writeLog(
  ctx: ChannelContext,
  channel: string,
  status: string,
  notificationId?: string
) {
  const { data } = await ctx.supabase
    .from("notification_logs")
    .insert({
      notification_id: notificationId ?? null,
      user_id: ctx.userId,
      tenant_id: ctx.tenantId || DEFAULT_TENANT,
      event_key: ctx.eventKey ?? null,
      channel,
      status,
      sent_at: new Date().toISOString(),
      delivered_at: status === "delivered" ? new Date().toISOString() : null,
      idempotency_key: ctx.idempotencyKey ?? null,
      metadata: ctx.metadata,
    })
    .select("id")
    .single();
  return data;
}
