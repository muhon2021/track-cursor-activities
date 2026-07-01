import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { chatCompletion, logUsage } from "../_shared/ai-provider-routing.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

interface OverlapRequest {
  chart_id?: string
}

interface ResponsibilityRow {
  id: string
  user_id: string | null
  role_title: string
  responsibilities: unknown
}

interface OverlapSignal {
  responsibility_a_id: string
  responsibility_b_id: string
  overlap_terms: string[]
  overlap_score: number
}

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 3)
}

function toResponsibilityList(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return []
  }
  return raw.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
}

function detectOverlaps(items: ResponsibilityRow[]): OverlapSignal[] {
  const overlaps: OverlapSignal[] = []

  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const left = items[i]
      const right = items[j]

      const leftTokens = new Set(tokenize(`${left.role_title} ${toResponsibilityList(left.responsibilities).join(" ")}`))
      const rightTokens = new Set(tokenize(`${right.role_title} ${toResponsibilityList(right.responsibilities).join(" ")}`))

      const common = [...leftTokens].filter((token) => rightTokens.has(token))
      if (common.length < 2) {
        continue
      }

      const denominator = Math.max(leftTokens.size, rightTokens.size, 1)
      const score = common.length / denominator
      if (score >= 0.2) {
        overlaps.push({
          responsibility_a_id: left.id,
          responsibility_b_id: right.id,
          overlap_terms: common.slice(0, 10),
          overlap_score: Math.round(score * 100) / 100,
        })
      }
    }
  }

  return overlaps.sort((a, b) => b.overlap_score - a.overlap_score)
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

    const payload = await req.json() as OverlapRequest
    let chartId = payload.chart_id ?? null

    if (!chartId) {
      const { data: currentChart } = await supabase
        .from("accountability_charts")
        .select("id")
        .eq("is_current", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      chartId = currentChart?.id ?? null
    }

    if (!chartId) {
      return new Response(
        JSON.stringify({ success: true, overlaps: [], summary: "No accountability chart found." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      )
    }

    const { data, error } = await supabase
      .from("accountability_responsibilities")
      .select("id, user_id, role_title, responsibilities")
      .eq("chart_id", chartId)

    if (error) {
      throw new Error(`Failed to load responsibilities: ${error.message}`)
    }

    const responsibilities = (data ?? []) as ResponsibilityRow[]
    const overlaps = detectOverlaps(responsibilities)

    let summary = "No significant overlap detected."
    if (overlaps.length > 0) {
      const ai = await chatCompletion(supabase, {
        messages: [
          {
            role: "system",
            content: "You are an EOS accountability analyst. Summarize overlap findings and propose concrete cleanup actions.",
          },
          {
            role: "user",
            content: `Responsibilities:\n${JSON.stringify(responsibilities, null, 2)}\n\nDetected overlap signals:\n${JSON.stringify(overlaps.slice(0, 15), null, 2)}\n\nProvide a concise summary and 5 prioritized actions.`,
          },
        ],
        temperature: 0.2,
        max_tokens: 1000,
      })
      summary = ai.content

      await logUsage(
        supabase,
        null,
        null,
        "accountability-overlap-analyzer",
        ai.input_tokens,
        ai.output_tokens,
        0,
        0,
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        chart_id: chartId,
        overlaps,
        summary,
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
