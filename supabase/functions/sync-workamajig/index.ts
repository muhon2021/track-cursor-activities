// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WmjProject {
  id: string;
  name: string;
  description?: string;
}

interface SyncResult {
  success: boolean;
  projects_synced: number;
  projects_created: number;
  projects_updated: number;
  tasks_synced: number;
  duration_ms: number;
  errors: string[];
}

function slugFromNameAndId(name: string, externalId: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base}-${externalId}`.slice(0, 100);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const started = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const jwt = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Find Workamajig provider id
    const { data: provider, error: providerError } = await supabase
      .from("integration_providers")
      .select("id")
      .eq("slug", "workamajig")
      .single();

    if (providerError || !provider) {
      return new Response(
        JSON.stringify({ error: "Workamajig provider not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Read org-level integration config for base_url and tokens
    const { data: orgIntegration, error: orgError } = await supabase
      .from("organization_integrations")
      .select("config")
      .eq("provider_id", provider.id)
      .eq("connection_status", "connected")
      .maybeSingle();

    if (orgError || !orgIntegration) {
      return new Response(
        JSON.stringify({ error: "Workamajig organization integration not connected" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const config = (orgIntegration.config || {}) as Record<string, any>;
    const baseUrl = (config.base_url as string | undefined)?.replace(/\/$/, "");
    const apiAccessToken = config.api_access_token as string | undefined;
    const userToken = config.user_token as string | undefined;

    if (!baseUrl || !apiAccessToken || !userToken) {
      return new Response(
        JSON.stringify({ error: "Workamajig config missing base_url, api_access_token, or user_token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const errors: string[] = [];
    let projectsCreated = 0;
    let projectsUpdated = 0;

    // Fetch projects from Workamajig API
    const projectsResp = await fetch(`${baseUrl}/api/beta1/projects`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        APIAccessToken: apiAccessToken,
        UserToken: userToken,
      } as HeadersInit,
    });

    if (!projectsResp.ok) {
      const text = await projectsResp.text();
      return new Response(
        JSON.stringify({
          success: false,
          projects_synced: 0,
          projects_created: 0,
          projects_updated: 0,
          tasks_synced: 0,
          duration_ms: Date.now() - started,
          errors: [`Workamajig /projects error: ${projectsResp.status} - ${text.slice(0, 200)}`],
        } satisfies SyncResult),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await projectsResp.json();
    const wmjProjects: WmjProject[] = Array.isArray(body) ? body : body?.projects ?? body?.data ?? [];

    for (const p of wmjProjects) {
      const externalId = String(p.id);
      const slug = slugFromNameAndId(p.name, externalId);

      const { data: existing } = await supabase
        .from("projects")
        .select("id")
        .eq("external_provider", "workamajig")
        .eq("external_id", externalId)
        .maybeSingle();

      const nowIso = new Date().toISOString();
      const row = {
        name: p.name,
        slug,
        description: p.description ?? null,
        external_provider: "workamajig",
        external_id: externalId,
        metadata: {
          source: "workamajig",
        } as Record<string, unknown>,
        is_archived: false,
        updated_at: nowIso,
      };

      if (existing) {
        const { error } = await supabase.from("projects").update(row).eq("id", existing.id);
        if (error) {
          errors.push(`Update ${p.name}: ${error.message}`);
        } else {
          projectsUpdated++;
        }
      } else {
        const { error } = await supabase.from("projects").insert({
          ...row,
          created_at: nowIso,
        });
        if (error) {
          errors.push(`Insert ${p.name}: ${error.message}`);
        } else {
          projectsCreated++;
        }
      }
    }

    const projectsSynced = projectsCreated + projectsUpdated;
    const tasksSynced = 0; // Tasks sync can be layered on later

    const duration = Date.now() - started;
    const result: SyncResult = {
      success: errors.length === 0,
      projects_synced: projectsSynced,
      projects_created: projectsCreated,
      projects_updated: projectsUpdated,
      tasks_synced: tasksSynced,
      duration_ms: duration,
      errors,
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("sync-workamajig error:", error);
    const result: SyncResult = {
      success: false,
      projects_synced: 0,
      projects_created: 0,
      projects_updated: 0,
      tasks_synced: 0,
      duration_ms: Date.now() - started,
      errors: [error instanceof Error ? error.message : "Unknown error"],
    };
    return new Response(JSON.stringify(result), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

