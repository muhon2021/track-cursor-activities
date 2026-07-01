import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1"
import { getCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts"
import { resolveZohoAuth, zohoFetchJson, ZohoAuthError } from "../_shared/zoho.ts"

type CrmResource = "leads" | "contacts" | "deals" | "accounts"

const MODULE_BY_RESOURCE: Record<CrmResource, string> = {
  leads: "Leads",
  contacts: "Contacts",
  deals: "Deals",
  accounts: "Accounts",
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

function lookupId(v: unknown): string | null {
  if (!v || typeof v !== "object") return null
  const id = (v as { id?: string }).id
  return typeof id === "string" ? id : null
}

function lookupName(v: unknown): string | null {
  if (typeof v === "string") return v
  if (!v || typeof v !== "object") return null
  const name = (v as { name?: string }).name
  return typeof name === "string" ? name : null
}

function parseNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function mapZohoDealStage(stage: string | undefined): string {
  const s = (stage || "").toLowerCase()
  if (s.includes("closed won")) return "won"
  if (s.includes("closed lost")) return "lost"
  if (s.includes("proposal") || s.includes("negotiat")) return "proposal"
  if (s.includes("estimat") || s.includes("quote")) return "estimation"
  if (s.includes("qualif")) return "qualified"
  if (s.includes("discover") || s.includes("need") || s.includes("analysis")) return "discovery"
  return "lead"
}

async function fetchModulePage(
  apiBase: string,
  accessToken: string,
  module: string,
  page: number,
  perPage: number,
): Promise<{ records: Record<string, unknown>[]; more: boolean }> {
  const path =
    `/crm/v2/${module}?page=${page}&per_page=${perPage}&fields=id`
  const { ok, json } = await zohoFetchJson(apiBase, accessToken, path)
  if (!ok) {
    const err = asRecord(json)
    throw new Error(`Zoho list ${module} failed: ${JSON.stringify(err)}`)
  }
  const root = asRecord(json)
  const data = root.data
  const records = Array.isArray(data) ? data as Record<string, unknown>[] : []
  const info = asRecord(root.info)
  const more = info.more_records === true
  return { records, more }
}

async function fetchSingleRecord(
  apiBase: string,
  accessToken: string,
  module: string,
  recordId: string,
): Promise<Record<string, unknown> | null> {
  const { ok, json } = await zohoFetchJson(apiBase, accessToken, `/crm/v2/${module}/${recordId}`)
  if (!ok) return null
  const root = asRecord(json)
  const data = root.data
  if (Array.isArray(data) && data[0]) return data[0] as Record<string, unknown>
  return null
}

serve(async (req) => {
  const origin = req.headers.get("origin")
  const cors = getCorsHeaders(origin)

  if (req.method === "OPTIONS") {
    return handleCorsPreflight(origin)
  }

  const jsonHeaders = { ...cors, "Content-Type": "application/json" }

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: jsonHeaders,
      })
    }

    const jwt = authHeader.replace("Bearer ", "")
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 503,
        headers: jsonHeaders,
      })
    }

    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(jwt)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid or expired session" }), {
        status: 401,
        headers: jsonHeaders,
      })
    }

    let body: {
      resource?: string
      provider?: string
      user_id?: string
      record_id?: string
    }
    try {
      body = await req.json()
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: jsonHeaders,
      })
    }

    const resource = body.resource as CrmResource | undefined
    const valid: CrmResource[] = ["leads", "contacts", "deals", "accounts"]
    if (!resource || !valid.includes(resource)) {
      return new Response(
        JSON.stringify({ error: "resource must be leads | contacts | deals | accounts" }),
        { status: 400, headers: jsonHeaders },
      )
    }

    const supabase = createClient(supabaseUrl, serviceKey)
    const auth = await resolveZohoAuth(supabase, user.id)

    const module = MODULE_BY_RESOURCE[resource]
    const now = new Date().toISOString()
    let processed = 0

    const upsertClientForAccount = async (rec: Record<string, unknown>) => {
      const id = String(rec.id || "")
      if (!id) return
      const external_id = `zoho-account-${id}`
      const name = String(rec.Account_Name || rec.name || "Account")
      const { data: existing } = await supabase.from("clients").select("id").eq("external_id", external_id).maybeSingle()
      const row = {
        name,
        company: typeof rec.Account_Name === "string" ? rec.Account_Name : name,
        phone: (rec.Phone as string) || null,
        email: (rec.Email as string) || null,
        external_id,
        data_source: "zoho",
        last_synced_at: now,
        updated_at: now,
        metadata: { zoho: rec },
      }
      if (existing?.id) {
        await supabase.from("clients").update(row).eq("id", existing.id)
      } else {
        await supabase.from("clients").insert({ ...row, created_by: user.id })
      }
      processed++
    }

    const resolveClientIdForAccountZohoId = async (accountZohoId: string | null): Promise<string | null> => {
      if (!accountZohoId) return null
      const external_id = `zoho-account-${accountZohoId}`
      const { data } = await supabase.from("clients").select("id").eq("external_id", external_id).maybeSingle()
      return data?.id ?? null
    }

    const upsertContact = async (rec: Record<string, unknown>) => {
      const id = String(rec.id || "")
      if (!id) return
      const external_id = `zoho-contact-${id}`
      const accountId = lookupId(rec.Account_Name)
      const client_id = await resolveClientIdForAccountZohoId(accountId)
      const first = String(rec.First_Name || "").trim() || "-"
      const last = (rec.Last_Name as string) || null
      const { data: existing } = await supabase.from("contacts").select("id").eq("external_id", external_id).maybeSingle()
      const row = {
        first_name: first,
        last_name: last,
        email: (rec.Email as string) || null,
        phone: (rec.Phone as string) || null,
        company: lookupName(rec.Account_Name) || null,
        title: (rec.Title as string) || null,
        client_id,
        external_id,
        external_url: null as string | null,
        data_source: "zoho",
        last_synced_at: now,
        updated_at: now,
      }
      if (existing?.id) {
        await supabase.from("contacts").update(row).eq("id", existing.id)
      } else {
        await supabase.from("contacts").insert({ ...row, created_by: user.id })
      }
      processed++
    }

    const resolveContactId = async (contactZohoId: string | null): Promise<string | null> => {
      if (!contactZohoId) return null
      const { data } = await supabase.from("contacts").select("id").eq("external_id", `zoho-contact-${contactZohoId}`).maybeSingle()
      return data?.id ?? null
    }

    const upsertDeal = async (rec: Record<string, unknown>, isLead: boolean) => {
      const id = String(rec.id || "")
      if (!id) return
      const external_id = isLead ? `zoho-lead-${id}` : `zoho-deal-${id}`
      const slug = isLead ? `zoho-lead-${id}` : `zoho-deal-${id}`
      const accountZohoId = lookupId(rec.Account_Name)
      const contactZohoId = lookupId(rec.Contact_Name)
      const client_id = isLead ? null : await resolveClientIdForAccountZohoId(accountZohoId)
      const contact_id = isLead ? null : await resolveContactId(contactZohoId)

      const title = isLead
        ? String(rec.Company || `${rec.First_Name || ""} ${rec.Last_Name || ""}`.trim() || `Lead ${id}`)
        : String(rec.Deal_Name || `Deal ${id}`)

      const stage = isLead ? "lead" : mapZohoDealStage(rec.Stage as string | undefined)
      const value = isLead ? null : parseNumber(rec.Amount)
      const probability = isLead ? 0 : (parseNumber(rec.Probability) ?? 0)
      const expected_close = !isLead && rec.Closing_Date
        ? String(rec.Closing_Date).slice(0, 10)
        : null
      const description = (rec.Description as string) || null

      const metadata: Record<string, unknown> = {
        zoho_modified_time: rec.Modified_Time,
        zoho_stage: rec.Stage,
      }
      if (contactZohoId) {
        metadata.zoho_contact_id = contactZohoId
        metadata.zoho_contact_name = lookupName(rec.Contact_Name)
      }

      const { data: existing } = await supabase.from("deals").select("id").eq("external_id", external_id).maybeSingle()
      const row = {
        title,
        slug,
        description,
        stage,
        value,
        probability,
        expected_close_date: expected_close,
        client_id,
        contact_id,
        external_id,
        data_source: "zoho",
        last_synced_at: now,
        updated_at: now,
        metadata,
        source: "Zoho CRM",
      }
      if (existing?.id) {
        await supabase.from("deals").update(row).eq("id", existing.id)
      } else {
        await supabase.from("deals").insert({
          ...row,
          owner_id: user.id,
          created_by: user.id,
          currency: "USD",
        })
      }
      processed++
    }

    if (body.record_id) {
      const rec = await fetchSingleRecord(auth.apiBase, auth.accessToken, module, body.record_id)
      if (!rec) {
        return new Response(JSON.stringify({ error: "Record not found in Zoho" }), {
          status: 404,
          headers: jsonHeaders,
        })
      }
      if (resource === "accounts") await upsertClientForAccount(rec)
      else if (resource === "contacts") await upsertContact(rec)
      else if (resource === "deals") await upsertDeal(rec, false)
      else if (resource === "leads") await upsertDeal(rec, true)
    } else {
      let page = 1
      const perPage = 200
      let more = true
      while (more) {
        const { records, more: m } = await fetchModulePage(auth.apiBase, auth.accessToken, module, page, perPage)
        for (const rec of records) {
          const full = await fetchSingleRecord(auth.apiBase, auth.accessToken, module, String(rec.id))
          if (!full) continue
          if (resource === "accounts") await upsertClientForAccount(full)
          else if (resource === "contacts") await upsertContact(full)
          else if (resource === "deals") await upsertDeal(full, false)
          else if (resource === "leads") await upsertDeal(full, true)
        }
        more = m
        page++
        if (page > 100) break
      }
    }

    const { data: zohoProvider } = await supabase
      .from("integration_providers")
      .select("id")
      .eq("slug", "zoho-crm")
      .maybeSingle()

    if (zohoProvider?.id) {
      const { data: zohoOi } = await supabase
        .from("organization_integrations")
        .select("id")
        .eq("user_id", user.id)
        .eq("provider_id", zohoProvider.id)
        .eq("connection_status", "connected")
        .maybeSingle()
      if (zohoOi?.id) {
        await supabase.from("organization_integrations").update({ last_sync_at: now }).eq("id", zohoOi.id)
      }
    }

    return new Response(JSON.stringify({ success: true, processed, resource }), {
      status: 200,
      headers: jsonHeaders,
    })
  } catch (e) {
    const msg = e instanceof ZohoAuthError ? e.message : e instanceof Error ? e.message : "Sync failed"
    const status = e instanceof ZohoAuthError ? 400 : 500
    return new Response(JSON.stringify({ error: msg }), { status, headers: jsonHeaders })
  }
})
