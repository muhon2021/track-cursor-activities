// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ClearResult {
  success: boolean;
  projects_deleted: number;
  tasks_deleted: number;
  errors: string[];
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

    const body = await req.json().catch(() => ({}));
    const provider = (body?.provider as string | undefined)?.toLowerCase();

    if (!provider) {
      return new Response(
        JSON.stringify({ error: "Provider is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const errors: string[] = [];

    // Delete projects synced from this provider
    const { error: projError, count: projectsDeleted } = await supabase
      .from("projects")
      .delete({ count: "exact" })
      .eq("external_provider", provider);

    if (projError) {
      errors.push(`Delete projects: ${projError.message}`);
    }

    // Delete tasks created for this provider by this user (metadata.source + synced flag)
    const { error: taskError, count: tasksDeleted } = await supabase
      .from("tasks")
      .delete({ count: "exact" })
      .eq("created_by", user.id)
      .contains("metadata", { source: provider, synced: true });

    if (taskError) {
      errors.push(`Delete tasks: ${taskError.message}`);
    }

    const result: ClearResult = {
      success: errors.length === 0,
      projects_deleted: projectsDeleted ?? 0,
      tasks_deleted: tasksDeleted ?? 0,
      errors,
    };

    return new Response(JSON.stringify(result), {
      status: errors.length ? 500 : 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("user-integration-clear-data error:", error);
    const result: ClearResult = {
      success: false,
      projects_deleted: 0,
      tasks_deleted: 0,
      errors: [error instanceof Error ? error.message : "Unknown error"],
    };
    return new Response(JSON.stringify(result), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

