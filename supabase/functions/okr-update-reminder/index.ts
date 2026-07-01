/**
 * okr-update-reminder
 *
 * Finds key results with stale updates and returns grouped reminder payload.
 * This function can be run by cron and integrated with email delivery pipelines.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAY_MS = 24 * 60 * 60 * 1000;
const frequencyDays: Record<string, number> = {
  daily: 1,
  weekly: 7,
  biweekly: 14,
  monthly: 30,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const payload = await req.json().catch(() => ({}));
    const graceDays = Number(payload.grace_days ?? 2);

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: keyResults, error } = await supabaseClient
      .from("okr_key_results")
      .select(`
        id,
        title,
        status,
        updated_at,
        owner_id,
        okr_id,
        okrs:okr_id (id, title, quarter, status)
      `)
      .not("owner_id", "is", null)
      .in("status", ["not_started", "on_track", "at_risk", "behind"])
      .limit(2000);

    if (error) throw error;

    const now = Date.now();
    const remindersByOwner: Record<string, Array<Record<string, unknown>>> = {};

    for (const kr of keyResults || []) {
      // Existing schema does not yet store update_frequency/last_updated_at separately.
      // We use updated_at as fallback and default cadence = weekly for compatibility.
      const frequency = "weekly";
      const thresholdDays = (frequencyDays[frequency] ?? 7) + graceDays;
      const updatedAtMs = kr.updated_at ? new Date(kr.updated_at).getTime() : 0;
      const staleDays = Math.floor((now - updatedAtMs) / DAY_MS);

      if (staleDays >= thresholdDays) {
        const ownerId = String(kr.owner_id);
        if (!remindersByOwner[ownerId]) remindersByOwner[ownerId] = [];

        remindersByOwner[ownerId].push({
          key_result_id: kr.id,
          key_result_title: kr.title,
          okr_id: kr.okr_id,
          okr_title: (kr as Record<string, any>).okrs?.title ?? "Untitled OKR",
          quarter: (kr as Record<string, any>).okrs?.quarter ?? null,
          stale_days: staleDays,
          cadence: frequency,
          threshold_days: thresholdDays,
        });
      }
    }

    const ownerIds = Object.keys(remindersByOwner);

    // Optional user resolution for email hand-off.
    let ownerProfiles: Record<string, { email?: string | null; full_name?: string | null }> = {};
    if (ownerIds.length > 0) {
      const { data: profiles } = await supabaseClient
        .from("profiles")
        .select("id,email,full_name")
        .in("id", ownerIds);

      ownerProfiles = Object.fromEntries(
        (profiles || []).map((profile: Record<string, any>) => [
          profile.id,
          { email: profile.email ?? null, full_name: profile.full_name ?? null },
        ]),
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        generated_at: new Date().toISOString(),
        totals: {
          owners_with_overdue: ownerIds.length,
          overdue_key_results: Object.values(remindersByOwner).reduce((sum, rows) => sum + rows.length, 0),
        },
        reminders: ownerIds.map((ownerId) => ({
          owner_id: ownerId,
          owner: ownerProfiles[ownerId] || null,
          key_results: remindersByOwner[ownerId],
        })),
        note:
          "Email delivery is intentionally decoupled; connect this payload to send-email/send-email-with-tracking for production reminders.",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: unknown) {
    console.error("okr-update-reminder error", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
