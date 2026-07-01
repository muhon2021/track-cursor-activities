/**
 * CSA ingest — capture Cursor hook events into csa_* tables
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireEnvVars } from "../_shared/env-validator.ts";
import {
  checkRateLimit,
  countWords,
  sha256,
  truncateText,
  type IngestBody,
} from "./_helpers.ts";

function jsonResponse(body: Record<string, unknown>, corsHeaders: Record<string, string>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = {
    ...getCorsHeaders(origin),
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-csa-ingest-token",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed" }, corsHeaders, 405);
  }

  try {
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = requireEnvVars([
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
    ]);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const ingestToken = req.headers.get("x-csa-ingest-token")?.trim();
    if (!ingestToken) {
      return jsonResponse({ success: false, error: "Missing x-csa-ingest-token" }, corsHeaders, 401);
    }

    const tokenHash = await sha256(ingestToken);
    const { data: tokenRow, error: tokenErr } = await supabase
      .from("csa_ingest_tokens")
      .select("id, user_id, revoked_at")
      .eq("token_hash", tokenHash)
      .is("revoked_at", null)
      .maybeSingle();

    if (tokenErr || !tokenRow) {
      return jsonResponse({ success: false, error: "Invalid ingest token" }, corsHeaders, 401);
    }

    if (!checkRateLimit(tokenRow.id)) {
      return jsonResponse({ success: false, error: "Rate limit exceeded" }, corsHeaders, 429);
    }

    const body = (await req.json().catch(() => ({}))) as IngestBody;
    if (!body.event || !body.cursor_session_id) {
      return jsonResponse({ success: false, error: "event and cursor_session_id are required" }, corsHeaders, 400);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", tokenRow.user_id)
      .maybeSingle();

    const userEmail = body.user_email || profile?.email || null;
    const ts = body.timestamp ? new Date(body.timestamp).toISOString() : new Date().toISOString();

    const { data: existingSession } = await supabase
      .from("csa_sessions")
      .select("id, message_count")
      .eq("user_id", tokenRow.user_id)
      .eq("cursor_session_id", body.cursor_session_id)
      .maybeSingle();

    let sessionId = existingSession?.id;

    if (!sessionId && body.event === "session_end") {
      return jsonResponse({ success: true, skipped: true, reason: "session_not_found" });
    }

    if (!sessionId) {
      const { data: newSession, error: insertErr } = await supabase
        .from("csa_sessions")
        .insert({
          user_id: tokenRow.user_id,
          user_email: userEmail,
          cursor_session_id: body.cursor_session_id,
          workspace_path: body.workspace_path || null,
          project_name: body.project_name || null,
          model: body.response?.model || null,
          started_at: ts,
          message_count: 0,
          metadata: { client_type: "cursor" },
        })
        .select("id")
        .single();

      if (insertErr) return jsonResponse({ success: false, error: insertErr.message }, corsHeaders, 500);
      sessionId = newSession.id;
    } else if (body.event === "session_end") {
      await supabase.from("csa_sessions").update({ ended_at: ts }).eq("id", sessionId);
    } else {
      await supabase
        .from("csa_sessions")
        .update({
          workspace_path: body.workspace_path || undefined,
          project_name: body.project_name || undefined,
          model: body.response?.model || undefined,
        })
        .eq("id", sessionId);
    }

    if (body.event === "prompt" && body.prompt?.text) {
      const { text, truncated } = truncateText(body.prompt.text);
      const contentHash = await sha256(text);
      const generationId = body.prompt.generation_id?.trim() || null;

      if (generationId) {
        const { data: byGeneration } = await supabase
          .from("csa_messages")
          .select("id")
          .eq("session_id", sessionId)
          .eq("role", "user")
          .eq("metadata->>generation_id", generationId)
          .maybeSingle();

        if (byGeneration) {
          return jsonResponse({ success: true, skipped: true, reason: "duplicate_generation_id" });
        }
      } else {
        const dedupeSince = new Date(Date.now() - 60_000).toISOString();
        const { data: byHash } = await supabase
          .from("csa_messages")
          .select("id")
          .eq("session_id", sessionId)
          .eq("role", "user")
          .eq("content_hash", contentHash)
          .gte("created_at", dedupeSince)
          .maybeSingle();

        if (byHash) {
          return jsonResponse({ success: true, skipped: true, reason: "duplicate_prompt" });
        }
      }

      await supabase.from("csa_messages").insert({
        session_id: sessionId,
        user_id: tokenRow.user_id,
        role: "user",
        content: text,
        content_hash: contentHash,
        content_length: text.length,
        metadata: {
          truncated,
          word_count: countWords(text),
          generation_id: generationId,
          model: body.prompt.model || null,
          model_id: body.prompt.model_id || null,
          model_params: body.prompt.model_params || null,
          composer_mode: body.prompt.composer_mode || null,
        },
        created_at: ts,
      });

      const { data: sessionRow } = await supabase
        .from("csa_sessions")
        .select("message_count")
        .eq("id", sessionId)
        .single();

      await supabase
        .from("csa_sessions")
        .update({ message_count: (sessionRow?.message_count || 0) + 1 })
        .eq("id", sessionId);
    }

    if (body.event === "response") {
      const length = body.response?.text_length || 0;
      const contentHash = await sha256(`response-${sessionId}-${ts}-${length}`);

      await supabase.from("csa_messages").insert({
        session_id: sessionId,
        user_id: tokenRow.user_id,
        role: "assistant",
        content: null,
        content_hash: contentHash,
        content_length: length,
        metadata: {
          model: body.response?.model,
          tool_calls: body.response?.tool_calls,
          latency_ms: body.response?.latency_ms,
        },
        created_at: ts,
      });
    }

    await supabase
      .from("csa_ingest_tokens")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", tokenRow.id);

    return jsonResponse({ success: true, session_id: sessionId });
  } catch (err) {
    return jsonResponse(
      { success: false, error: err instanceof Error ? err.message : "Internal error" },
      getCorsHeaders(req.headers.get("origin")),
      500,
    );
  }
});
