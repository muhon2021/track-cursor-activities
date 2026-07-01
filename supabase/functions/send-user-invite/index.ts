import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requirePermission } from "../_shared/permission-auth.ts";
import { sendEmailViaSendGrid } from "../_shared/sendgrid-email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_TENANT = "00000000-0000-0000-0000-000000000001";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const appUrl = Deno.env.get("APP_URL") || Deno.env.get("VITE_APP_URL") || "http://localhost:8080";

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const serviceClient = createClient(supabaseUrl, serviceKey);

    const authResult = await requirePermission(
      req,
      userClient,
      corsHeaders,
      "users.create"
    );
    if (authResult instanceof Response) return authResult;
    const { userId } = authResult;

    const body = await req.json();
    const {
      email,
      role_id,
      role,
      department_id,
      pod_id,
      welcome_message,
      invite_id,
      resend,
    } = body;

    let invite;
    let revokedInviteId: string | null = null;

    if (resend && invite_id) {
      const { data: existing } = await serviceClient
        .from("user_invites")
        .select("*")
        .eq("id", invite_id)
        .single();

      if (!existing) {
        return new Response(JSON.stringify({ error: "Invite not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Revoke the prior row so its token is immediately invalid
      await serviceClient
        .from("user_invites")
        .update({
          status: "revoked",
          cancelled_at: new Date().toISOString(),
        })
        .eq("id", invite_id);
      revokedInviteId = invite_id;

      await serviceClient.from("activity_logs").insert({
        user_id: userId,
        action: "invitation.revoked",
        resource_type: "user_invite",
        resource_id: invite_id,
        details: { email: existing.email, reason: "resend" },
      });

      // Insert a fresh invite row carrying forward the prior assignments
      const { data: created, error } = await serviceClient
        .from("user_invites")
        .insert({
          email: existing.email,
          role: role || existing.role,
          role_id: role_id || existing.role_id,
          department_id: department_id ?? existing.department_id,
          pod_id: pod_id ?? existing.pod_id,
          welcome_message: welcome_message ?? existing.welcome_message,
          invited_by: userId,
          tenant_id: existing.tenant_id ?? DEFAULT_TENANT,
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;
      invite = created;
    } else {
      if (!email) {
        return new Response(JSON.stringify({ error: "email is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const normalizedEmail = email.toLowerCase().trim();

      const { data: existingProfile } = await serviceClient
        .from("profiles")
        .select("id")
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (existingProfile) {
        return new Response(
          JSON.stringify({ error: "already_member", message: "This email already belongs to a user" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: existingInvite } = await serviceClient
        .from("user_invites")
        .select("id")
        .eq("email", normalizedEmail)
        .eq("status", "pending")
        .maybeSingle();

      if (existingInvite) {
        return new Response(
          JSON.stringify({ error: "already_pending", message: "An invitation is already pending for this email" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: created, error } = await serviceClient
        .from("user_invites")
        .insert({
          email: normalizedEmail,
          role: role || "user",
          role_id: role_id || null,
          department_id: department_id || null,
          pod_id: pod_id || null,
          welcome_message: welcome_message || null,
          invited_by: userId,
          tenant_id: DEFAULT_TENANT,
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;
      invite = created;

      if (!invite.role_id && role) {
        const slugMap: Record<string, string> = {
          admin: "admin",
          moderator: "manager",
          user: "member",
        };
        const slug = slugMap[role] || role;
        const { data: roleRow } = await serviceClient
          .from("roles")
          .select("id")
          .eq("slug", slug)
          .maybeSingle();
        if (roleRow?.id) {
          await serviceClient
            .from("user_invites")
            .update({ role_id: roleRow.id })
            .eq("id", invite.id);
          invite.role_id = roleRow.id;
        }
      }
    }

    const acceptUrl = `${appUrl}/invite/accept?token=${invite.token}`;
    const fromEmail = Deno.env.get("SENDGRID_FROM_EMAIL") || "noreply@sjinnovation.com";
    const html = `
      <h2>You've been invited to Control Tower</h2>
      ${welcome_message || invite.welcome_message ? `<p>${welcome_message || invite.welcome_message}</p>` : ""}
      <p>Click the link below to accept your invitation and set up your account:</p>
      <p><a href="${acceptUrl}">Accept Invitation</a></p>
      <p>This invitation expires in 7 days.</p>
    `;

    const emailResult = await sendEmailViaSendGrid({
      to: invite.email,
      subject: "You're invited to Control Tower",
      html,
      from: { email: fromEmail, name: "Control Tower" },
    });

    await serviceClient.from("activity_logs").insert({
      user_id: userId,
      action: resend ? "invite.resent" : "invite.sent",
      resource_type: "user_invite",
      resource_id: invite.id,
      details: {
        email: invite.email,
        email_sent: emailResult.success,
        revoked_invite_id: revokedInviteId,
        expires_at: invite.expires_at,
      },
    });

    return new Response(
      JSON.stringify({
        invite,
        invite_id: invite.id,
        expires_at: invite.expires_at,
        revoked_invite_id: revokedInviteId,
        email_sent: emailResult.success,
        email_error: emailResult.error,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("send-user-invite error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
