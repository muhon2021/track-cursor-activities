import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { chatCompletion, logUsage } from "../_shared/ai-provider-routing.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

interface GenerateEmailDraftRequest {
  deal_id: string
  intent?: "regular" | "sales" | "upsell" | "reengage" | "thank_you"
  tone?: "professional" | "friendly" | "direct"
  max_words?: number
  extra_context?: string
}

interface EmailDraftResponse {
  subject: string
  body: string
  cta: string
}

function buildIntentGuidance(intent: GenerateEmailDraftRequest["intent"]): string {
  switch (intent) {
    case "upsell":
      return "Focus on additional value and next-step expansion opportunities."
    case "reengage":
      return "Acknowledge the gap since last touch and restart momentum with one easy next step."
    case "thank_you":
      return "Lead with gratitude and reinforce key takeaways with clear follow-up."
    case "sales":
      return "Emphasize business outcomes and urgency with a consultative tone."
    default:
      return "Keep it balanced, clear, and action-oriented."
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    )

    const payload = await req.json() as GenerateEmailDraftRequest
    if (!payload.deal_id) {
      return new Response(
        JSON.stringify({ error: "deal_id is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      )
    }

    const { data: deal, error: dealError } = await supabase
      .from("deals")
      .select("*, clients(*), contacts(*)")
      .eq("id", payload.deal_id)
      .single()

    if (dealError || !deal) {
      return new Response(
        JSON.stringify({ error: "Deal not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 },
      )
    }

    const { data: activities } = await supabase
      .from("deal_activities")
      .select("activity_type, content, created_at")
      .eq("deal_id", payload.deal_id)
      .order("created_at", { ascending: false })
      .limit(15)

    const maxWords = typeof payload.max_words === "number" && payload.max_words > 50 && payload.max_words <= 350
      ? Math.floor(payload.max_words)
      : 220

    const contextText = [
      `Deal title: ${String(deal.title ?? "N/A")}`,
      `Deal stage: ${String(deal.stage ?? "N/A")}`,
      `Deal value: ${String(deal.value ?? "N/A")} ${String(deal.currency ?? "")}`,
      `Client name: ${String(deal.clients?.name ?? "N/A")}`,
      `Contact: ${String(deal.contacts?.first_name ?? "")} ${String(deal.contacts?.last_name ?? "")}`.trim(),
      `Contact role: ${String(deal.contacts?.title ?? "N/A")}`,
      `Description: ${String(deal.description ?? "N/A")}`,
      `Recent activities:\n${(activities ?? []).map((activity: Record<string, unknown>) => `- [${String(activity.activity_type ?? "note")}] ${String(activity.content ?? "")}`).join("\n")}`,
      payload.extra_context ? `Additional user context: ${payload.extra_context}` : null,
    ].filter((item): item is string => Boolean(item)).join("\n")

    const result = await chatCompletion(supabase, {
      messages: [
        {
          role: "system",
          content: `You are a high-performing B2B sales email assistant.
Write concise, personalized emails with a clear CTA.
Return ONLY valid JSON:
{
  "subject": "string",
  "body": "string",
  "cta": "string"
}
Constraints:
- Tone: ${payload.tone ?? "professional"}
- Word limit: ${maxWords}
- Intent guidance: ${buildIntentGuidance(payload.intent)}
- Keep claims factual and grounded in provided context.`,
        },
        {
          role: "user",
          content: `Generate an email draft from this context:\n\n${contextText}`,
        },
      ],
      temperature: 0.6,
      max_tokens: 1200,
    })

    let parsed: EmailDraftResponse = {
      subject: "Following up",
      body: result.content,
      cta: "Would you be open to a short follow-up this week?",
    }

    try {
      const value = JSON.parse(result.content) as Partial<EmailDraftResponse>
      parsed = {
        subject: typeof value.subject === "string" ? value.subject : parsed.subject,
        body: typeof value.body === "string" ? value.body : parsed.body,
        cta: typeof value.cta === "string" ? value.cta : parsed.cta,
      }
    } catch {
      // Keep fallback response.
    }

    await logUsage(
      supabase,
      null,
      null,
      "generate-email-draft",
      result.input_tokens,
      result.output_tokens,
      0,
      0,
    )

    return new Response(
      JSON.stringify({
        success: true,
        deal_id: payload.deal_id,
        draft: parsed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    )
  }
})
