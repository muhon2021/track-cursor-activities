/**
 * CSA reports API — read insights, team summary, token management
 */

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireEnvVars } from "../_shared/env-validator.ts";
import { successResponse, errorResponse, unauthorizedResponse } from "../_shared/responses.ts";
import { resolveCsaPeriod } from "../_shared/csa-period.ts";

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `csa_${Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

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

type SessionRow = {
  id: string;
  user_id: string;
  user_email: string | null;
  message_count: number;
  started_at: string;
};

type MessageRow = {
  session_id: string;
  user_id: string;
  role: string;
};

async function aggregateUserStatsInPeriod(
  supabaseAdmin: SupabaseClient,
  period: { startIso: string; endIso: string },
) {
  const { data: sessions, error: sErr } = await supabaseAdmin
    .from("csa_sessions")
    .select("id, user_id, user_email, message_count, started_at")
    .gte("started_at", period.startIso)
    .lte("started_at", period.endIso)
    .gt("message_count", 0);

  if (sErr) throw new Error(sErr.message);

  const liveSessions = (sessions || []) as SessionRow[];
  const sessionIds = liveSessions.map((s) => s.id);

  const promptCountByUser = new Map<string, number>();
  if (sessionIds.length > 0) {
    const { data: messages, error: mErr } = await supabaseAdmin
      .from("csa_messages")
      .select("session_id, user_id, role")
      .in("session_id", sessionIds)
      .eq("role", "user")
      .gte("created_at", period.startIso)
      .lte("created_at", period.endIso);

    if (mErr) throw new Error(mErr.message);

    for (const m of (messages || []) as MessageRow[]) {
      promptCountByUser.set(m.user_id, (promptCountByUser.get(m.user_id) || 0) + 1);
    }
  }

  const sessionsByUser = new Map<string, SessionRow[]>();
  for (const s of liveSessions) {
    const list = sessionsByUser.get(s.user_id) || [];
    list.push(s);
    sessionsByUser.set(s.user_id, list);
  }

  return { liveSessions, sessionsByUser, promptCountByUser };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = requireEnvVars([
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
    ]);
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const user = await getAuthUser(req, supabaseAdmin);
    if (!user) return unauthorizedResponse("Unauthorized", corsHeaders);

    const url = new URL(req.url);
    const bodyJson = req.method === "POST"
      ? (await req.json().catch(() => ({})) as Record<string, unknown>)
      : {};
    const action = (url.searchParams.get("action") || bodyJson.action || "list") as string;

    if (req.method === "POST" && action === "create-token") {
      const label = (bodyJson.label as string | undefined)?.trim() || "default";

      const { data: existingActive } = await supabaseAdmin
        .from("csa_ingest_tokens")
        .select("id")
        .eq("user_id", user.id)
        .is("revoked_at", null)
        .maybeSingle();

      if (existingActive) {
        return errorResponse(
          "You already have an active ingest token. Revoke it before creating a new one.",
          corsHeaders,
          409,
        );
      }

      const plainToken = generateToken();
      const tokenHash = await sha256(plainToken);

      const { data, error } = await supabaseAdmin
        .from("csa_ingest_tokens")
        .insert({ user_id: user.id, token_hash: tokenHash, label })
        .select("id, label, created_at")
        .single();

      if (error) return errorResponse(error.message, corsHeaders, 500);
      return successResponse({ token: plainToken, record: data }, corsHeaders);
    }

    if (req.method === "POST" && action === "revoke-token") {
      const tokenId = bodyJson.token_id as string | undefined;
      if (!tokenId) return errorResponse("token_id is required", corsHeaders, 400);

      const { error } = await supabaseAdmin
        .from("csa_ingest_tokens")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", tokenId)
        .eq("user_id", user.id);

      if (error) return errorResponse(error.message, corsHeaders, 500);
      return successResponse({ revoked: true }, corsHeaders);
    }

    if ((req.method === "GET" || req.method === "POST") && action === "list-tokens") {
      const { data, error } = await supabaseAdmin
        .from("csa_ingest_tokens")
        .select("id, label, created_at, last_used_at, revoked_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) return errorResponse(error.message, corsHeaders, 500);
      return successResponse({ tokens: data || [] }, corsHeaders);
    }

    const admin = await isAdmin(supabaseAdmin, user.id);

    const periodInput = {
      period_start: (bodyJson.period_start as string | undefined) || url.searchParams.get("period_start") || undefined,
      period_end: (bodyJson.period_end as string | undefined) || url.searchParams.get("period_end") || undefined,
    };
    const periodResolved = resolveCsaPeriod(periodInput);
    if ("error" in periodResolved) return errorResponse(periodResolved.error, corsHeaders, 400);

    if ((req.method === "GET" || req.method === "POST") && action === "list") {
      if (!admin) return unauthorizedResponse("Admin access required", corsHeaders);

      const { sessionsByUser, promptCountByUser } = await aggregateUserStatsInPeriod(
        supabaseAdmin,
        periodResolved,
      );

      const userIds = [...sessionsByUser.keys()];
      if (userIds.length === 0) {
        return successResponse({
          reports: [],
          period_start: periodResolved.period_start,
          period_end: periodResolved.period_end,
        }, corsHeaders);
      }

      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      const profileById = new Map((profiles || []).map((p) => [p.id, p]));

      const { data: periodReports } = await supabaseAdmin
        .from("csa_insights_reports")
        .select("*")
        .in("user_id", userIds)
        .eq("period_start", periodResolved.period_start)
        .eq("period_end", periodResolved.period_end);

      const reportByUser = new Map((periodReports || []).map((r) => [r.user_id, r]));

      const reports = userIds.map((userId) => {
        const userSessions = sessionsByUser.get(userId) || [];
        const profile = profileById.get(userId);
        const existing = reportByUser.get(userId);
        const email = userSessions[0]?.user_email || profile?.email || null;
        const displayName = profile?.full_name || email || "Unknown User";
        const totalSessions = userSessions.length;
        const totalPrompts = promptCountByUser.get(userId) || 0;

        if (existing) {
          return {
            ...existing,
            user_display_name: existing.user_display_name || displayName,
            user_email: existing.user_email || email,
            stats_json: {
              ...(existing.stats_json as Record<string, unknown>),
              total_sessions: totalSessions,
              total_prompts: totalPrompts,
            },
          };
        }

        return {
          id: `live-${userId}-${periodResolved.period_start}`,
          user_id: userId,
          user_email: email,
          user_display_name: displayName,
          period_start: periodResolved.period_start,
          period_end: periodResolved.period_end,
          period_type: periodResolved.period_type,
          stats_json: {
            total_sessions: totalSessions,
            total_prompts: totalPrompts,
          },
          insights_json: {},
          generated_at: null as string | null,
        };
      }).sort((a, b) => (b.stats_json?.total_prompts ?? 0) - (a.stats_json?.total_prompts ?? 0));

      return successResponse({
        reports,
        period_start: periodResolved.period_start,
        period_end: periodResolved.period_end,
      }, corsHeaders);
    }

    if ((req.method === "GET" || req.method === "POST") && action === "team-summary") {
      if (!admin) return unauthorizedResponse("Admin access required", corsHeaders);

      const { liveSessions, promptCountByUser } = await aggregateUserStatsInPeriod(
        supabaseAdmin,
        periodResolved,
      );

      const uniqueUsers = new Set(liveSessions.map((s) => s.user_id));
      const totalSessions = liveSessions.length;
      const totalPrompts = [...promptCountByUser.values()].reduce((sum, n) => sum + n, 0);
      const avgPromptsPerSession = totalSessions > 0 ? Math.round((totalPrompts / totalSessions) * 10) / 10 : 0;

      const { data: reports } = await supabaseAdmin
        .from("csa_insights_reports")
        .select("user_id, insights_json")
        .eq("period_start", periodResolved.period_start)
        .eq("period_end", periodResolved.period_end);

      const frictionThemes: Record<string, number> = {};
      for (const r of reports || []) {
        const points = (r.insights_json as { friction_points?: string[] })?.friction_points || [];
        for (const p of points) {
          frictionThemes[p] = (frictionThemes[p] || 0) + 1;
        }
      }

      const topFriction = Object.entries(frictionThemes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([theme, count]) => ({ theme, count }));

      return successResponse({
        active_users: uniqueUsers.size,
        total_sessions: totalSessions,
        total_messages: totalPrompts,
        avg_messages_per_session: avgPromptsPerSession,
        top_friction_themes: topFriction,
        reports_count: reports?.length || 0,
        period_start: periodResolved.period_start,
        period_end: periodResolved.period_end,
      }, corsHeaders);
    }

    if ((req.method === "GET" || req.method === "POST") && action === "detail") {
      const targetUserId = url.searchParams.get("user_id") || (bodyJson.user_id as string | undefined);
      if (!targetUserId) return errorResponse("user_id is required", corsHeaders, 400);
      if (!admin && targetUserId !== user.id) return unauthorizedResponse("Forbidden", corsHeaders);

      const { data: report, error: rErr } = await supabaseAdmin
        .from("csa_insights_reports")
        .select("*")
        .eq("user_id", targetUserId)
        .eq("period_start", periodResolved.period_start)
        .eq("period_end", periodResolved.period_end)
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (rErr) return errorResponse(rErr.message, corsHeaders, 500);

      const { data: sessions, error: sErr } = await supabaseAdmin
        .from("csa_sessions")
        .select("id, cursor_session_id, project_name, model, started_at, ended_at, message_count")
        .eq("user_id", targetUserId)
        .gte("started_at", periodResolved.startIso)
        .lte("started_at", periodResolved.endIso)
        .gt("message_count", 0)
        .order("started_at", { ascending: false })
        .limit(50);

      if (sErr) return errorResponse(sErr.message, corsHeaders, 500);

      return successResponse({
        report,
        sessions: sessions || [],
        period_start: periodResolved.period_start,
        period_end: periodResolved.period_end,
      }, corsHeaders);
    }

    return errorResponse("Unknown action", corsHeaders, 400);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Internal error", getCorsHeaders(req.headers.get("origin")), 500);
  }
});
