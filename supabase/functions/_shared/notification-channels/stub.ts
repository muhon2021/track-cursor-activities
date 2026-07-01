import type { ChannelContext, ChannelResult, NotificationChannel } from "./types.ts";

const DEFAULT_TENANT = "00000000-0000-0000-0000-000000000001";

/** Stub channel adapters — log pending delivery for future implementation */
export async function deliverStub(
  ctx: ChannelContext,
  channel: NotificationChannel
): Promise<ChannelResult> {
  await ctx.supabase.from("notification_logs").insert({
    user_id: ctx.userId,
    tenant_id: ctx.tenantId || DEFAULT_TENANT,
    event_key: ctx.eventKey ?? null,
    channel,
    status: "pending",
    sent_at: new Date().toISOString(),
    metadata: {
      ...ctx.metadata,
      stub: true,
      message: `${channel} channel not yet implemented`,
    },
  });

  return {
    channel,
    success: true,
    error: `${channel} stub — queued for future delivery`,
  };
}
