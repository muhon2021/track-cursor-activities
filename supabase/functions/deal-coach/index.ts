import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { chatCompletion, getModel } from "../_shared/ai-provider-routing.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const SYSTEM_PROMPT = `You are a B2B sales coach specializing in SaaS sales to mid-market companies. Help with deal strategy, email drafts, discovery call prep, and objection handling. Use the MEDDPICC framework when analyzing deals. Be direct and practical.

When analyzing a deal, evaluate these MEDDPICC dimensions:
- **Metrics**: What quantifiable results does the buyer expect?
- **Economic Buyer**: Who controls the budget?
- **Decision Criteria**: What are the formal requirements?
- **Decision Process**: What steps will the org follow to decide?
- **Paper Process**: What is the procurement/legal process?
- **Identified Pain**: What specific pain does this solve?
- **Champion**: Who is the internal advocate?
- **Competition**: Who else is being considered?

Always provide actionable next steps.`

interface DealCoachRequest {
  deal_id: string
  question: string
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: "Supabase credentials not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 503 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    const { deal_id, question }: DealCoachRequest = await req.json()

    if (!deal_id || !question) {
      return new Response(
        JSON.stringify({ error: "deal_id and question are required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      )
    }

    // Fetch deal details
    const { data: deal, error: dealError } = await supabase
      .from("deals")
      .select("*, contacts(first_name, last_name, email, company, title), clients(name)")
      .eq("id", deal_id)
      .single()

    if (dealError || !deal) {
      return new Response(
        JSON.stringify({ error: "Deal not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      )
    }

    // Fetch recent activities
    const { data: activities } = await supabase
      .from("deal_activities")
      .select("activity_type, content, created_at")
      .eq("deal_id", deal_id)
      .order("created_at", { ascending: false })
      .limit(20)

    // Fetch recent comments
    const { data: comments } = await supabase
      .from("deal_comments")
      .select("content, created_at")
      .eq("deal_id", deal_id)
      .order("created_at", { ascending: false })
      .limit(10)

    // Build context for the AI
    const dealContext = [
      `## Deal: ${deal.title}`,
      `- Stage: ${deal.stage}`,
      `- Value: ${deal.currency || "USD"} ${deal.value || "Not set"}`,
      `- Probability: ${deal.probability || 0}%`,
      `- Expected Close: ${deal.expected_close_date || "Not set"}`,
      `- Source: ${deal.source || "Unknown"}`,
      deal.description ? `- Description: ${deal.description}` : "",
      deal.lost_reason ? `- Lost Reason: ${deal.lost_reason}` : "",
      deal.clients ? `- Client: ${deal.clients.name}` : "",
      deal.contacts ? `- Contact: ${deal.contacts.first_name} ${deal.contacts.last_name || ""} (${deal.contacts.title || "N/A"} at ${deal.contacts.company || "N/A"})` : "",
      deal.tags?.length ? `- Tags: ${deal.tags.join(", ")}` : "",
    ].filter(Boolean).join("\n")

    const activityContext = (activities || []).length > 0
      ? "\n## Recent Activities\n" + (activities || []).map(
          (a: any) => `- [${a.activity_type}] ${a.content} (${new Date(a.created_at).toLocaleDateString()})`
        ).join("\n")
      : ""

    const commentContext = (comments || []).length > 0
      ? "\n## Team Notes\n" + (comments || []).map(
          (c: any) => `- ${c.content} (${new Date(c.created_at).toLocaleDateString()})`
        ).join("\n")
      : ""

    const fullContext = `${dealContext}${activityContext}${commentContext}`

    // Get the default model
    const model = await getModel(supabase, undefined, "chat")

    if (!model) {
      return new Response(
        JSON.stringify({ error: "No AI model configured for chat" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 503 }
      )
    }

    const result = await chatCompletion(supabase, {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Here is the deal context:\n\n${fullContext}\n\n---\n\nUser question: ${question}` },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    }, model.model_id)

    // Log run to ai_agent_runs for admin Deal Coaching dashboard (deals coached, adoption)
    const { data: coachAgent } = await supabase
      .from("ai_agents")
      .select("id")
      .eq("slug", "deal-coach")
      .limit(1)
      .single()
    if (coachAgent?.id) {
      const authHeader = req.headers.get("Authorization")
      let userId: string | null = null
      if (authHeader?.startsWith("Bearer ")) {
        try {
          const token = authHeader.slice(7)
          const payload = JSON.parse(atob(token.split(".")[1] ?? "{}"))
          if (payload.sub) userId = payload.sub
        } catch {
          // ignore
        }
      }
      await supabase.from("ai_agent_runs").insert({
        agent_id: coachAgent.id,
        user_id: userId,
        status: "completed",
        input: question,
        output: result.content,
        metadata: { deal_id },
        context: { deal_id, question },
      })
    }

    return new Response(
      JSON.stringify({ response: result.content, model: model?.model_id || 'unknown' }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    )
  } catch (error: unknown) {
    console.error("Deal coach error:", error)
    const message = error instanceof Error ? error.message : "Unknown error"
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    )
  }
})
