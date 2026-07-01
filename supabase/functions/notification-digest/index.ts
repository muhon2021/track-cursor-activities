import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { routeNotification } from "../_shared/notification-router-core.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { digest_mode, dry_run = false } = await req.json().catch(() => ({}));
    const modes = digest_mode ? [digest_mode] : ["hourly", "daily", "weekly"];
    const results: Record<string, number> = {};

    for (const mode of modes) {
      const { data: pending } = await supabase
        .from("notification_digest_queue")
        .select("*")
        .eq("digest_mode", mode)
        .is("processed_at", null)
        .lte("scheduled_for", new Date().toISOString());

      const byUser = new Map<string, typeof pending>();
      for (const item of pending ?? []) {
        const list = byUser.get(item.user_id) ?? [];
        list.push(item);
        byUser.set(item.user_id, list);
      }

      results[mode] = byUser.size;

      if (dry_run) continue;

      for (const [userId, items] of byUser) {
        const titles = items.map((i) => i.title).slice(0, 10);
        const summary = items.map((i) => `• ${i.title}: ${i.message}`).join("\n");
        const digestTitle =
          mode === "weekly"
            ? "Weekly Summary"
            : mode === "daily"
              ? "Daily Activity Digest"
              : "Hourly Digest";

        await routeNotification(supabase, {
          user_id: userId,
          event_key: "system.alert",
          title: `${digestTitle} (${items.length} updates)`,
          message: summary.slice(0, 2000),
          channels: ["in_app", "email"],
          metadata: { digest_mode: mode, items: titles },
          skip_auth: true,
        });

        const ids = items.map((i) => i.id);
        await supabase
          .from("notification_digest_queue")
          .update({ processed_at: new Date().toISOString() })
          .in("id", ids);
      }
    }

    return new Response(JSON.stringify({ success: true, results, dry_run }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
