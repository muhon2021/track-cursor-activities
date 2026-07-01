import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface JiraProject {
  id: string;
  key: string;
  name: string;
  projectTypeKey?: string;
  simplified?: boolean;
}

interface SyncResponse {
  success: boolean;
  projects_synced: number;
  projects_created: number;
  projects_updated: number;
  errors: string[];
  credential_source?: "integration_config" | "env";
}

interface JiraCredentials {
  host: string;
  email: string;
  apiToken: string;
  source: "integration_config" | "env";
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

function slugFromNameAndId(name: string, externalId: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base}-${externalId}`.slice(0, 100);
}

async function resolveJiraCredentials(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<JiraCredentials | null> {
  const { data: provider } = await supabase
    .from("integration_providers")
    .select("id")
    .eq("slug", "jira")
    .maybeSingle();

  if (provider?.id) {
    const { data: userIntegration } = await supabase
      .from("organization_integrations")
      .select("config")
      .eq("provider_id", provider.id)
      .eq("user_id", userId)
      .eq("enabled", true)
      .in("connection_status", ["connected", "testing", "error", "disconnected"])
      .maybeSingle();

    const integrationCandidates = [userIntegration];
    if (!userIntegration) {
      const { data: orgWideIntegration } = await supabase
        .from("organization_integrations")
        .select("config")
        .eq("provider_id", provider.id)
        .is("user_id", null)
        .eq("enabled", true)
        .in("connection_status", ["connected", "testing", "error", "disconnected"])
        .maybeSingle();
      integrationCandidates.push(orgWideIntegration);
    }

    for (const integration of integrationCandidates) {
      const config = (integration?.config ?? {}) as Record<string, unknown>;
      const host = readConfigString(config, ["jira_host", "jiraHost", "host"]);
      const email = readConfigString(config, ["jira_email", "jiraEmail", "email"]);
      const apiToken = readConfigString(config, [
        "jira_api_token",
        "jiraApiToken",
        "api_token",
        "apiToken",
        "token",
      ]);

      if (host && email && apiToken) {
        return {
          host,
          email,
          apiToken,
          source: "integration_config",
        };
      }
    }
  }

  const host = Deno.env.get("JIRA_HOST")?.trim() ?? "";
  const email = Deno.env.get("JIRA_EMAIL")?.trim() ?? "";
  const apiToken = Deno.env.get("JIRA_API_TOKEN")?.trim() ?? "";
  if (host && email && apiToken) {
    return {
      host,
      email,
      apiToken,
      source: "env",
    };
  }

  return null;
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
      return new Response(
        JSON.stringify({
          success: false,
          projects_synced: 0,
          projects_created: 0,
          projects_updated: 0,
          errors: ["Missing authorization header"],
        } as SyncResponse),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const jwt = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      return new Response(
        JSON.stringify({
          success: false,
          projects_synced: 0,
          projects_created: 0,
          projects_updated: 0,
          errors: ["Invalid token"],
        } as SyncResponse),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const creds = await resolveJiraCredentials(supabase, user.id);
    if (!creds) {
      return new Response(
        JSON.stringify({
          success: false,
          projects_synced: 0,
          projects_created: 0,
          projects_updated: 0,
          errors: [
            "Jira credentials not configured. Save jira_host, jira_email, jira_api_token in Admin Integrations or set JIRA_HOST, JIRA_EMAIL, JIRA_API_TOKEN secrets.",
          ],
        } as SyncResponse),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const baseUrl = creds.host.replace(/\/$/, "");
    const auth = btoa(`${creds.email}:${creds.apiToken}`);
    const response = await fetch(`${baseUrl}/rest/api/3/project`, {
      method: "GET",
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      return new Response(
        JSON.stringify({
          success: false,
          projects_synced: 0,
          projects_created: 0,
          projects_updated: 0,
          errors: [`Jira API error: ${response.status} - ${text.slice(0, 200)}`],
        } as SyncResponse),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const acProjects: JiraProject[] = await response.json();
    const errors: string[] = [];
    let projectsCreated = 0;
    let projectsUpdated = 0;

    for (const jp of acProjects) {
      const externalId = jp.id;
      const slug = slugFromNameAndId(jp.name, externalId);

      const { data: existing } = await supabase
        .from("projects")
        .select("id")
        .eq("external_provider", "jira")
        .eq("external_id", externalId)
        .maybeSingle();

      const row = {
        name: jp.name,
        slug,
        description: null,
        external_provider: "jira",
        external_id: externalId,
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        const { error } = await supabase.from("projects").update(row).eq("id", existing.id);
        if (error) errors.push(`Update ${jp.name}: ${error.message}`);
        else projectsUpdated++;
      } else {
        const { error } = await supabase.from("projects").insert({
          ...row,
          created_at: new Date().toISOString(),
        });
        if (error) errors.push(`Insert ${jp.name}: ${error.message}`);
        else projectsCreated++;
      }
    }

    return new Response(
      JSON.stringify({
        success: errors.length === 0,
        projects_synced: projectsCreated + projectsUpdated,
        projects_created: projectsCreated,
        projects_updated: projectsUpdated,
        credential_source: creds.source,
        errors,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("sync-projects-jira error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        projects_synced: 0,
        projects_created: 0,
        projects_updated: 0,
        errors: [error instanceof Error ? error.message : "Unknown error"],
      } as SyncResponse),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
