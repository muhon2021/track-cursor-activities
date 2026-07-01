import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface EnvironmentCheck {
  name: string;
  status: "pass" | "fail" | "warning";
  message: string;
  critical: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validate user is authenticated and is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is admin
    const { data: roleData } = await userClient.from("user_roles")
      .select("role")
      .eq("user_id", claimsData.user.id)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role for environment checks
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const checks: EnvironmentCheck[] = [];

    // 1. Database Connection
    try {
      const { error } = await supabase.from("app_config").select("count").single();
      checks.push({
        name: "Database Connection",
        status: error ? "fail" : "pass",
        message: error ? `Database error: ${error.message}` : "Database connected successfully",
        critical: true,
      });
    } catch (e: unknown) {
      checks.push({
        name: "Database Connection",
        status: "fail",
        message: `Database connection failed: ${e instanceof Error ? e.message : "Unknown error"}`,
        critical: true,
      });
    }

    // 2. Required Secrets
    const requiredSecrets = [
      { key: "SUPABASE_URL", name: "Supabase URL" },
      { key: "SUPABASE_ANON_KEY", name: "Supabase Anon Key" },
      { key: "SUPABASE_SERVICE_ROLE_KEY", name: "Supabase Service Role Key" },
    ];

    requiredSecrets.forEach(({ key, name }) => {
      const value = Deno.env.get(key);
      checks.push({
        name: `Secret: ${name}`,
        status: value ? "pass" : "fail",
        message: value ? `${name} is configured` : `${name} is missing`,
        critical: true,
      });
    });

    // 3. Optional API Keys
    const optionalSecrets = [
      { key: "OPENAI_API_KEY", name: "OpenAI API" },
      { key: "SENDGRID_API_KEY", name: "SendGrid Email" },
      { key: "ZOOM_CLIENT_ID", name: "Zoom Integration" },
      { key: "GOOGLE_CLIENT_ID", name: "Google Drive Integration" },
    ];

    optionalSecrets.forEach(({ key, name }) => {
      const value = Deno.env.get(key);
      checks.push({
        name: `Integration: ${name}`,
        status: value ? "pass" : "warning",
        message: value ? `${name} is configured` : `${name} not configured (optional)`,
        critical: false,
      });
    });

    // 4. Check OpenAI API if key exists
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (openaiKey) {
      try {
        const response = await fetch("https://api.openai.com/v1/models", {
          headers: {
            Authorization: `Bearer ${openaiKey}`,
          },
        });

        checks.push({
          name: "OpenAI API Test",
          status: response.ok ? "pass" : "fail",
          message: response.ok
            ? "OpenAI API is accessible"
            : `OpenAI API error: ${response.status}`,
          critical: false,
        });
      } catch (e: unknown) {
        checks.push({
          name: "OpenAI API Test",
          status: "fail",
          message: `OpenAI API test failed: ${e instanceof Error ? e.message : "Unknown error"}`,
          critical: false,
        });
      }
    }

    // 5. Check Storage Buckets
    const buckets = ["knowledge-files", "user-uploads", "meeting-recordings"];
    for (const bucketName of buckets) {
      try {
        const { data, error } = await supabase.storage.getBucket(bucketName);
        checks.push({
          name: `Storage Bucket: ${bucketName}`,
          status: error ? "fail" : "pass",
          message: error
            ? `Bucket '${bucketName}' missing or inaccessible`
            : `Bucket '${bucketName}' exists`,
          critical: false,
        });
      } catch (e: unknown) {
        checks.push({
          name: `Storage Bucket: ${bucketName}`,
          status: "fail",
          message: `Failed to check bucket '${bucketName}': ${e instanceof Error ? e.message : "Unknown error"}`,
          critical: false,
        });
      }
    }

    // 6. Check Default Data Seeded
    try {
      const { data, error } = await supabase
        .from("app_config")
        .select("value")
        .eq("key", "system.onboardingCompleted")
        .single();

      const isSeeded = data?.value === true;
      checks.push({
        name: "Default Data Seeded",
        status: isSeeded ? "pass" : "warning",
        message: isSeeded
          ? "Platform has been configured"
          : "Platform needs initial setup",
        critical: false,
      });
    } catch (e) {
      checks.push({
        name: "Default Data Seeded",
        status: "warning",
        message: "Unable to check onboarding status",
        critical: false,
      });
    }

    // 7. Check if at least one admin user exists
    try {
      const { count, error } = await supabase
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("role", "admin");

      const adminCount = count ?? 0;
      checks.push({
        name: "Admin User Exists",
        status: adminCount > 0 ? "pass" : "warning",
        message: adminCount > 0
          ? `${adminCount} admin user(s) configured`
          : "No admin users found - promote a user to admin (see ADMIN-SETUP-GUIDE.md)",
        critical: false,
      });
    } catch (e) {
      checks.push({
        name: "Admin User Exists",
        status: "warning",
        message: "Unable to check admin users",
        critical: false,
      });
    }

    // Calculate overall status
    const criticalFailures = checks.filter((c) => c.critical && c.status === "fail");
    const overallStatus =
      criticalFailures.length > 0 ? "fail" : checks.some((c) => c.status === "fail") ? "warning" : "pass";

    return new Response(
      JSON.stringify({
        overallStatus,
        checks,
        criticalFailures: criticalFailures.length,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
