import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { jsPDF } from "https://esm.sh/jspdf@2.5.2"
import { chatCompletion, logUsage } from "../_shared/ai-provider-routing.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

interface GenerateSowRequest {
  deal_id?: string
  client_id?: string
  project_id?: string
  custom_scope?: string
}

interface SowPayload {
  title: string
  executive_summary: string
  scope: string[]
  deliverables: string[]
  timeline: string[]
  assumptions: string[]
  acceptance_criteria: string[]
}

function toBase64Pdf(payload: SowPayload): string {
  const pdf = new jsPDF({ unit: "pt", format: "a4" })
  const marginLeft = 48
  const pageWidth = 595
  const usableWidth = pageWidth - marginLeft * 2
  let y = 48

  const writeHeading = (text: string): void => {
    if (y > 760) {
      pdf.addPage()
      y = 48
    }
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(14)
    pdf.text(text, marginLeft, y)
    y += 18
  }

  const writeBody = (text: string): void => {
    const lines = pdf.splitTextToSize(text, usableWidth)
    if (y + lines.length * 14 > 780) {
      pdf.addPage()
      y = 48
    }
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(11)
    pdf.text(lines, marginLeft, y)
    y += lines.length * 14 + 8
  }

  writeHeading(payload.title)
  writeBody(payload.executive_summary)

  writeHeading("Scope")
  for (const item of payload.scope) {
    writeBody(`- ${item}`)
  }

  writeHeading("Deliverables")
  for (const item of payload.deliverables) {
    writeBody(`- ${item}`)
  }

  writeHeading("Timeline")
  for (const item of payload.timeline) {
    writeBody(`- ${item}`)
  }

  writeHeading("Assumptions")
  for (const item of payload.assumptions) {
    writeBody(`- ${item}`)
  }

  writeHeading("Acceptance Criteria")
  for (const item of payload.acceptance_criteria) {
    writeBody(`- ${item}`)
  }

  return pdf.output("datauristring").split(",")[1] ?? ""
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

    const payload = await req.json() as GenerateSowRequest
    if (!payload.deal_id && !payload.client_id && !payload.project_id && !payload.custom_scope) {
      return new Response(
        JSON.stringify({ error: "Provide at least one of deal_id, client_id, project_id, or custom_scope" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      )
    }

    const dealPromise = payload.deal_id
      ? supabase.from("deals").select("*, clients(*), contacts(*)").eq("id", payload.deal_id).maybeSingle()
      : Promise.resolve({ data: null, error: null })

    const projectPromise = payload.project_id
      ? supabase.from("projects").select("*").eq("id", payload.project_id).maybeSingle()
      : Promise.resolve({ data: null, error: null })

    const clientPromise = payload.client_id
      ? supabase.from("clients").select("*").eq("id", payload.client_id).maybeSingle()
      : Promise.resolve({ data: null, error: null })

    const [dealResult, projectResult, clientResult] = await Promise.all([dealPromise, projectPromise, clientPromise])

    const context = [
      dealResult.data ? `Deal: ${JSON.stringify(dealResult.data, null, 2)}` : null,
      projectResult.data ? `Project: ${JSON.stringify(projectResult.data, null, 2)}` : null,
      clientResult.data ? `Client: ${JSON.stringify(clientResult.data, null, 2)}` : null,
      payload.custom_scope ? `Custom scope: ${payload.custom_scope}` : null,
    ].filter((item): item is string => Boolean(item)).join("\n\n")

    const ai = await chatCompletion(supabase, {
      messages: [
        {
          role: "system",
          content: `You are a solutions architect writing statements of work.
Return ONLY JSON with this exact structure:
{
  "title":"string",
  "executive_summary":"string",
  "scope":["string"],
  "deliverables":["string"],
  "timeline":["string"],
  "assumptions":["string"],
  "acceptance_criteria":["string"]
}
Keep content specific and implementation-oriented.`,
        },
        {
          role: "user",
          content: `Generate a statement of work from this context:\n\n${context}`,
        },
      ],
      temperature: 0.35,
      max_tokens: 2600,
    })

    let sow: SowPayload = {
      title: "Statement of Work",
      executive_summary: ai.content,
      scope: [],
      deliverables: [],
      timeline: [],
      assumptions: [],
      acceptance_criteria: [],
    }

    try {
      const parsed = JSON.parse(ai.content) as Partial<SowPayload>
      sow = {
        title: typeof parsed.title === "string" ? parsed.title : sow.title,
        executive_summary: typeof parsed.executive_summary === "string" ? parsed.executive_summary : sow.executive_summary,
        scope: Array.isArray(parsed.scope) ? parsed.scope.filter((item): item is string => typeof item === "string") : [],
        deliverables: Array.isArray(parsed.deliverables) ? parsed.deliverables.filter((item): item is string => typeof item === "string") : [],
        timeline: Array.isArray(parsed.timeline) ? parsed.timeline.filter((item): item is string => typeof item === "string") : [],
        assumptions: Array.isArray(parsed.assumptions) ? parsed.assumptions.filter((item): item is string => typeof item === "string") : [],
        acceptance_criteria: Array.isArray(parsed.acceptance_criteria) ? parsed.acceptance_criteria.filter((item): item is string => typeof item === "string") : [],
      }
    } catch {
      // Keep fallback object.
    }

    const pdfBase64 = toBase64Pdf(sow)

    await logUsage(
      supabase,
      null,
      null,
      "generate-sow",
      ai.input_tokens,
      ai.output_tokens,
      0,
      0,
    )

    return new Response(
      JSON.stringify({
        success: true,
        sow,
        pdf_base64: pdfBase64,
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
