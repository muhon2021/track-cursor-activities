import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

interface ReminderRequest {
  dry_run?: boolean
}

interface Recipient {
  email: string
  full_name: string
  role_title: string
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    const supabase = createClient(supabaseUrl, serviceKey)
    const payload = await req.json() as ReminderRequest
    const dryRun = payload.dry_run !== false

    const { data: currentChart } = await supabase
      .from("accountability_charts")
      .select("id, name")
      .eq("is_current", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!currentChart?.id) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, recipients: [], message: "No current accountability chart." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      )
    }

    const { data: rows } = await supabase
      .from("accountability_responsibilities")
      .select("role_title, user_id")
      .eq("chart_id", currentChart.id)

    const userIds = (rows ?? [])
      .map((row: Record<string, unknown>) => (typeof row.user_id === "string" ? row.user_id : ""))
      .filter((userId) => userId.length > 0)

    const { data: profiles } = userIds.length > 0
      ? await supabase
          .from("employee_profiles")
          .select("user_id, email, full_name")
          .in("user_id", userIds)
      : { data: [] as Array<{ user_id: string | null; email: string; full_name: string }> }

    const profileByUserId = new Map<string, { email: string; full_name: string }>()
    for (const profile of profiles ?? []) {
      if (typeof profile.user_id === "string") {
        profileByUserId.set(profile.user_id, {
          email: profile.email,
          full_name: profile.full_name,
        })
      }
    }

    const recipients: Recipient[] = (rows ?? [])
      .map((row: Record<string, unknown>) => {
        const userId = typeof row.user_id === "string" ? row.user_id : ""
        const profile = profileByUserId.get(userId)
        return {
          email: profile?.email ?? "",
          full_name: profile?.full_name ?? "Team Member",
          role_title: typeof row.role_title === "string" ? row.role_title : "Role Owner",
        }
      })
      .filter((recipient) => recipient.email.length > 0)

    if (!dryRun) {
      for (const recipient of recipients) {
        await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            to: recipient.email,
            subject: `Reminder: Review accountability chart (${currentChart.name ?? "Current Version"})`,
            html: `<p>Hi ${recipient.full_name},</p><p>Please review your accountability role (<strong>${recipient.role_title}</strong>) and update ownership details if needed.</p><p>Thanks.</p>`,
          }),
        })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        dry_run: dryRun,
        sent: dryRun ? 0 : recipients.length,
        recipients,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    )
  }
})
