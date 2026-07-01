import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FloatCredentials {
  apiKey: string;
  baseUrl: string;
  source: "integration_config" | "env";
}

interface FloatPerson {
  id: number | string;
  name?: string;
  email?: string;
  role?: string;
  [key: string]: unknown;
}

interface FloatProject {
  id: number | string;
  name?: string;
  client_id?: number | string | null;
  [key: string]: unknown;
}

interface FloatClient {
  id: number | string;
  name?: string;
}

interface FloatAllocation {
  id: number | string;
  people_id?: number | string | null;
  person_id?: number | string | null;
  project_id?: number | string | null;
  start_date?: string | null;
  end_date?: string | null;
  hours?: number | null;
  [key: string]: unknown;
}

interface FloatTaskLike {
  id: number | string;
  people_id?: number | string | null;
  person_id?: number | string | null;
  project_id?: number | string | null;
  start_date?: string | null;
  end_date?: string | null;
  estimated_hours?: number | null;
  hours?: number | null;
  [key: string]: unknown;
}

function asStringId(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

function readConfigString(config: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = config[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

async function resolveFloatCredentials(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<FloatCredentials | null> {
  const { data: provider } = await (supabase as any)
    .from("integration_providers")
    .select("id")
    .eq("slug", "float")
    .maybeSingle();

  if (provider?.id) {
    const { data: orgIntegration } = await (supabase as any)
      .from("organization_integrations")
      .select("config")
      .eq("provider_id", provider.id)
      .eq("user_id", userId)
      .eq("enabled", true)
      .in("connection_status", ["connected", "testing", "error", "disconnected"])
      .maybeSingle();

    const config = (orgIntegration?.config ?? {}) as Record<string, unknown>;
    const apiKey = readConfigString(config, [
      "float_api_key",
      "floatApiKey",
      "api_key",
      "apiKey",
      "token",
    ]);
    const baseUrl =
      readConfigString(config, ["float_base_url", "floatBaseUrl", "base_url", "baseUrl"]) ||
      "https://api.float.com/v3";

    if (apiKey) {
      return { apiKey, baseUrl, source: "integration_config" };
    }
  }

  const apiKey = Deno.env.get("FLOAT_API_KEY")?.trim() ?? "";
  const baseUrl = (Deno.env.get("FLOAT_API_BASE_URL")?.trim() || "https://api.float.com/v3")
    .replace(/\/$/, "");
  if (apiKey) {
    return { apiKey, baseUrl, source: "env" };
  }

  return null;
}

async function fetchAllPages<T>(
  baseUrl: string,
  path: string,
  apiKey: string,
): Promise<T[]> {
  const items: T[] = [];
  let page = 1;
  const perPage = 200;

  for (;;) {
    const url = `${baseUrl}${path}${path.includes("?") ? "&" : "?"}page=${page}&per-page=${perPage}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`${path} failed (${response.status}): ${text.slice(0, 220)}`);
    }

    const payload = await response.json();
    const batch = Array.isArray(payload) ? payload : [];
    items.push(...(batch as T[]));
    if (batch.length < perPage) break;
    page += 1;
  }

  return items;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jwt = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const creds = await resolveFloatCredentials(supabase, user.id);
    if (!creds) {
      return new Response(
        JSON.stringify({
          success: false,
          errors: [
            "Float credentials not configured. Save float_api_key in Admin Integrations or set FLOAT_API_KEY secret.",
          ],
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const baseUrl = creds.baseUrl.replace(/\/$/, "");
    const errors: string[] = [];

    let people: FloatPerson[] = [];
    let clients: FloatClient[] = [];
    let projects: FloatProject[] = [];
    let tasks: FloatTaskLike[] = [];
    let allocations: FloatAllocation[] = [];

    try {
      people = await fetchAllPages<FloatPerson>(baseUrl, "/people", creds.apiKey);
    } catch (error) {
      errors.push(`people: ${error instanceof Error ? error.message : "unknown error"}`);
    }
    try {
      clients = await fetchAllPages<FloatClient>(baseUrl, "/clients", creds.apiKey);
    } catch (error) {
      errors.push(`clients: ${error instanceof Error ? error.message : "unknown error"}`);
    }
    try {
      projects = await fetchAllPages<FloatProject>(baseUrl, "/projects", creds.apiKey);
    } catch (error) {
      errors.push(`projects: ${error instanceof Error ? error.message : "unknown error"}`);
    }
    try {
      tasks = await fetchAllPages<FloatTaskLike>(baseUrl, "/tasks", creds.apiKey);
    } catch (error) {
      errors.push(`tasks: ${error instanceof Error ? error.message : "unknown error"}`);
    }
    try {
      allocations = await fetchAllPages<FloatAllocation>(baseUrl, "/allocations", creds.apiKey);
    } catch (error) {
      errors.push(`allocations: ${error instanceof Error ? error.message : "unknown error"}`);
    }

    const clientNameById = new Map<string, string>();
    for (const client of clients) {
      const id = asStringId(client.id);
      if (id) {
        clientNameById.set(id, client.name ?? "");
      }
    }

    const linkedProjectIds = new Set<string>();
    if (projects.length > 0) {
      const externalIds = projects.map((p) => `float-${asStringId(p.id)}`).filter(Boolean);
      const { data: linkedRows } = await supabase
        .from("projects")
        .select("external_id")
        .eq("external_provider", "float")
        .in("external_id", externalIds);

      for (const row of linkedRows ?? []) {
        const extId = (row as { external_id?: string }).external_id ?? "";
        if (extId.startsWith("float-")) {
          linkedProjectIds.add(extId.replace("float-", ""));
        }
      }
    }

    const nowIso = new Date().toISOString();
    const peopleRows = people
      .map((person) => {
        const id = asStringId(person.id);
        if (!id) return null;
        return {
          user_id: user.id,
          float_people_id: id,
          name: person.name ?? null,
          email: person.email ?? null,
          role: person.role ?? null,
          raw: person,
          synced_at: nowIso,
          updated_at: nowIso,
        };
      })
      .filter(Boolean);

    const projectRows = projects
      .map((project) => {
        const id = asStringId(project.id);
        if (!id) return null;
        const clientId = asStringId(project.client_id);
        return {
          user_id: user.id,
          float_project_id: id,
          name: project.name ?? null,
          client_name: clientId ? (clientNameById.get(clientId) ?? null) : null,
          projects_linked: linkedProjectIds.has(id),
          raw: project,
          synced_at: nowIso,
          updated_at: nowIso,
        };
      })
      .filter(Boolean);

    const allocationRows = [
      ...allocations.map((a) => ({
        user_id: user.id,
        float_allocation_id: asStringId(a.id),
        float_people_id: asStringId(a.people_id ?? a.person_id) || null,
        float_project_id: asStringId(a.project_id) || null,
        starts_at: a.start_date ?? null,
        ends_at: a.end_date ?? null,
        hours: a.hours ?? null,
        source_type: "allocation",
        raw: a,
        synced_at: nowIso,
        updated_at: nowIso,
      })),
      ...tasks.map((t) => ({
        user_id: user.id,
        float_allocation_id: `task-${asStringId(t.id)}`,
        float_people_id: asStringId(t.people_id ?? t.person_id) || null,
        float_project_id: asStringId(t.project_id) || null,
        starts_at: t.start_date ?? null,
        ends_at: t.end_date ?? null,
        hours: t.estimated_hours ?? t.hours ?? null,
        source_type: "task",
        raw: t,
        synced_at: nowIso,
        updated_at: nowIso,
      })),
    ].filter((row) => row.float_allocation_id);

    if (peopleRows.length > 0) {
      const { error } = await supabase
        .from("float_synced_people")
        .upsert(peopleRows, { onConflict: "float_people_id,user_id" });
      if (error) errors.push(`upsert people: ${error.message}`);
    }

    if (projectRows.length > 0) {
      const { error } = await supabase
        .from("float_synced_projects")
        .upsert(projectRows, { onConflict: "float_project_id,user_id" });
      if (error) errors.push(`upsert projects: ${error.message}`);
    }

    if (allocationRows.length > 0) {
      const { error } = await supabase
        .from("float_synced_allocations")
        .upsert(allocationRows, { onConflict: "float_allocation_id,user_id" });
      if (error) errors.push(`upsert allocations: ${error.message}`);
    }

    return new Response(
      JSON.stringify({
        success: errors.length === 0,
        credential_source: creds.source,
        people_synced: peopleRows.length,
        projects_synced: projectRows.length,
        allocations_synced: allocationRows.length,
        projects_linked: projectRows.filter((row) => row.projects_linked).length,
        errors,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("sync-float-schedule error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        errors: [error instanceof Error ? error.message : "Unknown error"],
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
