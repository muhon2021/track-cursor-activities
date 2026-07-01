import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { zohoFetchJson } from "../_shared/zoho.ts"
import { handleZohoDealEdgeRequest } from "../_shared/zoho-http.ts"

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

serve(async (req) => {
  return handleZohoDealEdgeRequest(req, async ({ supabase, dealId, zohoDealId, accessToken, apiBase }) => {
    const { ok, json } = await zohoFetchJson(
      apiBase,
      accessToken,
      `/crm/v2/Deals/${zohoDealId}/Events`,
    )
    if (!ok) {
      return { synced: 0, message: "No related events or module not exposed for this org" }
    }
    const root = asRecord(json)
    const rows = Array.isArray(root.data) ? root.data as Record<string, unknown>[] : []
    const now = new Date().toISOString()
    const upserts = rows.map((r) => ({
      deal_id: dealId,
      zoho_event_id: String(r.id || ""),
      title: (r.Event_Title as string) || (r.Subject as string) || "Event",
      start_at: (r.Start_DateTime as string) || null,
      end_at: (r.End_DateTime as string) || null,
      location: (r.Venue as string) || (r.Location as string) || null,
      raw: r as unknown as Record<string, unknown>,
      synced_at: now,
    })).filter((u) => u.zoho_event_id)

    if (upserts.length > 0) {
      const { error } = await supabase.from("zoho_deal_events").upsert(upserts, {
        onConflict: "deal_id,zoho_event_id",
      })
      if (error) throw new Error(error.message)
    }

    return { synced: upserts.length }
  })
})
