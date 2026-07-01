import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_ITEMS = 500;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_QUEUE = 4000;

interface SyncResponse {
  success: boolean;
  pages_synced: number;
  pages_created: number;
  pages_updated: number;
  total_fetched: number;
  errors: string[];
  credential_source?: "integration_config" | "env";
}

interface SharePointCredentials {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  hostname: string;
  sitePath: string;
  source: "integration_config" | "env";
}

interface GraphDriveItem {
  id: string;
  name?: string;
  folder?: Record<string, unknown>;
  file?: { mimeType?: string };
  size?: number;
  webUrl?: string;
  lastModifiedDateTime?: string;
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

function normalizeHostname(raw: string): string {
  return raw.replace(/^https?:\/\//i, "").split("/")[0]?.trim() ?? "";
}

function graphSitePath(hostname: string, sitePathRaw: string): string {
  const host = normalizeHostname(hostname);
  let p = sitePathRaw.trim();
  if (!p || p === "/") {
    return `${host}:/`;
  }
  if (!p.startsWith("/")) {
    p = `/${p}`;
  }
  return `${host}:${p}`;
}

function safeSlugSegment(id: string): string {
  return String(id).replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 220);
}

function shouldIngestFile(item: GraphDriveItem): boolean {
  if (!item.file || item.folder) return false;
  const name = (item.name ?? "").toLowerCase();
  const mime = (item.file.mimeType ?? "").toLowerCase();
  const allowedExt = /\.(txt|md|html?|csv|json|xml|log)$/i;
  if (allowedExt.test(name)) return true;
  if (
    mime.startsWith("text/") ||
    mime === "application/json" ||
    mime === "application/xml"
  ) {
    return true;
  }
  return false;
}

async function getGraphAppToken(
  tenantId: string,
  clientId: string,
  clientSecret: string,
): Promise<{ token?: string; error?: string }> {
  const tokenUrl =
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (data as { error_description?: string }).error_description ||
      (data as { error?: string }).error ||
      `token ${res.status}`;
    return { error: msg };
  }
  const token = (data as { access_token?: string }).access_token;
  if (!token) return { error: "No access_token in response" };
  return { token };
}

async function resolveSharePointCredentials(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<SharePointCredentials | null> {
  const { data: provider } = await supabase
    .from("integration_providers")
    .select("id")
    .eq("slug", "sharepoint")
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
    const tenantId = readConfigString(config, ["tenant_id", "tenantId"]);
    const clientId = readConfigString(config, ["client_id", "clientId"]);
    const clientSecret = readConfigString(config, [
      "client_secret",
      "clientSecret",
    ]);
    const hostname = readConfigString(config, [
      "sharepoint_hostname",
      "sharepointHostname",
    ]);
    const sitePath = readConfigString(config, [
      "sharepoint_site_path",
      "sharepointSitePath",
    ]) || "/";

    if (tenantId && clientId && clientSecret && hostname) {
      return {
        tenantId,
        clientId,
        clientSecret,
        hostname,
        sitePath,
        source: "integration_config",
      };
    }
  }

  const tenantId = Deno.env.get("SHAREPOINT_TENANT_ID")?.trim() ?? "";
  const clientId = Deno.env.get("SHAREPOINT_CLIENT_ID")?.trim() ?? "";
  const clientSecret = Deno.env.get("SHAREPOINT_CLIENT_SECRET")?.trim() ?? "";
  const hostname = Deno.env.get("SHAREPOINT_HOSTNAME")?.trim() ?? "";
  const sitePath = Deno.env.get("SHAREPOINT_SITE_PATH")?.trim() ?? "/";

  if (tenantId && clientId && clientSecret && hostname) {
    return {
      tenantId,
      clientId,
      clientSecret,
      hostname,
      sitePath,
      source: "env",
    };
  }

  return null;
}

async function fetchAllChildren(
  token: string,
  driveId: string,
  folderItemId: string | null,
): Promise<GraphDriveItem[]> {
  const base = folderItemId === null
    ? `https://graph.microsoft.com/v1.0/drives/${driveId}/root/children`
    : `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${folderItemId}/children`;
  const out: GraphDriveItem[] = [];
  let url: string | null = `${base}?$top=100`;
  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Graph children ${res.status}: ${t.slice(0, 200)}`);
    }
    const data = await res.json() as {
      value?: GraphDriveItem[];
      "@odata.nextLink"?: string;
    };
    out.push(...(data.value ?? []));
    url = data["@odata.nextLink"] ?? null;
  }
  return out;
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

    const creds = await resolveSharePointCredentials(supabase, user.id);
    if (!creds) {
      return emptyError(
        [
          "SharePoint credentials not configured. Save tenant_id, client_id, client_secret, and sharepoint_hostname in Admin → Integrations (SharePoint), or set SHAREPOINT_TENANT_ID, SHAREPOINT_CLIENT_ID, SHAREPOINT_CLIENT_SECRET, and SHAREPOINT_HOSTNAME secrets. Optional site path defaults to '/'.",
        ],
        400,
      );
    }

    const { token, error: tokenErr } = await getGraphAppToken(
      creds.tenantId,
      creds.clientId,
      creds.clientSecret,
    );
    if (!token || tokenErr) {
      return emptyError(
        [`Microsoft token failed: ${tokenErr ?? "unknown"}`],
        400,
      );
    }

    const siteKey = encodeURIComponent(
      graphSitePath(creds.hostname, creds.sitePath),
    );
    const siteRes = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${siteKey}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!siteRes.ok) {
      const t = await siteRes.text().catch(() => "");
      return emptyError(
        [`SharePoint site lookup failed ${siteRes.status}: ${t.slice(0, 200)}`],
        400,
      );
    }
    const site = await siteRes.json() as { id?: string };
    const siteId = site.id;
    if (!siteId) {
      return emptyError(["SharePoint site response missing id"], 400);
    }

    const driveRes = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${siteId}/drive`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!driveRes.ok) {
      const t = await driveRes.text().catch(() => "");
      return emptyError(
        [`Default drive lookup failed ${driveRes.status}: ${t.slice(0, 200)}`],
        400,
      );
    }
    const drive = await driveRes.json() as { id?: string };
    const driveId = drive.id;
    if (!driveId) {
      return emptyError(["Drive response missing id"], 400);
    }

    const errors: string[] = [];
    let totalFetched = 0;
    let pagesCreated = 0;
    let pagesUpdated = 0;
    const authorId = user.id;

    const folderQueue: (string | null)[] = [null];
    let queuePops = 0;

    while (
      folderQueue.length > 0 &&
      totalFetched < MAX_ITEMS &&
      queuePops < MAX_QUEUE
    ) {
      const folderId = folderQueue.shift() ?? null;
      queuePops++;

      let children: GraphDriveItem[];
      try {
        children = await fetchAllChildren(token, driveId, folderId);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(msg);
        break;
      }

      for (const item of children) {
        if (item.folder) {
          folderQueue.push(item.id);
          continue;
        }
        if (!shouldIngestFile(item)) continue;

        const size = typeof item.size === "number" ? item.size : 0;
        if (size > MAX_FILE_BYTES) {
          errors.push(
            `Skipped ${item.name ?? item.id}: file too large (${size} bytes)`,
          );
          continue;
        }

        if (totalFetched >= MAX_ITEMS) break;

        const contentUrl =
          `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${item.id}/content`;
        const cRes = await fetch(contentUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!cRes.ok) {
          const t = await cRes.text().catch(() => "");
          errors.push(
            `Download ${item.name ?? item.id}: ${cRes.status} ${t.slice(0, 120)}`,
          );
          continue;
        }

        const buf = await cRes.arrayBuffer();
        if (buf.byteLength > MAX_FILE_BYTES) {
          errors.push(
            `Skipped ${item.name ?? item.id}: downloaded size exceeds cap`,
          );
          continue;
        }

        let content: string;
        try {
          content = new TextDecoder("utf-8", { fatal: false }).decode(buf);
        } catch {
          errors.push(`Decode failed for ${item.name ?? item.id}`);
          continue;
        }

        totalFetched++;
        const externalId = `sharepoint-${driveId}-${item.id}`;
        const slug = `sharepoint-${safeSlugSegment(driveId)}-${safeSlugSegment(item.id)}`;
        const title = (item.name?.trim() || `SharePoint file ${item.id}`).slice(
          0,
          500,
        );
        const summary = content.replace(/\s+/g, " ").trim().slice(0, 280) ||
          null;
        const webUrl = item.webUrl ?? "";
        const metadata = {
          external_id: externalId,
          source: "sharepoint",
          sharepoint_site_id: siteId,
          sharepoint_drive_id: driveId,
          sharepoint_item_id: item.id,
          web_url: webUrl,
          last_modified_datetime: item.lastModifiedDateTime ?? null,
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
            tags: ["sharepoint"],
            metadata,
            embedding_status: "pending",
          });

          if (insErr) errors.push(`Insert ${externalId}: ${insErr.message}`);
          else pagesCreated++;
        }
      }
    }

    if (totalFetched >= MAX_ITEMS) {
      errors.push(
        `Stopped at safety cap (${MAX_ITEMS} files). Run again to sync more if needed.`,
      );
    }
    if (queuePops >= MAX_QUEUE) {
      errors.push(
        `Stopped: folder queue limit (${MAX_QUEUE}). Narrow the library or increase cap in code.`,
      );
    }

    const pagesSynced = pagesCreated + pagesUpdated;
    const hardErrors = errors.filter(
      (e) =>
        e.startsWith("Graph ") ||
        e.startsWith("Insert ") ||
        e.startsWith("Update ") ||
        e.startsWith("Microsoft token") ||
        e.startsWith("SharePoint site") ||
        e.startsWith("Default drive") ||
        e.startsWith("Download "),
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
