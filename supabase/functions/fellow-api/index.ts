import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function cleanSubdomain(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^https?:\/\//i, "");
  s = (s.split("/")[0] ?? "").trim();
  s = s.replace(/:\d+$/, "");
  s = s.replace(/\.fellow\.app$/i, "");
  s = s.replace(/[^\w.-]/g, "").replace(/^\.+|\.+$/g, "");

  // Fellow workspace slug should be the first label only.
  if (s.includes(".")) {
    s = s.split(".")[0] ?? "";
  }

  return s;
}

function readConfigString(config: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = config[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

async function resolveFellowCredentials(
  supabase: any,
  userId: string,
): Promise<{ subdomain: string; apiKey: string } | null> {
  const { data: provider } = await supabase
    .from("integration_providers")
    .select("id")
    .eq("slug", "fellow")
    .maybeSingle();

  if (!provider?.id) return null;

  const { data: orgIntegration } = await supabase
    .from("organization_integrations")
    .select("config")
    .eq("provider_id", provider.id)
    .eq("user_id", userId)
    .eq("enabled", true)
    .in("connection_status", ["connected", "testing", "error", "disconnected"])
    .maybeSingle();

  const config = (orgIntegration?.config ?? {}) as Record<string, unknown>;
  const subdomain = cleanSubdomain(readConfigString(config, ["subdomain", "fellow_subdomain", "fellowSubdomain"]));
  const apiKey = readConfigString(config, ["api_key", "apiKey", "fellow_api_key", "fellowApiKey"]);

  if (subdomain && apiKey) return { subdomain, apiKey };
  return null;
}

function fellowBaseUrl(subdomain: string): string {
  return `https://${subdomain}.fellow.app/api/v1`;
}

async function fellowPost(
  baseUrl: string,
  apiKey: string,
  path: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; json: unknown; text: string }> {
  const url = `${baseUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { ok: response.ok, status: response.status, json, text };
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is Record<string, unknown> => x !== null && typeof x === "object");
}

function getRecordingId(rec: Record<string, unknown>): string {
  const id = rec.id ?? rec.recording_id ?? rec.recordingId;
  if (typeof id === "string" || typeof id === "number") return String(id);
  return "";
}

function collectStringsFromUnknown(value: unknown, out: string[], depth = 0): void {
  if (depth > 12) return;
  if (value == null) return;
  if (typeof value === "string") {
    const t = value.trim();
    if (t.length > 2) out.push(t);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStringsFromUnknown(item, out, depth + 1);
    return;
  }
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    for (const key of ["text", "content", "body", "title", "summary", "description", "action_item", "actionItem"]) {
      if (key in o) collectStringsFromUnknown(o[key], out, depth + 1);
    }
    for (const v of Object.values(o)) {
      if (v !== null && typeof v === "object") collectStringsFromUnknown(v, out, depth + 1);
    }
  }
}

function transcriptFromRecording(rec: Record<string, unknown>): string | null {
  const direct =
    rec.transcript_text ??
    rec.transcriptText ??
    rec.transcript ??
    (rec as { transcript?: unknown }).transcript;
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  const fromNotes: string[] = [];
  collectStringsFromUnknown(rec.ai_notes ?? rec.aiNotes, fromNotes);
  if (fromNotes.length === 0) return null;
  return fromNotes.join("\n\n").trim() || null;
}

function flattenActionItemsFromRecordings(recordings: Record<string, unknown>[]): Record<string, unknown>[] {
  const items: Record<string, unknown>[] = [];
  for (const rec of recordings) {
    const id = getRecordingId(rec);
    const scrape: string[] = [];
    collectStringsFromUnknown(rec.ai_notes ?? rec.aiNotes, scrape);
    for (const text of scrape) {
      if (text.length < 3) continue;
      items.push({
        text,
        recording_id: id,
        source: "fellow_ai_notes",
      });
    }
  }
  return items;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: "Server misconfigured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const creds = await resolveFellowCredentials(supabase, user.id);
    if (!creds) {
      return new Response(
        JSON.stringify({
          error: "Fellow is not configured. Add subdomain and API key under Admin → Integrations → Fellow.",
          recordings: [],
          notes: [],
          action_items: [],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const baseUrl = fellowBaseUrl(creds.subdomain);

    let body: Record<string, unknown> = {};
    try {
      if (req.method !== "GET") {
        const parsed = await req.json();
        body = parsed != null && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
      }
    } catch {
      body = {};
    }

    const action = typeof body.action === "string" ? body.action : "list-recordings";
    const limit = typeof body.limit === "number" && body.limit > 0 ? Math.min(body.limit, 200) : 50;
    const recordingId = typeof body.recording_id === "string"
      ? body.recording_id
      : typeof body.recordingId === "string"
      ? body.recordingId
      : "";

    if (action === "list-notes") {
      const r = await fellowPost(baseUrl, creds.apiKey, "/notes", { limit });
      if (!r.ok) {
        const msg = typeof r.json === "object" && r.json && "message" in (r.json as object)
          ? String((r.json as { message?: string }).message)
          : r.text.slice(0, 200);
        return new Response(
          JSON.stringify({ error: msg || "Fellow API error", notes: [], status: r.status }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const payload = r.json as Record<string, unknown> | null;
      const notes = asRecordArray(payload?.notes ?? payload?.data ?? payload);
      return new Response(JSON.stringify({ notes }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list-action-items") {
      const pageSize = Math.min(limit, 100);
      const allRecordings: Record<string, unknown>[] = [];
      let cursor: string | undefined;
      for (let page = 0; page < 20; page++) {
        const reqBody: Record<string, unknown> = {
          limit: pageSize,
          include: { ai_notes: true },
        };
        if (cursor) reqBody.cursor = cursor;

        const r = await fellowPost(baseUrl, creds.apiKey, "/recordings", reqBody);
        if (!r.ok) {
          const msg = r.text.slice(0, 200);
          return new Response(
            JSON.stringify({
              error: msg || "Fellow API error",
              action_items: [],
              status: r.status,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        const payload = r.json as Record<string, unknown> | null;
        const batch = asRecordArray(
          payload?.recordings ?? payload?.data ?? (Array.isArray(payload) ? payload : []),
        );
        allRecordings.push(...batch);
        const nextCursor = typeof payload?.next_cursor === "string"
          ? payload.next_cursor
          : typeof payload?.nextCursor === "string"
          ? payload.nextCursor
          : undefined;
        if (!nextCursor || batch.length < pageSize) break;
        cursor = nextCursor;
      }
      const action_items = flattenActionItemsFromRecordings(allRecordings);
      return new Response(JSON.stringify({ action_items }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get-recording") {
      if (!recordingId) {
        return new Response(JSON.stringify({ error: "recording_id is required", recording: null }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const r = await fellowPost(baseUrl, creds.apiKey, "/recordings", {
        limit: 100,
        include: { ai_notes: true },
      });
      if (!r.ok) {
        return new Response(
          JSON.stringify({
            error: r.text.slice(0, 200) || "Fellow API error",
            recording: null,
            status: r.status,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const payload = r.json as Record<string, unknown> | null;
      const list = asRecordArray(
        payload?.recordings ?? payload?.data ?? (Array.isArray(payload) ? payload : []),
      );
      const found = list.find((rec) => getRecordingId(rec) === recordingId) ?? null;
      if (!found) {
        return new Response(JSON.stringify({ error: "Recording not found", recording: null }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const transcript_text = transcriptFromRecording(found);
      return new Response(
        JSON.stringify({
          recording: { ...found, transcript_text },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // list-recordings (default)
    const r = await fellowPost(baseUrl, creds.apiKey, "/recordings", { limit });
    if (!r.ok) {
      const msg = typeof r.json === "object" && r.json && "message" in (r.json as object)
        ? String((r.json as { message?: string }).message)
        : r.text.slice(0, 200);
      return new Response(
        JSON.stringify({
          error: msg || "Invalid Fellow API key or subdomain",
          recordings: [],
          status: r.status,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const payload = r.json as Record<string, unknown> | null;
    const recordings = asRecordArray(
      payload?.recordings ?? payload?.data ?? (Array.isArray(payload) ? payload : []),
    );
    return new Response(JSON.stringify({ recordings }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("fellow-api error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
        recordings: [],
        notes: [],
        action_items: [],
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
