import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

interface RevisitRequest {
  dry_run?: boolean
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    const supabase = createClient(supabaseUrl, serviceKey)
    const payload = await req.json() as RevisitRequest
    const dryRun = payload.dry_run !== false

    const { data: chart } = await supabase
      .from("accountability_charts")
      .select("id, name, updated_at")
      .eq("is_current", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!chart?.id) {
      return new Response(
        JSON.stringify({ success: true, dry_run: dryRun, sent: 0, message: "No current chart." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      )
    }

    const { data: recipients } = await supabase
      .from("employee_profiles")
      .select("email, full_name")
      .eq("is_active", true)
      .limit(150)

    if (!dryRun) {
      for (const recipient of recipients ?? []) {
        await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            to: recipient.email,
            subject: `Revisit reminder: accountability chart (${chart.name ?? "Current"})`,
            html: `<p>Hi ${recipient.full_name},</p><p>This is a periodic reminder to revisit accountability ownership and ensure role clarity stays current.</p><p>Last chart update: ${chart.updated_at}</p>`,
          }),
        })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        dry_run: dryRun,
        sent: dryRun ? 0 : (recipients ?? []).length,
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
