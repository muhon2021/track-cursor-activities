import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Lightweight health check
  if (req.method === 'GET') {
    const hasKey = !!Deno.env.get('OPENAI_API_KEY')
    return new Response(
      JSON.stringify({
        ok: true,
        configured: hasKey,
        message: hasKey ? 'OPENAI_API_KEY is configured' : 'OPENAI_API_KEY is not configured',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  }

  try {
    let body;
    try {
      body = await req.json()
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const { doc_type, context, ping } = body || {};

    // Health check via POST ping
    if (ping === true) {
      const hasKey = !!Deno.env.get('OPENAI_API_KEY')
      return new Response(
        JSON.stringify({
          ok: true,
          configured: hasKey,
          message: hasKey ? 'OPENAI_API_KEY is configured' : 'OPENAI_API_KEY is not configured',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured')
    }

    if (!doc_type || !context) {
      return new Response(
        JSON.stringify({ error: 'doc_type and context are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const prompts: Record<string, string> = {
      sow: 'Generate a professional Statement of Work (SOW) document',
      nda: 'Generate a professional Non-Disclosure Agreement (NDA)',
      contract: 'Generate a professional service contract',
      proposal: 'Generate a professional project proposal',
    }

    const systemPrompt = prompts[doc_type as string] || 'Generate a professional business document'

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(context) }
        ],
        temperature: 0.5,
        max_tokens: 3000,
      }),
    })

    if (!openaiResponse.ok) {
      throw new Error('Failed to generate document')
    }

    const data = await openaiResponse.json()
    const document = data.choices[0].message.content

    return new Response(
      JSON.stringify({ document, token_usage: data.usage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    console.error('Generate business doc error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
