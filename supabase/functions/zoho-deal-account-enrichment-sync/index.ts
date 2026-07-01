import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { zohoAccountIdFromClientExternalId, zohoFetchJson } from "../_shared/zoho.ts"
import { handleZohoDealEdgeRequest } from "../_shared/zoho-http.ts"

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

serve(async (req) => {
  return handleZohoDealEdgeRequest(req, async ({ supabase, dealId, accessToken, apiBase }) => {
    const { data: deal, error: dErr } = await supabase
      .from("deals")
      .select("client_id, clients!deals_client_id_fkey(external_id)")
      .eq("id", dealId)
      .single()

    if (dErr || !deal) throw new Error("Deal not found")

    const clients = (deal as any).clients as { external_id: string | null } | { external_id: string | null }[] | null
    const clientRow = Array.isArray(clients) ? clients[0] : clients
    const zohoAccountId = zohoAccountIdFromClientExternalId(clientRow?.external_id ?? null)
    if (!zohoAccountId) {
      return {
        synced: 0,
        message: "Linked client is not a Zoho account (external_id should be zoho-account-…)",
      }
    }

    const { ok, json } = await zohoFetchJson(apiBase, accessToken, `/crm/v2/Accounts/${zohoAccountId}`)
    if (!ok) {
      const err = asRecord(json)
      throw new Error(`Zoho account fetch failed: ${JSON.stringify(err)}`)
    }
    const root = asRecord(json)
    const data = root.data
    const rec = Array.isArray(data) && data[0] ? data[0] as Record<string, unknown> : null
    if (!rec) throw new Error("Empty Zoho account response")

    const now = new Date().toISOString()
    const { error } = await supabase.from("zoho_account_enrichment").upsert(
      {
        deal_id: dealId,
        zoho_account_id: zohoAccountId,
        payload: rec as unknown as Record<string, unknown>,
        updated_at: now,
      },
      { onConflict: "deal_id" },
    )
    if (error) throw new Error(error.message)

    return { synced: 1 }
  })
})
