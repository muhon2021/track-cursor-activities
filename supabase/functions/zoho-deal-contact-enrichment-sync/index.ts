import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { parseMetadataString, zohoFetchJson } from "../_shared/zoho.ts"
import { handleZohoDealEdgeRequest } from "../_shared/zoho-http.ts"

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

serve(async (req) => {
  return handleZohoDealEdgeRequest(req, async ({ supabase, dealId, accessToken, apiBase }) => {
    const { data: deal, error: dErr } = await supabase.from("deals").select("metadata").eq("id", dealId).single()
    if (dErr || !deal) throw new Error("Deal not found")
    const zohoContactId = parseMetadataString(deal.metadata, "zoho_contact_id")
    if (!zohoContactId) {
      return { synced: 0, message: "Deal has no zoho_contact_id in metadata (sync deals from Zoho first)" }
    }

    const { ok, json } = await zohoFetchJson(apiBase, accessToken, `/crm/v2/Contacts/${zohoContactId}`)
    if (!ok) {
      const err = asRecord(json)
      throw new Error(`Zoho contact fetch failed: ${JSON.stringify(err)}`)
    }
    const root = asRecord(json)
    const data = root.data
    const rec = Array.isArray(data) && data[0] ? data[0] as Record<string, unknown> : null
    if (!rec) throw new Error("Empty Zoho contact response")

    const now = new Date().toISOString()
    const { error } = await supabase.from("zoho_contact_enrichment").upsert(
      {
        deal_id: dealId,
        zoho_contact_id: zohoContactId,
        payload: rec as unknown as Record<string, unknown>,
        updated_at: now,
      },
      { onConflict: "deal_id" },
    )
    if (error) throw new Error(error.message)

    return { synced: 1 }
  })
})
