import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requirePermission } from "../_shared/permission-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const serviceClient = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const action = body.action ?? "list";

    // Public, unauthenticated pre-check used by the signup form to give a friendly
    // error before submitting — does not leak the full domain list.
    if (action === "check") {
      const email = typeof body.email === "string" ? body.email : "";
      const domain = email.includes("@") ? email.split("@")[1].toLowerCase() : "";

      const { count } = await serviceClient
        .from("signup_domain_allowlist")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true);

      if (!count) {
        return new Response(JSON.stringify({ allowed: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: invite } = await serviceClient
        .from("user_invites")
        .select("id")
        .ilike("email", email)
        .maybeSingle();

      if (invite) {
        return new Response(JSON.stringify({ allowed: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: match } = await serviceClient
        .from("signup_domain_allowlist")
        .select("id")
        .eq("domain", domain)
        .eq("is_active", true)
        .maybeSingle();

      return new Response(JSON.stringify({ allowed: !!match }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authResult = await requirePermission(req, userClient, corsHeaders, "org.manage_signup_policy");
    if (authResult instanceof Response) return authResult;
    const { userId } = authResult;

    if (action === "list") {
      const { data, error } = await serviceClient
        .from("signup_domain_allowlist")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return new Response(JSON.stringify({ domains: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "add") {
      const domain = typeof body.domain === "string" ? body.domain.trim().toLowerCase() : "";
      if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
        return new Response(JSON.stringify({ error: "A valid domain is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await serviceClient
        .from("signup_domain_allowlist")
        .insert({ domain, created_by: userId })
        .select()
        .single();

      if (error) throw error;

      await serviceClient.from("activity_logs").insert({
        user_id: userId,
        action: "signup_domain_whitelist.added",
        resource_type: "signup_domain_allowlist",
        resource_id: data.id,
        details: { domain },
      });

      return new Response(JSON.stringify({ domain: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "toggle") {
      const id = body.id;
      if (typeof id !== "string" || typeof body.is_active !== "boolean") {
        return new Response(JSON.stringify({ error: "id and is_active (boolean) are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await serviceClient
        .from("signup_domain_allowlist")
        .update({ is_active: body.is_active })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      await serviceClient.from("activity_logs").insert({
        user_id: userId,
        action: body.is_active ? "signup_domain_whitelist.enabled" : "signup_domain_whitelist.disabled",
        resource_type: "signup_domain_allowlist",
        resource_id: id,
        details: { domain: data.domain },
      });

      return new Response(JSON.stringify({ domain: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "remove") {
      const id = body.id;
      if (typeof id !== "string") {
        return new Response(JSON.stringify({ error: "id is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: existing } = await serviceClient
        .from("signup_domain_allowlist")
        .select("domain")
        .eq("id", id)
        .maybeSingle();

      const { error } = await serviceClient.from("signup_domain_allowlist").delete().eq("id", id);
      if (error) throw error;

      await serviceClient.from("activity_logs").insert({
        user_id: userId,
        action: "signup_domain_whitelist.removed",
        resource_type: "signup_domain_allowlist",
        resource_id: id,
        details: { domain: existing?.domain },
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("signup-domain-whitelist error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
