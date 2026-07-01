import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { zohoFetchJson } from "../_shared/zoho.ts"
import { handleZohoDealEdgeRequest } from "../_shared/zoho-http.ts"

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

async function fetchRelated(
  apiBase: string,
  token: string,
  dealZohoId: string,
  relatedModule: string,
): Promise<Record<string, unknown>[]> {
  const { ok, json } = await zohoFetchJson(
    apiBase,
    token,
    `/crm/v2/Deals/${dealZohoId}/${relatedModule}`,
  )
  if (!ok) return []
  const root = asRecord(json)
  return Array.isArray(root.data) ? root.data as Record<string, unknown>[] : []
}

serve(async (req) => {
  return handleZohoDealEdgeRequest(req, async (ctx) => {
    const { apiBase, accessToken, zohoDealId, supabase, dealId } = ctx
    const notes = await fetchRelated(apiBase, accessToken, zohoDealId, "Notes")
    const calls = await fetchRelated(apiBase, accessToken, zohoDealId, "Calls")
    const now = new Date().toISOString()

    const upserts: Record<string, unknown>[] = []

    for (const r of notes) {
      const id = String(r.id || "")
      if (!id) continue
      upserts.push({
        deal_id: dealId,
        zoho_module: "Notes",
        zoho_record_id: id,
        title: (r.Note_Title as string) || (r.Subject as string) || "Note",
        content: (r.Note_Content as string) || null,
        activity_type: "note",
        occurred_at: (r.Created_Time as string) || null,
        raw: r,
        synced_at: now,
      })
    }

    for (const r of calls) {
      const id = String(r.id || "")
      if (!id) continue
      upserts.push({
        deal_id: dealId,
        zoho_module: "Calls",
        zoho_record_id: id,
        title: (r.Subject as string) || (r.Call_Type as string) || "Call",
        content: (r.Description as string) || null,
        activity_type: "call",
        occurred_at: (r.Call_Start_Time as string) || (r.Created_Time as string) || null,
        raw: r,
        synced_at: now,
      })
    }

    if (upserts.length > 0) {
      const { error } = await supabase.from("zoho_deal_engagements").upsert(upserts, {
        onConflict: "deal_id,zoho_module,zoho_record_id",
      })
      if (error) throw new Error(error.message)
    }

    return { synced: upserts.length }
  })
})
