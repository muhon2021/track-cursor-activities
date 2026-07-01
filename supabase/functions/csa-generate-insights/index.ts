/**
 * CSA generate insights — aggregate session data + AI audit into csa_insights_reports
 */

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireEnvVars } from "../_shared/env-validator.ts";
import { successResponse, errorResponse, unauthorizedResponse } from "../_shared/responses.ts";
import { buildCsaAuditReport, type CsaMessageRow, type CsaSessionRow } from "../_shared/csa-audit.ts";
import { resolveCsaPeriod } from "../_shared/csa-period.ts";

async function getAuthUser(req: Request, supabaseAdmin: SupabaseClient) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

async function isAdmin(supabaseAdmin: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
  return !!data;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", corsHeaders, 405);
  }

  try {
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = requireEnvVars([
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
    ]);
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const user = await getAuthUser(req, supabaseAdmin);
    if (!user) return unauthorizedResponse("Unauthorized", corsHeaders);

    const admin = await isAdmin(supabaseAdmin, user.id);

    const body = await req.json().catch(() => ({})) as {
      user_id?: string;
      period_start?: string;
      period_end?: string;
    };
    const requestedUserId = body.user_id;

    if (!admin) {
      if (requestedUserId && requestedUserId !== user.id) {
        return unauthorizedResponse("Forbidden", corsHeaders);
      }
    }

    const period = resolveCsaPeriod(body);
    if ("error" in period) return errorResponse(period.error, corsHeaders, 400);

    const { period_start: startStr, period_end: endStr, startIso, endIso, period_type } = period;

    let sessionQuery = supabaseAdmin
      .from("csa_sessions")
      .select("id, user_id, user_email, project_name, workspace_path, model, started_at, ended_at, message_count, metadata")
      .gte("started_at", startIso)
      .lte("started_at", endIso)
      .gt("message_count", 0);

    const targetUserId = requestedUserId || (!admin ? user.id : undefined);

    if (targetUserId) {
      sessionQuery = sessionQuery.eq("user_id", targetUserId);
    }

    const { data: sessions, error: sErr } = await sessionQuery;
    if (sErr) return errorResponse(sErr.message, corsHeaders, 500);

    const filteredSessions = sessions || [];
    const userIds = [...new Set(filteredSessions.map((s) => s.user_id))];
    let generated = 0;

    for (const userId of userIds) {
      const userSessions = filteredSessions.filter((s) => s.user_id === userId) as CsaSessionRow[];
      const sessionIds = userSessions.map((s) => s.id);

      const { data: messages } = await supabaseAdmin
        .from("csa_messages")
        .select("session_id, role, content, content_length, metadata, created_at")
        .in("session_id", sessionIds)
        .gte("created_at", startIso)
        .lte("created_at", endIso)
        .order("created_at", { ascending: true });

      const userEmail = userSessions[0]?.user_email || null;
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("full_name, email")
        .eq("id", userId)
        .maybeSingle();

      const displayName = profile?.full_name || userEmail || "Unknown User";

      const { audit, statsJson, overview, friction_points, recommendations, generation_meta } =
        await buildCsaAuditReport(
          supabaseAdmin,
          displayName,
          startStr,
          endStr,
          userSessions,
          (messages || []) as CsaMessageRow[],
        );

      const insights = {
        overview,
        activity_breakdown: statsJson.activity_breakdown,
        friction_points,
        recommendations,
        audit,
        generation_meta,
      };

      const { error: upsertErr } = await supabaseAdmin.from("csa_insights_reports").upsert(
        {
          user_id: userId,
          user_email: userEmail || profile?.email,
          user_display_name: displayName,
          period_start: startStr,
          period_end: endStr,
          period_type,
          stats_json: statsJson,
          insights_json: insights,
          generated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,period_start,period_end,period_type" },
      );

      if (!upsertErr) generated++;
    }

    const sessionsFound = filteredSessions.length;
    const rangeLabel = `${startStr} to ${endStr}`;

    return successResponse({
      generated,
      sessions_found: sessionsFound,
      period_start: startStr,
      period_end: endStr,
      message:
        generated === 0
          ? `No sessions with prompts in ${rangeLabel}. Use Cursor with hooks installed, then regenerate.`
          : undefined,
    }, corsHeaders);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Internal error", corsHeaders, 500);
  }
});
