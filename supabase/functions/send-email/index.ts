/**
 * Send Email via SendGrid
 * Uses sendgrid_config from DB, SENDGRID_API_KEY from Supabase secrets
 * Requires integration enabled to send
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
import { sendEmailViaSendGrid } from "../_shared/sendgrid-email.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON in request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const toRaw = body.to;
    const to = Array.isArray(toRaw) ? (toRaw as string[]) : typeof toRaw === "string" ? [toRaw] : [];
    const subject = typeof body.subject === "string" ? body.subject : "";
    const bodyText = typeof body.body === "string" ? body.body : undefined;
    const html = typeof body.html === "string" ? body.html : undefined;
    const text = typeof body.text === "string" ? body.text : undefined;
    const contactId = typeof body.contactId === "string" ? body.contactId : undefined;
    const activityId = typeof body.activityId === "string" ? body.activityId : undefined;
    const enableTracking = body.enableTracking !== false;
    const fromEmail = typeof body.fromEmail === "string" ? body.fromEmail : undefined;
    const fromName = typeof body.fromName === "string" ? body.fromName : undefined;

    if (!to.length || !subject || (!bodyText && !html && !text)) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: to, subject, and body or html or text" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: config, error: configError } = await supabase
      .from("sendgrid_config")
      .select("from_email, from_name, is_enabled, enable_open_tracking, enable_click_tracking, api_key")
      .limit(1)
      .maybeSingle();

    if (configError) {
      console.error("send-email config error:", configError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to load SendGrid config", details: configError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!config || !config.is_enabled) {
      return new Response(
        JSON.stringify({ success: false, error: "SendGrid integration is not enabled" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey =
      Deno.env.get("SENDGRID_API_KEY") ||
      (typeof config.api_key === "string" && config.api_key ? config.api_key : null);
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "SendGrid API key not configured. Add it in the admin UI or Supabase secrets." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fromEmailFinal = fromEmail || config.from_email || "noreply@sjinnovation.com";
    const fromNameFinal = fromName || config.from_name || "SJ Innovation";
    const openTracking = config.enable_open_tracking && enableTracking;
    const clickTracking = config.enable_click_tracking && enableTracking;

    const htmlContent = html || (bodyText ? `<p>${bodyText.replace(/\n/g, "<br>")}</p>` : undefined);
    const textContent = text || bodyText;

    const result = await sendEmailViaSendGrid({
      to,
      subject,
      html: htmlContent,
      text: textContent,
      from: { email: fromEmailFinal, name: fromNameFinal },
      trackingSettings: { openTracking, clickTracking },
      customArgs: { contact_id: contactId || "", activity_id: activityId || "" },
      apiKey,
    });

    if (!result.success) {
      const msg = result.error || "Unknown error";
      const isAuth = /401|403/i.test(msg) || /invalid|unauthorized/i.test(msg);
      const isVerified = /verified|sender/i.test(msg);
      return new Response(
        JSON.stringify({
          success: false,
          error: msg,
          details: isAuth ? "API key invalid" : isVerified ? "Sender not verified in SendGrid" : undefined,
        }),
        { status: isAuth ? 401 : 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (result.messageId && (activityId || contactId)) {
      try {
        await supabase.from("email_tracking_events").insert({
          event_type: "sent",
          sendgrid_message_id: result.messageId,
          ...(activityId && { activity_id: activityId }),
          ...(contactId && { contact_id: contactId }),
        });
      } catch (insertErr) {
        console.error("send-email: failed to insert tracking event:", insertErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        messageId: result.messageId,
        trackingId: result.messageId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-email error:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
