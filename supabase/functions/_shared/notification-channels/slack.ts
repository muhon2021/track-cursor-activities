import type { ChannelContext, ChannelResult } from "./types.ts";

const DEFAULT_TENANT = "00000000-0000-0000-0000-000000000001";

export async function deliverSlack(ctx: ChannelContext): Promise<ChannelResult> {
  const webhookUrl = Deno.env.get("SLACK_WEBHOOK_URL");

  if (!webhookUrl) {
    return { channel: "slack", success: false, error: "SLACK_WEBHOOK_URL not configured" };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `*${ctx.title}*\n${ctx.message}`,
        username: "Control Tower Notifications",
      }),
    });

    const success = response.ok;
    await ctx.supabase.from("notification_logs").insert({
      user_id: ctx.userId,
      tenant_id: ctx.tenantId || DEFAULT_TENANT,
      event_key: ctx.eventKey ?? null,
      channel: "slack",
      status: success ? "delivered" : "failed",
      sent_at: new Date().toISOString(),
      delivered_at: success ? new Date().toISOString() : null,
      error_message: success ? null : "Slack webhook failed",
      idempotency_key: ctx.idempotencyKey ? `${ctx.idempotencyKey}:slack` : null,
      metadata: ctx.metadata,
    });

    return {
      channel: "slack",
      success,
      error: success ? undefined : "Slack webhook failed",
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { channel: "slack", success: false, error: msg };
  }
}
