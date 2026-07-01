/**
 * analyze-okr-progress
 *
 * Provides AI-assisted OKR health analysis with deterministic fallback logic.
 * Returns both the target contract fields and diagnostic notes for UI/admin use.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { chatCompletion, logUsage } from "../_shared/ai-provider-routing.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type HealthStatus = "on_track" | "medium_risk" | "high_risk";

function computeDeterministicHealth(progress: number, daysLeft: number): {
  health_status: HealthStatus;
  health_score: number;
  risk_factors: string[];
  recommendations: string[];
  confidence: number;
} {
  const riskFactors: string[] = [];
  const recommendations: string[] = [];

  if (progress < 40 && daysLeft < 30) {
    riskFactors.push("Low progress with limited time remaining");
    recommendations.push("Re-scope key results and assign weekly checkpoints");
  }
  if (progress < 20 && daysLeft < 14) {
    riskFactors.push("Critical progress delay near deadline");
    recommendations.push("Escalate blockers and shift owner focus to highest-impact KRs");
  }
  if (progress >= 70 && daysLeft > 20) {
    recommendations.push("Maintain current execution rhythm and validate outcome quality");
  }

  let health_status: HealthStatus = "on_track";
  if (progress < 30 || (progress < 50 && daysLeft < 30)) health_status = "high_risk";
  else if (progress < 60) health_status = "medium_risk";

  const base = progress / 100;
  const timePressurePenalty = daysLeft < 0 ? 0.4 : daysLeft < 14 ? 0.2 : daysLeft < 30 ? 0.1 : 0;
  const health_score = Math.max(0, Math.min(1, Number((base - timePressurePenalty).toFixed(2))));

  return {
    health_status,
    health_score,
    risk_factors: riskFactors,
    recommendations,
    confidence: 0.65,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { okr_id, include_recommendations = true } = await req.json();
    if (!okr_id) {
      return new Response(JSON.stringify({ success: false, error: "okr_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: okr, error: okrError } = await supabaseClient
      .from("okrs")
      .select("id,title,description,status,progress,quarter,end_date")
      .eq("id", okr_id)
      .single();

    if (okrError || !okr) throw okrError || new Error("OKR not found");

    const { data: keyResults } = await supabaseClient
      .from("okr_key_results")
      .select("title,current_value,target_value,start_value,status,updated_at")
      .eq("okr_id", okr_id)
      .order("updated_at", { ascending: false });

    const progress = Number(okr.progress || 0);
    const dueDate = okr.end_date ? new Date(okr.end_date) : null;
    const daysLeft = dueDate ? Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 30;

    const deterministic = computeDeterministicHealth(progress, daysLeft);

    let aiNotes = "Deterministic analysis applied.";
    let aiRecommendations = deterministic.recommendations;
    let aiConfidence = deterministic.confidence;
    let aiRiskFactors = deterministic.risk_factors;
    let aiHealthStatus = deterministic.health_status;
    let aiHealthScore = deterministic.health_score;

    try {
      const aiResult = await chatCompletion(supabaseClient, {
        temperature: 0.2,
        max_tokens: 1200,
        messages: [
          {
            role: "system",
            content:
              "You are an OKR operations analyst. Respond ONLY as JSON with keys: health_status(on_track|medium_risk|high_risk), health_score(0..1), risk_factors(string[]), recommendations(string[]), confidence(0..1), ai_notes(string).",
          },
          {
            role: "user",
            content: JSON.stringify({
              okr,
              key_results: keyResults || [],
              deterministic,
              include_recommendations,
            }),
          },
        ],
      });

      const parsed = JSON.parse(aiResult.content || "{}");
      if (parsed && parsed.health_status && parsed.health_score !== undefined) {
        aiHealthStatus = parsed.health_status;
        aiHealthScore = Number(parsed.health_score);
        aiRiskFactors = Array.isArray(parsed.risk_factors) ? parsed.risk_factors : aiRiskFactors;
        aiRecommendations = Array.isArray(parsed.recommendations) ? parsed.recommendations : aiRecommendations;
        aiConfidence = Number(parsed.confidence ?? aiConfidence);
        aiNotes = String(parsed.ai_notes || "AI analysis completed.");
      }

      await logUsage(
        supabaseClient,
        null,
        null,
        "analyze-okr-progress",
        aiResult.input_tokens || 0,
        aiResult.output_tokens || 0,
        0,
        0,
      );
    } catch (aiError) {
      console.warn("AI analysis fallback triggered", aiError);
    }

    const responseBody = {
      success: true,
      health_status: aiHealthStatus,
      health_score: Number(Math.max(0, Math.min(1, aiHealthScore)).toFixed(2)),
      risk_factors: aiRiskFactors,
      recommendations: include_recommendations ? aiRecommendations : [],
      confidence: Number(Math.max(0, Math.min(1, aiConfidence)).toFixed(2)),
      ai_notes: aiNotes,
    };

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("analyze-okr-progress error", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
