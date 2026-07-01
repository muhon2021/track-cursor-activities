/**
 * Fetch Zoom Transcript Edge Function
 *
 * Fetches a recording's transcript from the Zoom API, parses the VTT format
 * into structured speaker turns, stores it on the meetings row, and then
 * triggers AI action-item extraction.
 *
 * Input:  { meetingId: string, zoomRecordingId: string }
 * Output: { success: true } | { error: string }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ---------------------------------------------------------------------------
// VTT parser
// ---------------------------------------------------------------------------

interface TranscriptTurn {
  timestamp: string;
  speaker?: string;
  text: string;
}

function parseVTT(vttContent: string): TranscriptTurn[] {
  const lines = vttContent.split("\n");
  const turns: TranscriptTurn[] = [];
  let current: TranscriptTurn | null = null;

  for (const raw of lines) {
    const line = raw.trim();

    if (!line || line.startsWith("WEBVTT") || line.startsWith("NOTE")) {
      continue;
    }

    // Timestamp line: 00:00:01.234 --> 00:00:05.678
    if (line.includes("-->")) {
      const startStr = line.split("-->")[0].trim();
      current = { timestamp: startStr, text: "" };
      turns.push(current);
      continue;
    }

    // Skip cue identifier lines (pure digits)
    if (/^\d+$/.test(line)) {
      continue;
    }

    if (current) {
      // "Speaker Name: text" format used by Zoom VTT
      const speakerMatch = line.match(/^(.+?):\s+(.+)$/);
      if (speakerMatch) {
        current.speaker = speakerMatch[1].trim();
        current.text += (current.text ? " " : "") + speakerMatch[2].trim();
      } else {
        current.text += (current.text ? " " : "") + line;
      }
    }
  }

  return turns.filter((t) => t.text.trim().length > 0);
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(supabaseUrl, supabaseKey);

  let meetingId: string | undefined;

  try {
    const body = await req.json();
    meetingId = body.meetingId as string;
    const zoomRecordingId = body.zoomRecordingId as string;

    if (!meetingId || !zoomRecordingId) {
      return new Response(
        JSON.stringify({ error: "meetingId and zoomRecordingId are required" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Retrieve the Zoom OAuth token (user-level token stored by the integration)
    const { data: tokenRow, error: tokenError } = await supabase
      .from("user_oauth_tokens")
      .select("access_token")
      .eq("provider_slug", "zoom")
      .eq("is_active", true)
      .maybeSingle();

    if (tokenError || !tokenRow?.access_token) {
      throw new Error("Zoom not connected – please reconnect the Zoom integration");
    }

    // Mark transcript as processing
    await supabase
      .from("meetings")
      .update({
        transcript_status: "processing",
        transcript_processing_started_at: new Date().toISOString(),
        transcript_error: null,
      })
      .eq("id", meetingId);

    // Fetch recording metadata from Zoom API
    const recordingRes = await fetch(
      `https://api.zoom.us/v2/recordings/${zoomRecordingId}`,
      { headers: { Authorization: `Bearer ${tokenRow.access_token}` } }
    );

    if (!recordingRes.ok) {
      const errText = await recordingRes.text();
      throw new Error(`Zoom API error ${recordingRes.status}: ${errText}`);
    }

    const recordingData = await recordingRes.json();

    // Zoom stores the VTT transcript as a recording_file with file_type "TRANSCRIPT"
    const transcriptFile = (recordingData.recording_files ?? []).find(
      (f: { file_type: string }) => f.file_type === "TRANSCRIPT"
    );

    if (!transcriptFile?.download_url) {
      throw new Error("No transcript file found in this Zoom recording");
    }

    // Download the VTT content
    const vttRes = await fetch(transcriptFile.download_url, {
      headers: { Authorization: `Bearer ${tokenRow.access_token}` },
    });

    if (!vttRes.ok) {
      throw new Error(`Failed to download VTT: ${vttRes.statusText}`);
    }

    const vttContent = await vttRes.text();
    const turns = parseVTT(vttContent);
    const plainText = turns.map((t) => `${t.speaker ? t.speaker + ": " : ""}${t.text}`).join("\n");

    // Persist transcript to the meetings row
    await supabase
      .from("meetings")
      .update({
        transcript_status: "complete",
        transcript_content: plainText,
        transcript_raw: turns,
        transcript_fetched_at: new Date().toISOString(),
        transcript_error: null,
      })
      .eq("id", meetingId);

    // Fire-and-forget: trigger AI action-item extraction
    fetch(`${supabaseUrl}/functions/v1/extract-meeting-action-items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ meetingId }),
    }).catch(() => {
      // Non-critical – extraction can be retried later
    });

    return new Response(
      JSON.stringify({ success: true, message: "Transcript fetched and stored" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[fetch-zoom-transcript]", message);

    // Record the failure on the meeting row
    if (meetingId) {
      try {
        await supabase
          .from("meetings")
          .update({ transcript_status: "failed", transcript_error: message })
          .eq("id", meetingId);
      } catch (_) {
        // best-effort update
      }
    }

    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
