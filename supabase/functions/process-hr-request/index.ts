import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { chatCompletion, logUsage } from "../_shared/ai-provider-routing.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

interface HrRequestPayload {
  request_text: string
  requester_user_id: string
  assigned_to?: string
}

interface HrTriageResult {
  title: string
  summary: string
  urgency: "low" | "medium" | "high" | "urgent"
  suggested_tags: string[]
  next_actions: string[]
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

    const payload = await req.json() as HrRequestPayload
    if (!payload.request_text || !payload.requester_user_id) {
      return new Response(
        JSON.stringify({ error: "request_text and requester_user_id are required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      )
    }

    const triage = await chatCompletion(supabase, {
      messages: [
        {
          role: "system",
          content: `You are an HR operations triage assistant.
Return ONLY valid JSON:
{
  "title":"string",
  "summary":"string",
  "urgency":"low|medium|high|urgent",
  "suggested_tags":["string"],
  "next_actions":["string"]
}
Keep it concise and operational.`,
        },
        {
          role: "user",
          content: `Triage this HR request:\n${payload.request_text}`,
        },
      ],
      temperature: 0.2,
      max_tokens: 900,
    })

    let parsed: HrTriageResult = {
      title: "HR Request",
      summary: payload.request_text,
      urgency: "medium",
      suggested_tags: ["hr"],
      next_actions: ["Review request and assign owner"],
    }

    try {
      const candidate = JSON.parse(triage.content) as Partial<HrTriageResult>
      const urgency = candidate.urgency
      parsed = {
        title: typeof candidate.title === "string" ? candidate.title : parsed.title,
        summary: typeof candidate.summary === "string" ? candidate.summary : parsed.summary,
        urgency: urgency === "low" || urgency === "medium" || urgency === "high" || urgency === "urgent" ? urgency : parsed.urgency,
        suggested_tags: Array.isArray(candidate.suggested_tags)
          ? candidate.suggested_tags.filter((value): value is string => typeof value === "string")
          : parsed.suggested_tags,
        next_actions: Array.isArray(candidate.next_actions)
          ? candidate.next_actions.filter((value): value is string => typeof value === "string")
          : parsed.next_actions,
      }
    } catch {
      // Keep fallback.
    }

    const priorityMap: Record<HrTriageResult["urgency"], "low" | "medium" | "high" | "urgent"> = {
      low: "low",
      medium: "medium",
      high: "high",
      urgent: "urgent",
    }

    const { data: createdTask, error: taskError } = await supabase
      .from("tasks")
      .insert({
        title: parsed.title,
        description: `${parsed.summary}\n\nNext actions:\n- ${parsed.next_actions.join("\n- ")}`,
        status: "todo",
        priority: priorityMap[parsed.urgency],
        assigned_to: payload.assigned_to ?? null,
        created_by: payload.requester_user_id,
        tags: Array.from(new Set(["hr", ...parsed.suggested_tags])),
        metadata: {
          source: "process-hr-request",
          raw_request: payload.request_text,
          urgency: parsed.urgency,
        },
      })
      .select("id, title, priority, status, created_at")
      .single()

    if (taskError) {
      throw new Error(`Failed to create HR task: ${taskError.message}`)
    }

    await logUsage(
      supabase,
      payload.requester_user_id,
      null,
      "process-hr-request",
      triage.input_tokens,
      triage.output_tokens,
      0,
      0,
    )

    return new Response(
      JSON.stringify({
        success: true,
        triage: parsed,
        task: createdTask,
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
