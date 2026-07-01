import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_PAGES = 500;
const PAGE_LIMIT = 50;

interface SyncResponse {
  success: boolean;
  pages_synced: number;
  pages_created: number;
  pages_updated: number;
  total_fetched: number;
  errors: string[];
  credential_source?: "integration_config" | "env";
}

interface ConfluenceCredentials {
  email: string;
  apiToken: string;
  domain: string;
  spaceKey: string;
  source: "integration_config" | "env";
}

interface ConfluencePage {
  id: string;
  type?: string;
  title?: string;
  body?: { storage?: { value?: string } };
  version?: { number?: number };
  space?: { id?: string; key?: string };
  _links?: { webui?: string };
}

function readConfigString(
  config: Record<string, unknown>,
  keys: string[],
): string {
  for (const key of keys) {
    const value = config[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function normalizeDomain(raw: string): string {
  return raw.replace(/^https?:\/\//i, "").split("/")[0]?.trim() ?? "";
}

function htmlToSummary(html: string, maxLen: number): string {
  const t = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen)}…`;
}

function pageWebUrl(domain: string, page: ConfluencePage): string {
  const webui = page._links?.webui;
  const host = normalizeDomain(domain);
  if (webui?.startsWith("http")) return webui;
  if (webui?.startsWith("/")) return `https://${host}${webui}`;
  return `https://${host}/wiki/pages/${page.id}`;
}

function resolveNextUrl(domain: string, nextPath: string | undefined): string | null {
  if (!nextPath) return null;
  const host = normalizeDomain(domain);
  if (nextPath.startsWith("http")) return nextPath;
  return nextPath.startsWith("/")
    ? `https://${host}${nextPath}`
    : `https://${host}/${nextPath}`;
}

async function resolveConfluenceCredentials(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<ConfluenceCredentials | null> {
  const { data: provider } = await supabase
    .from("integration_providers")
    .select("id")
    .eq("slug", "confluence")
    .maybeSingle();

  if (provider?.id) {
    const { data: orgIntegration } = await supabase
      .from("organization_integrations")
      .select("config")
      .eq("provider_id", provider.id)
      .eq("user_id", userId)
      .eq("enabled", true)
      .in("connection_status", ["connected", "testing", "error", "disconnected"])
      .maybeSingle();

    const config = (orgIntegration?.config ?? {}) as Record<string, unknown>;
    const email = readConfigString(config, ["confluence_email", "email"]);
    const apiToken = readConfigString(config, [
      "confluence_api_token",
      "api_token",
      "apiToken",
      "api_key",
    ]);
    const domainRaw = readConfigString(config, ["confluence_domain", "domain"]);
    const domain = normalizeDomain(domainRaw);
    const spaceKey = readConfigString(config, ["confluence_space_key", "spaceKey"]);

    if (email && apiToken && domain) {
      return { email, apiToken, domain, spaceKey, source: "integration_config" };
    }
  }

  const email = Deno.env.get("CONFLUENCE_EMAIL")?.trim() ?? "";
  const apiToken = Deno.env.get("CONFLUENCE_API_TOKEN")?.trim() ?? "";
  const domain = normalizeDomain(Deno.env.get("CONFLUENCE_DOMAIN")?.trim() ?? "");
  const spaceKey = Deno.env.get("CONFLUENCE_SPACE_KEY")?.trim() ?? "";

  if (email && apiToken && domain) {
    return { email, apiToken, domain, spaceKey, source: "env" };
  }

  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const emptyError = (errors: string[], status: number): Response =>
    new Response(
      JSON.stringify({
        success: false,
        pages_synced: 0,
        pages_created: 0,
        pages_updated: 0,
        total_fetched: 0,
        errors,
      } as SyncResponse),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return emptyError(["Missing authorization header"], 401);
    }

    const jwt = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      return emptyError(["Invalid token"], 401);
    }

    let bodyUserId: string | undefined;
    try {
      const body = await req.json().catch(() => ({}));
      bodyUserId = typeof body?.user_id === "string" ? body.user_id : undefined;
    } catch {
      bodyUserId = undefined;
    }

    if (bodyUserId && bodyUserId !== user.id) {
      return emptyError(["user_id does not match authenticated user"], 403);
    }

    const creds = await resolveConfluenceCredentials(supabase, user.id);
    if (!creds) {
      return emptyError(
        [
          "Confluence credentials not configured. Save confluence_email, confluence_api_token, and confluence_domain in Admin → Integrations, or set CONFLUENCE_EMAIL, CONFLUENCE_API_TOKEN, and CONFLUENCE_DOMAIN secrets.",
        ],
        400,
      );
    }

    const auth = btoa(`${creds.email}:${creds.apiToken}`);
    const headers: Record<string, string> = {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
    };

    let url =
      `https://${creds.domain}/wiki/rest/api/content?type=page&expand=body.storage,version,space&limit=${PAGE_LIMIT}`;
    if (creds.spaceKey) {
      url += `&spaceKey=${encodeURIComponent(creds.spaceKey)}`;
    }

    const errors: string[] = [];
    let totalFetched = 0;
    let pagesCreated = 0;
    let pagesUpdated = 0;
    const authorId = user.id;

    while (url && totalFetched < MAX_PAGES) {
      const res = await fetch(url, { headers });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        errors.push(`Confluence API error ${res.status}: ${text.slice(0, 200)}`);
        break;
      }

      const payload = await res.json() as {
        results?: ConfluencePage[];
        _links?: { next?: string };
      };

      const results = payload.results ?? [];
      for (const page of results) {
        if (totalFetched >= MAX_PAGES) break;
        if (page.type && page.type !== "page") continue;

        totalFetched++;
        const externalId = `confluence-${page.id}`;
        const html = page.body?.storage?.value ?? "";
        const title = (page.title?.trim() || `Confluence page ${page.id}`).slice(0, 500);
        const content = html || "(empty body)";
        const summary = html ? htmlToSummary(html, 280) : null;
        const slug = `confluence-${page.id}`;
        const pageUrl = pageWebUrl(creds.domain, page);
        const metadata = {
          external_id: externalId,
          source: "confluence",
          confluence_page_id: page.id,
          confluence_space_id: page.space?.id ?? null,
          confluence_url: pageUrl,
          confluence_version: page.version?.number ?? null,
          synced_at: new Date().toISOString(),
        };

        const { data: existing } = await supabase
          .from("knowledge_entries")
          .select("id")
          .filter("metadata->>external_id", "eq", externalId)
          .maybeSingle();

        if (existing?.id) {
          const { error: upErr } = await supabase
            .from("knowledge_entries")
            .update({
              title,
              content,
              summary,
              slug,
              metadata,
              status: "published",
              embedding_status: "pending",
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);

          if (upErr) errors.push(`Update ${externalId}: ${upErr.message}`);
          else pagesUpdated++;
        } else {
          const { error: insErr } = await supabase.from("knowledge_entries").insert({
            title,
            slug,
            content,
            summary,
            category_id: null,
            author_id: authorId,
            status: "published",
            tags: ["confluence"],
            metadata,
            embedding_status: "pending",
          });

          if (insErr) errors.push(`Insert ${externalId}: ${insErr.message}`);
          else pagesCreated++;
        }
      }

      if (totalFetched >= MAX_PAGES) {
        url = "";
      } else {
        const nextRaw = payload._links?.next;
        url = resolveNextUrl(creds.domain, nextRaw) ?? "";
      }
      if (!results.length) break;
    }

    if (totalFetched >= MAX_PAGES) {
      errors.push(
        `Stopped at safety cap (${MAX_PAGES} pages). Run again to continue if pagination is available.`,
      );
    }

    const pagesSynced = pagesCreated + pagesUpdated;
    const hardErrors = errors.filter(
      (e) =>
        e.startsWith("Confluence API error") ||
        e.startsWith("Insert ") ||
        e.startsWith("Update "),
    );
    return new Response(
      JSON.stringify({
        success: hardErrors.length === 0,
        pages_synced: pagesSynced,
        pages_created: pagesCreated,
        pages_updated: pagesUpdated,
        total_fetched: totalFetched,
        errors,
        credential_source: creds.source,
      } as SyncResponse),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return emptyError([message], 500);
  }
});
