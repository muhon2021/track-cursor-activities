import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function normalizeBaseUrl(host: string): string {
  let h = host.trim().replace(/\/$/, "");
  if (!/^https?:\/\//i.test(h)) h = `https://${h}`;
  return h;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const url = new URL(req.url);
    const attachmentId = url.searchParams.get("attachment_id");
    const filename = url.searchParams.get("filename") || "attachment";

    if (!attachmentId) {
      return new Response(
        JSON.stringify({ error: "attachment_id query parameter is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const jiraHost = Deno.env.get("JIRA_HOST");
    const jiraEmail = Deno.env.get("JIRA_EMAIL");
    const jiraApiToken = Deno.env.get("JIRA_API_TOKEN");

    if (!jiraHost || !jiraEmail || !jiraApiToken) {
      return new Response(
        JSON.stringify({ error: "Jira credentials not configured on server" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const baseUrl = normalizeBaseUrl(jiraHost);
    const auth = `Basic ${btoa(`${jiraEmail}:${jiraApiToken}`)}`;
    const jiraUrl =
      `${baseUrl}/rest/api/3/attachment/content/${encodeURIComponent(attachmentId)}`;

    const r = await fetch(jiraUrl, {
      headers: {
        Authorization: auth,
        Accept: "*/*",
      },
    });

    if (!r.ok) {
      const text = await r.text();
      return new Response(
        JSON.stringify({
          error: `Jira attachment error: ${r.status}`,
          detail: text.slice(0, 200),
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const buf = await r.arrayBuffer();
    const contentType = r.headers.get("content-type") || "application/octet-stream";
    const safeName = filename.replace(/[^\w.\-]+/g, "_").slice(0, 200);

    return new Response(buf, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${safeName}"`,
      },
    });
  } catch (e) {
    console.error("jira-attachment-proxy:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
