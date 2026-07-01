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
      `/crm/v2/Deals/${zohoDealId}/Attachments`,
    )
    if (!ok) {
      return { synced: 0, message: "Attachments not available for this deal or API error" }
    }
    const root = asRecord(json)
    const rows = Array.isArray(root.data) ? root.data as Record<string, unknown>[] : []
    const now = new Date().toISOString()
    const upserts = rows.map((r) => ({
      deal_id: dealId,
      zoho_attachment_id: String(r.id || ""),
      file_name: (r.File_Name as string) || (r.file_name as string) || null,
      size_bytes: typeof r.Size === "number" ? r.Size : (typeof r.size === "number" ? r.size : null),
      content_type: (r.$file_type as string) || (r.File_Type as string) || null,
      download_url: null as string | null,
      raw: r as unknown as Record<string, unknown>,
      synced_at: now,
    })).filter((u) => u.zoho_attachment_id)

    if (upserts.length > 0) {
      const { error } = await supabase.from("zoho_deal_attachments").upsert(upserts, {
        onConflict: "deal_id,zoho_attachment_id",
      })
      if (error) throw new Error(error.message)
    }

    return { synced: upserts.length }
  })
})
