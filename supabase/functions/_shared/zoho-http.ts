/**
 * Shared HTTP entry for Zoho deal-scoped sync functions (JWT + CORS).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1"
import { getCorsHeaders, handleCorsPreflight } from "./cors.ts"
import { resolveZohoAuth, ZohoAuthError, zohoDealIdFromExternalId } from "./zoho.ts"

// deno-lint-ignore no-explicit-any
export interface ZohoDealSyncContext {
  supabase: any
  userId: string
  dealId: string
  zohoDealId: string
  accessToken: string
  apiBase: string
}

export async function handleZohoDealEdgeRequest(
  req: Request,
  run: (ctx: ZohoDealSyncContext) => Promise<{ synced: number; message?: string }>,
): Promise<Response> {
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
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 503,
        headers: jsonHeaders,
      })
    }

    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(jwt)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid or expired session" }), {
        status: 401,
        headers: jsonHeaders,
      })
    }

    let body: { deal_id?: string }
    try {
      body = await req.json()
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: jsonHeaders,
      })
    }

    const dealId = typeof body.deal_id === "string" ? body.deal_id : ""
    if (!dealId) {
      return new Response(JSON.stringify({ error: "deal_id is required" }), {
        status: 400,
        headers: jsonHeaders,
      })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    const { data: deal, error: dealErr } = await supabase
      .from("deals")
      .select("id, external_id")
      .eq("id", dealId)
      .single()

    if (dealErr || !deal) {
      return new Response(JSON.stringify({ error: "Deal not found" }), {
        status: 404,
        headers: jsonHeaders,
      })
    }

    const zohoDealId = zohoDealIdFromExternalId(deal.external_id as string | null)
    if (!zohoDealId) {
      return new Response(JSON.stringify({ error: "Deal is not linked to a Zoho CRM deal" }), {
        status: 400,
        headers: jsonHeaders,
      })
    }

    const auth = await resolveZohoAuth(supabase, user.id)
    const result = await run({
      supabase,
      userId: user.id,
      dealId,
      zohoDealId,
      accessToken: auth.accessToken,
      apiBase: auth.apiBase,
    })

    return new Response(JSON.stringify({ success: true, ...result }), {
      status: 200,
      headers: jsonHeaders,
    })
  } catch (e) {
    const msg = e instanceof ZohoAuthError ? e.message : e instanceof Error ? e.message : "Unexpected error"
    const status = e instanceof ZohoAuthError ? 400 : 500
    return new Response(JSON.stringify({ error: msg }), { status, headers: jsonHeaders })
  }
}
