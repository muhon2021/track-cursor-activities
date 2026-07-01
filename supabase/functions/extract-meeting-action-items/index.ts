/**
 * Extract Meeting Action Items Edge Function
 *
 * Uses the configured AI provider to extract action items from a meeting
 * transcript and inserts them into the meeting_action_items table.
 *
 * Input:  { meetingId: string, transcript?: string }
 * Output: { success: true, count: number } | { error: string }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { chatCompletion } from "../_shared/ai-provider-routing.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ExtractedItem {
  text: string;
  assignee_email?: string | null;
  due_date?: string | null;
  priority?: "high" | "medium" | "low";
  extraction_confidence?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { meetingId, transcript: providedTranscript } = await req.json();

    if (!meetingId) {
      return new Response(
        JSON.stringify({ error: "meetingId is required" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Resolve transcript text: prefer caller-provided, then DB
    let transcript: string = providedTranscript ?? "";

    if (!transcript) {
      // Try transcript_content on the meetings row first
      const { data: meeting } = await supabase
        .from("meetings")
        .select("transcript_content, description")
        .eq("id", meetingId)
        .single();

      transcript = meeting?.transcript_content ?? meeting?.description ?? "";
    }

    if (!transcript.trim()) {
      return new Response(
        JSON.stringify({ success: true, count: 0, message: "No transcript content found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Truncate to a safe context size (~40 k chars ≈ ~10 k tokens)
    const MAX_CHARS = 40_000;
    const truncated = transcript.length > MAX_CHARS
      ? transcript.slice(0, MAX_CHARS) + "\n\n[transcript truncated]"
      : transcript;

    // Extract action items via the shared AI routing layer
    const aiResponse = await chatCompletion(supabase, {
      messages: [
        {
          role: "system",
          content: `You are an expert meeting analyst. Extract every concrete action item from the meeting transcript.

For each action item return a JSON object with these fields:
- text (string, required): Clear description of the task to be done
- assignee_email (string|null): Email address of the person responsible, if mentioned
- due_date (string|null): Due date in ISO format "YYYY-MM-DD", if mentioned
- priority ("high"|"medium"|"low"): Inferred priority (default "medium")
- extraction_confidence (number 0.0-1.0): How confident you are this is an action item

Return ONLY a valid JSON array, no prose, no markdown fences.`,
        },
        {
          role: "user",
          content: `Extract action items from this meeting transcript:\n\n${truncated}`,
        },
      ],
    });

    // Parse the AI response
    let items: ExtractedItem[] = [];
    try {
      const raw = typeof aiResponse === "string" ? aiResponse : aiResponse?.content ?? "[]";
      // Strip any accidental markdown code fences
      const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
      items = JSON.parse(cleaned);
      if (!Array.isArray(items)) items = [];
    } catch {
      console.warn("[extract-meeting-action-items] Failed to parse AI response as JSON");
      items = [];
    }

    if (items.length === 0) {
      return new Response(
        JSON.stringify({ success: true, count: 0, message: "No action items found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Validate priority values before insert
    const validPriorities = new Set(["high", "medium", "low"]);

    const rows = items
      .filter((item) => item.text?.trim())
      .map((item) => ({
        meeting_id: meetingId,
        text: item.text.trim(),
        assignee_email: item.assignee_email || null,
        due_date: item.due_date || null,
        priority: validPriorities.has(item.priority ?? "") ? item.priority : "medium",
        extraction_confidence:
          typeof item.extraction_confidence === "number"
            ? Math.min(1, Math.max(0, item.extraction_confidence))
            : 0.8,
        extracted_from_transcript: true,
        status: "pending",
      }));

    const { error: insertError } = await supabase
      .from("meeting_action_items")
      .insert(rows);

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({ success: true, count: rows.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[extract-meeting-action-items]", message);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
