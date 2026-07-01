import { sendEmailViaSendGrid } from "../sendgrid-email.ts";
import type { ChannelContext, ChannelResult } from "./types.ts";

const DEFAULT_TENANT = "00000000-0000-0000-0000-000000000001";

export async function deliverEmail(ctx: ChannelContext): Promise<ChannelResult> {
  const { data: profile } = await ctx.supabase
    .from("profiles")
    .select("email, full_name")
    .eq("id", ctx.userId)
    .single();

  if (!profile?.email) {
    return { channel: "email", success: false, error: "User email not found" };
  }

  const { data: config } = await ctx.supabase
    .from("sendgrid_config")
    .select("from_email, from_name, is_enabled, api_key")
    .limit(1)
    .maybeSingle();

  if (!config?.is_enabled) {
    return { channel: "email", success: false, error: "Email notifications disabled" };
  }

  const html = `<h2>${ctx.title}</h2><p>${ctx.message}</p>`;
  const result = await sendEmailViaSendGrid({
    to: profile.email,
    subject: ctx.title,
    html,
    from: {
      email: config.from_email || "noreply@example.com",
      name: config.from_name || "Notifications",
    },
    apiKey: config.api_key || undefined,
  });

  const status = result.success ? "delivered" : "failed";
  await ctx.supabase.from("notification_logs").insert({
    user_id: ctx.userId,
    tenant_id: ctx.tenantId || DEFAULT_TENANT,
    event_key: ctx.eventKey ?? null,
    channel: "email",
    status,
    sent_at: new Date().toISOString(),
    delivered_at: result.success ? new Date().toISOString() : null,
    error_message: result.error ?? null,
    idempotency_key: ctx.idempotencyKey ? `${ctx.idempotencyKey}:email` : null,
    metadata: { ...ctx.metadata, recipient: profile.email },
  });

  if (!result.success) {
    return { channel: "email", success: false, error: result.error };
  }

  return { channel: "email", success: true };
}
