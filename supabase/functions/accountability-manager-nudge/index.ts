import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

interface NudgeRequest {
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
    const payload = await req.json() as NudgeRequest
    const dryRun = payload.dry_run !== false

    const { data: profiles } = await supabase
      .from("employee_profiles")
      .select("email, full_name, manager_email, title")
      .not("manager_email", "is", null)

    const managerMap = new Map<string, Array<{ full_name: string; title: string }>>()
    for (const profile of profiles ?? []) {
      if (!profile.manager_email) {
        continue
      }
      const reportList = managerMap.get(profile.manager_email) ?? []
      reportList.push({
        full_name: profile.full_name,
        title: profile.title ?? "Team Member",
      })
      managerMap.set(profile.manager_email, reportList)
    }

    if (!dryRun) {
      for (const [managerEmail, reports] of managerMap.entries()) {
        const bodyItems = reports.slice(0, 6).map((report) => `<li>${report.full_name} (${report.title})</li>`).join("")
        await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            to: managerEmail,
            subject: "Manager nudge: accountability role review",
            html: `<p>Hello,</p><p>Please review role clarity and ownership for your direct reports:</p><ul>${bodyItems}</ul><p>Focus on overlap, gaps, and decision ownership.</p>`,
          }),
        })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        dry_run: dryRun,
        manager_count: managerMap.size,
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
