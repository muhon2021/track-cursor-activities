import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ConversationOpenerRequest {
  contact_id: string
}

interface AIMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

async function callAIProvider(
  messages: AIMessage[],
  apiKey: string,
  provider: string = 'gemini'
): Promise<string> {
  if (provider === 'gemini') {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: messages.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
          })),
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 1000,
          }
        })
      }
    )

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`)
    }

    const data = await response.json()
    return data.candidates[0].content.parts[0].text
  } else if (provider === 'openai') {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages,
        temperature: 0.8,
        max_tokens: 1000,
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = await response.json()
    return data.choices[0].message.content
  }

  throw new Error('Unknown AI provider')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body: ConversationOpenerRequest = await req.json()
    const { contact_id } = body

    if (!contact_id) {
      return new Response(
        JSON.stringify({ error: 'contact_id is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const googleAiKey = Deno.env.get('GOOGLE_AI_API_KEY')
    const openaiKey = Deno.env.get('OPENAI_API_KEY')

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: 'Supabase not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 503 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Fetch contact details
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', contact_id)
      .single()

    if (contactError || !contact) {
      return new Response(
        JSON.stringify({ error: 'Contact not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // Fetch recent activities (last 10)
    const { data: activities } = await supabase
      .from('contact_activities')
      .select('*')
      .eq('contact_id', contact_id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(10)

    // Fetch latest mood and intent analysis
    const { data: moodAnalysis } = await supabase
      .from('lead_mood_analysis')
      .select('*')
      .eq('contact_id', contact_id)
      .order('analyzed_at', { ascending: false })
      .limit(1)
      .single()

    const { data: intentAnalysis } = await supabase
      .from('lead_intent_analysis')
      .select('*')
      .eq('contact_id', contact_id)
      .order('analyzed_at', { ascending: false })
      .limit(1)
      .single()

    // Fetch client details if available
    let clientInfo = ''
    if (contact.client_id) {
      const { data: client } = await supabase
        .from('clients')
        .select('name, industry')
        .eq('id', contact.client_id)
        .single()

      if (client) {
        clientInfo = `Client: ${client.name} (${client.industry})\n`
      }
    }

    // Build context for AI
    const context = `
Contact Information:
- Name: ${contact.first_name} ${contact.last_name || ''}
- Title: ${contact.title || 'Unknown'}
- Company: ${contact.company || 'Unknown'}
- Email: ${contact.email}
${clientInfo}

Mood Analysis: ${moodAnalysis?.mood_label || 'Unknown'} (Score: ${moodAnalysis?.mood_score || 0}/100)
Intent Status: ${intentAnalysis?.intent_status || 'Unknown'}

Recent Activities:
${activities?.map(a => `- ${a.activity_type}: ${a.description?.substring(0, 100)}`).join('\n') || 'No recent activities'}

Generate 3-5 compelling, personalized conversation openers for this contact. Each opener should:
1. Be natural and not sound like a sales pitch
2. Reference specific context or recent activity
3. Demonstrate genuine interest in their situation
4. Include a soft call-to-action

Return as JSON array with objects containing: { opener: string, context: string, tone: 'professional' | 'friendly' | 'casual' }
`

    const messages: AIMessage[] = [
      {
        role: 'system',
        content: 'You are an expert sales conversation strategist. Generate natural, personalized conversation openers based on contact intelligence.'
      },
      {
        role: 'user',
        content: context
      }
    ]

    let openerResponse = ''
    let provider = 'gemini'

    // Try Gemini first, fallback to OpenAI
    if (googleAiKey) {
      try {
        openerResponse = await callAIProvider(messages, googleAiKey, 'gemini')
      } catch (error) {
        console.error('Gemini error:', error)
        if (!openaiKey) throw error
        provider = 'openai'
      }
    }

    if (!openerResponse && openaiKey) {
      openerResponse = await callAIProvider(messages, openaiKey, 'openai')
    }

    if (!openerResponse) {
      throw new Error('No AI provider available')
    }

    // Parse AI response
    let openers = []
    try {
      // Try to extract JSON from response
      const jsonMatch = openerResponse.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        openers = JSON.parse(jsonMatch[0])
      } else {
        // Fallback: create a single opener from the response
        openers = [
          {
            opener: openerResponse.substring(0, 200),
            context: 'Generated from contact intelligence',
            tone: 'professional'
          }
        ]
      }
    } catch (parseError) {
      openers = [
        {
          opener: openerResponse,
          context: 'Generated from contact intelligence',
          tone: 'professional'
        }
      ]
    }

    return new Response(
      JSON.stringify({
        success: true,
        openers,
        generated_at: new Date().toISOString(),
        provider
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    console.error('Conversation opener error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
