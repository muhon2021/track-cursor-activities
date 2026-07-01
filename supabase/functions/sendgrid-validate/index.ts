/**
 * SendGrid API key validation - checks SENDGRID_API_KEY or api_key in sendgrid_config
 * No request body. Returns success/failure based on GET /v3/user/profile
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    let apiKey = Deno.env.get("SENDGRID_API_KEY");
    if (!apiKey) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data } = await supabase
          .from("sendgrid_config")
          .select("api_key")
          .limit(1)
          .maybeSingle();
        if (data?.api_key && typeof data.api_key === "string") {
          apiKey = data.api_key;
        }
      }
    }
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "SENDGRID_API_KEY not configured",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const profileRes = await fetch("https://api.sendgrid.com/v3/user/profile", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (profileRes.ok) {
      const data = (await profileRes.json()) as { email?: string; username?: string };
      const email = data?.email || data?.username || "SendGrid";
      return new Response(
        JSON.stringify({
          success: true,
          message: `API key valid for ${email}`,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const errorText = await profileRes.text();
    let message = "API key invalid or connection failed";
    try {
      const errJson = JSON.parse(errorText);
      if (errJson?.errors?.[0]?.message) {
        message = errJson.errors[0].message;
      }
    } catch {
      // Use default message
    }

    return new Response(
      JSON.stringify({ success: false, message }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("sendgrid-validate error:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, message: msg }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
