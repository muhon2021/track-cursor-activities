import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ResearchRequest {
  contact_name: string
  contact_id?: string
  days_back?: number
  contact_email?: string
  contact_company?: string
}

interface PerplexityMessage {
  role: 'user' | 'assistant'
  content: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body: ResearchRequest = await req.json()
    const { contact_name, contact_id, days_back = 30, contact_email, contact_company } = body

    const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY')
    if (!PERPLEXITY_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'PERPLEXITY_API_KEY not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 503 }
      )
    }

    // Build search query
    let searchQuery = `Recent LinkedIn activity and professional updates for ${contact_name}`
    if (contact_company) {
      searchQuery += ` at ${contact_company}`
    }
    searchQuery += ` in the last ${days_back} days`

    const messages: PerplexityMessage[] = [
      {
        role: 'user',
        content: `Research the LinkedIn profile and recent professional activity for: ${contact_name}${contact_email ? ` (${contact_email})` : ''}${contact_company ? ` at ${contact_company}` : ''}. Look for: recent job changes, promotions, company news, team updates, and recent posts or engagement. Return findings in a structured format.`
      }
    ]

    const response = await fetch('https://api.perplexity.ai/openai/deployments/sonar/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: messages,
        max_tokens: 2000,
        temperature: 0.2,
        top_p: 0.9,
      })
    })

    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.status}`)
    }

    const data = await response.json()
    const researchSummary = data.choices?.[0]?.message?.content || 'No research found'

    // If contact_id provided, save research to database
    if (contact_id) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey)

        await supabase.from('contact_activities').insert({
          contact_id,
          activity_type: 'linkedin_research',
          channel: 'linkedin',
          direction: 'internal',
          description: researchSummary,
          created_by: (await supabase.auth.admin.listUsers()).data.users[0]?.id,
          metadata: {
            research_source: 'perplexity',
            days_back,
          }
        })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        research: {
          summary: researchSummary,
          contact_name,
          contact_email,
          contact_company,
          research_date: new Date().toISOString(),
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    console.error('Research error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
