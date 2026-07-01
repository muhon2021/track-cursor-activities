/**
 * Zoho CRM OAuth + API helpers for Edge Functions.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export interface ZohoStoredTokens {
  access_token?: string
  refresh_token?: string
  expires_at?: string
  api_domain?: string
  accounts_url?: string
  token_type?: string
  scope?: string
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

export function normalizeZohoApiBase(apiDomain: string | undefined): string {
  const d = (apiDomain || "https://www.zohoapis.com").replace(/\/$/, "")
  if (!d.startsWith("http")) return `https://${d}`
  return d
}

export function defaultAccountsUrl(stored: ZohoStoredTokens | undefined): string {
  const u = stored?.accounts_url
  if (typeof u === "string" && u.startsWith("http")) return u.replace(/\/$/, "")
  return "https://accounts.zoho.com"
}

function readMetadataDomain(meta: unknown): { api_domain?: string; accounts_url?: string } {
  const o = asRecord(meta)
  return {
    api_domain: typeof o.api_domain === "string" ? o.api_domain : undefined,
    accounts_url: typeof o.accounts_url === "string" ? o.accounts_url : undefined,
  }
}

function integrationClientCredentials(config: unknown): {
  clientId: string
  clientSecret: string
  accountsUrl: string
} {
  const c = asRecord(config)
  const clientId =
    (typeof c.zoho_client_id === "string" && c.zoho_client_id) ||
    (typeof c.client_id === "string" && c.client_id) ||
    Deno.env.get("ZOHO_CLIENT_ID") ||
    ""
  const clientSecret =
    (typeof c.zoho_client_secret === "string" && c.zoho_client_secret) ||
    (typeof c.client_secret === "string" && c.client_secret) ||
    Deno.env.get("ZOHO_CLIENT_SECRET") ||
    ""
  const accountsUrl =
    (typeof c.zoho_accounts_url === "string" && c.zoho_accounts_url) ||
    "https://accounts.zoho.com"
  return {
    clientId,
    clientSecret,
    accountsUrl: accountsUrl.replace(/\/$/, ""),
  }
}

export interface ResolvedZohoAuth {
  accessToken: string
  apiBase: string
  accountsUrl: string
  /** Persist refreshed tokens */
  persist: (tokens: ZohoStoredTokens) => Promise<void>
}

export class ZohoAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ZohoAuthError"
  }
}

async function refreshZohoToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
  tokenUrl: string,
): Promise<ZohoStoredTokens> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  })
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  })
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    const msg = typeof json.error === "string" ? json.error : JSON.stringify(json)
    throw new ZohoAuthError(`Zoho token refresh failed: ${msg}`)
  }
  const access = typeof json.access_token === "string" ? json.access_token : ""
  if (!access) throw new ZohoAuthError("Zoho refresh missing access_token")
  const expiresIn = typeof json.expires_in === "string" ? Number(json.expires_in) : Number(json.expires_in || 3600)
  const expires_at = new Date(Date.now() + (Number.isFinite(expiresIn) ? expiresIn * 1000 : 3600_000)).toISOString()
  const api_domain = typeof json.api_domain === "string" ? json.api_domain : undefined
  const newRefresh = typeof json.refresh_token === "string" ? json.refresh_token : refreshToken
  return {
    access_token: access,
    refresh_token: newRefresh,
    expires_at,
    api_domain,
    token_type: typeof json.token_type === "string" ? json.token_type : "Bearer",
  }
}

function tokenExpired(expiresAt: string | undefined): boolean {
  if (!expiresAt) return false
  const t = new Date(expiresAt).getTime()
  if (!Number.isFinite(t)) return false
  return t < Date.now() + 60_000
}

/**
 * Resolve Zoho OAuth for a user: prefer user_oauth_tokens (zoho-crm / zoho), else organization_integrations (zoho-crm).
 */
export async function resolveZohoAuth(
  supabase: SupabaseClient,
  userId: string,
): Promise<ResolvedZohoAuth> {
  const { data: userTok } = await supabase
    .from("user_oauth_tokens")
    .select("id, access_token, refresh_token, expires_at, metadata")
    .eq("user_id", userId)
    .in("provider_slug", ["zoho-crm", "zoho"])
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (userTok?.access_token) {
    const meta = readMetadataDomain(userTok.metadata)
    const { data: zohoOrgIntegration } = await supabase
      .from("organization_integrations")
      .select("config, integration_providers!inner(slug)")
      .eq("user_id", userId)
      .eq("integration_providers.slug", "zoho-crm")
      .maybeSingle()

    const creds = integrationClientCredentials(zohoOrgIntegration?.config)

    let accessToken = userTok.access_token as string
    let refreshToken = (userTok.refresh_token as string) || ""
    let apiDomainOut = meta.api_domain
    let expiresAt = userTok.expires_at as string | undefined

    const persist = async (tokens: ZohoStoredTokens) => {
      const nextMeta = {
        ...(asRecord(userTok.metadata)),
        api_domain: tokens.api_domain || apiDomainOut,
      }
      await supabase
        .from("user_oauth_tokens")
        .update({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || refreshToken,
          expires_at: tokens.expires_at,
          last_refreshed_at: new Date().toISOString(),
          metadata: nextMeta,
        })
        .eq("id", userTok.id as string)
    }

    if (tokenExpired(expiresAt) && refreshToken && creds.clientId && creds.clientSecret) {
      const refreshed = await refreshZohoToken(
        refreshToken,
        creds.clientId,
        creds.clientSecret,
        `${creds.accountsUrl}/oauth/v2/token`,
      )
      accessToken = refreshed.access_token!
      refreshToken = (refreshed.refresh_token as string) || refreshToken
      apiDomainOut = refreshed.api_domain || apiDomainOut
      expiresAt = refreshed.expires_at
      await persist(refreshed)
    }

    return {
      accessToken,
      apiBase: normalizeZohoApiBase(apiDomainOut),
      accountsUrl: creds.accountsUrl,
      persist: async (tokens) => {
        await persist(tokens)
      },
    }
  }

  const { data: orgRow, error: orgErr } = await supabase
    .from("organization_integrations")
    .select("id, oauth_tokens, config, integration_providers!inner(slug)")
    .eq("user_id", userId)
    .eq("integration_providers.slug", "zoho-crm")
    .eq("connection_status", "connected")
    .maybeSingle()

  if (orgErr || !orgRow) {
    throw new ZohoAuthError("Zoho CRM is not connected. Connect Zoho in Integrations or link your user OAuth token.")
  }

  const oauth = asRecord(orgRow.oauth_tokens) as unknown as ZohoStoredTokens
  const creds = integrationClientCredentials(orgRow.config)
  const accountsUrl = defaultAccountsUrl(oauth).replace(/\/$/, "") || creds.accountsUrl

  let accessToken = typeof oauth.access_token === "string" ? oauth.access_token : ""
  let refreshToken = typeof oauth.refresh_token === "string" ? oauth.refresh_token : ""
  let apiDomainOut = oauth.api_domain
  let expiresAt = oauth.expires_at

  if (!accessToken) throw new ZohoAuthError("Missing Zoho access token on organization integration")

  const persistOrg = async (tokens: ZohoStoredTokens) => {
    const next = { ...oauth, ...tokens }
    await supabase
      .from("organization_integrations")
      .update({ oauth_tokens: next as unknown as Record<string, unknown> })
      .eq("id", orgRow.id as string)
  }

  if (tokenExpired(expiresAt) && refreshToken && creds.clientId && creds.clientSecret) {
    const refreshed = await refreshZohoToken(
      refreshToken,
      creds.clientId,
      creds.clientSecret,
      `${accountsUrl}/oauth/v2/token`,
    )
    accessToken = refreshed.access_token!
    await persistOrg(refreshed)
  }

  return {
    accessToken,
    apiBase: normalizeZohoApiBase(apiDomainOut),
    accountsUrl,
    persist: persistOrg,
  }
}

export async function zohoFetchJson(
  apiBase: string,
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; json: unknown }> {
  const url = `${apiBase.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`
  const baseHeaders: Record<string, string> = {
    Authorization: `Zoho-oauthtoken ${accessToken}`,
  }
  const res = await fetch(url, {
    ...init,
    headers: { ...(init?.headers as Record<string, string> | undefined), ...baseHeaders },
  })
  const json = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, json }
}

/** Lightweight validation call after refresh */
export async function validateZohoCrmAccess(apiBase: string, accessToken: string): Promise<boolean> {
  const { ok, json } = await zohoFetchJson(apiBase, accessToken, "/crm/v2/settings/modules?module=Deals")
  if (ok) return true
  const data = asRecord(json).data
  if (Array.isArray(data) && data.length > 0) {
    const first = asRecord(data[0])
    if (typeof first.code === "string" && first.code === "INVALID_TOKEN") return false
  }
  return ok
}

export function zohoDealIdFromExternalId(externalId: string | null | undefined): string | null {
  if (!externalId || !externalId.startsWith("zoho-deal-")) return null
  return externalId.slice("zoho-deal-".length)
}

export function parseMetadataString(meta: unknown, key: string): string | null {
  const o = asRecord(meta)
  const v = o[key]
  return typeof v === "string" && v ? v : null
}

export function zohoAccountIdFromClientExternalId(externalId: string | null | undefined): string | null {
  if (!externalId || !externalId.startsWith("zoho-account-")) return null
  return externalId.slice("zoho-account-".length)
}
