import { supabase } from "@/integrations/supabase/client";
import type { CsaAuditReport } from "@/types/csaAuditReport";

import type { CsaDateRange } from "@/lib/csaDateRange";

export interface CsaGenerationMeta {
  source: "ai" | "heuristic";
  model?: string;
  provider?: string;
  analysisNote: string;
}

export interface CsaInsightsReport {
  id: string;
  user_id: string;
  user_email: string | null;
  user_display_name: string | null;
  period_start: string;
  period_end: string;
  period_type: string;
  stats_json: {
    total_sessions?: number;
    total_prompts?: number;
    total_messages?: number;
    avg_prompt_length?: number;
    days_active?: number;
    avg_messages_per_day?: number;
    activity_breakdown?: Record<string, number>;
    models_used?: Record<string, number>;
  };
  insights_json: {
    overview?: string;
    activity_breakdown?: Record<string, number>;
    friction_points?: string[];
    recommendations?: string[];
    audit?: CsaAuditReport;
    generation_meta?: CsaGenerationMeta;
  };
  generated_at: string | null;
}

export interface CsaTeamSummary {
  active_users: number;
  total_sessions: number;
  total_messages: number;
  avg_messages_per_session: number;
  top_friction_themes: { theme: string; count: number }[];
  reports_count: number;
}

export interface CsaSessionSummary {
  id: string;
  cursor_session_id: string;
  project_name: string | null;
  model: string | null;
  started_at: string;
  ended_at: string | null;
  message_count: number;
}

export interface CsaIngestToken {
  id: string;
  label: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

async function invokeCsaReports<T>(action: string, body?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("csa-reports", {
    body: { action, ...body },
  });

  if (error) throw error;
  const result = data as { success?: boolean; data?: T; error?: string };
  if (result?.error) throw new Error(result.error);
  if (result?.success === false) throw new Error(result.error || "Request failed");
  return (result?.data ?? data) as T;
}

function withPeriod(body: Record<string, unknown>, period?: CsaDateRange) {
  if (!period) return body;
  return { ...body, period_start: period.period_start, period_end: period.period_end };
}

export async function fetchCsaReportsList(period?: CsaDateRange): Promise<{
  reports: CsaInsightsReport[];
  period_start?: string;
  period_end?: string;
}> {
  return invokeCsaReports("list", withPeriod({}, period));
}

export async function fetchCsaTeamSummary(period?: CsaDateRange): Promise<CsaTeamSummary & CsaDateRange> {
  return invokeCsaReports("team-summary", withPeriod({}, period));
}

export async function fetchCsaUserDetail(
  userId: string,
  period?: CsaDateRange,
): Promise<{
  report: CsaInsightsReport | null;
  sessions: CsaSessionSummary[];
  period_start?: string;
  period_end?: string;
}> {
  return invokeCsaReports("detail", withPeriod({ user_id: userId }, period));
}

export async function fetchCsaIngestTokens(): Promise<{ tokens: CsaIngestToken[] }> {
  return invokeCsaReports("list-tokens");
}

export async function createCsaIngestToken(label?: string): Promise<{
  token: string;
  record: CsaIngestToken;
}> {
  return invokeCsaReports("create-token", { label });
}

export async function revokeCsaIngestToken(tokenId: string): Promise<{ revoked: boolean }> {
  return invokeCsaReports("revoke-token", { token_id: tokenId });
}

export async function generateCsaInsights(
  options?: { userId?: string; period?: CsaDateRange },
): Promise<{
  generated: number;
  sessions_found?: number;
  period_start: string;
  period_end: string;
  message?: string;
}> {
  const body: Record<string, unknown> = {};
  if (options?.userId) body.user_id = options.userId;
  if (options?.period) {
    body.period_start = options.period.period_start;
    body.period_end = options.period.period_end;
  }

  const { data, error } = await supabase.functions.invoke("csa-generate-insights", { body });
  if (error) throw error;
  const result = data as {
    success?: boolean;
    data?: {
      generated: number;
      sessions_found?: number;
      period_start: string;
      period_end: string;
      message?: string;
    };
    error?: string;
  };
  if (result?.error) throw new Error(result.error);
  return (
    result?.data ??
    (data as {
      generated: number;
      sessions_found?: number;
      period_start: string;
      period_end: string;
      message?: string;
    })
  );
}
