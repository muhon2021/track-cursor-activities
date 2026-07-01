import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { chatCompletion, getModel, logUsage, calculateCost } from '../_shared/ai-provider-routing.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // GET or ping = health check (no OpenAI call)
  if (req.method === 'GET') {
    const hasKey = !!Deno.env.get('OPENAI_API_KEY')
    return new Response(
      JSON.stringify({ ok: true, configured: hasKey, message: hasKey ? 'OpenAI configured' : 'OPENAI_API_KEY not set' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  }

  try {
    let body: Record<string, unknown> = {}
    try {
      const parsed = await req.json()
      body = parsed != null && typeof parsed === 'object' ? parsed : {}
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    if (body.ping === true) {
      const hasKey = !!Deno.env.get('OPENAI_API_KEY')
      return new Response(
        JSON.stringify({ ok: true, configured: hasKey, message: hasKey ? 'OpenAI configured' : 'OPENAI_API_KEY not set' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const message = body.message as string | undefined
    const session_id = body.session_id as string | undefined
    const user_id = body.user_id as string | null
    const model_id = body.model_id as string | undefined
    const include_history = (body.include_history ?? true) as boolean
    const max_tokens = body.max_tokens as number | undefined
    const temperature = body.temperature as number | undefined

    if (!message || !session_id) {
      return new Response(
        JSON.stringify({ error: 'message and session_id are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Get chat history
    let messages: { role: 'user' | 'assistant' | 'system'; content: string }[] = [
      { role: 'system', content: 'You are a helpful AI assistant for CollabAI platform. Be concise and helpful.' }
    ]

    if (include_history) {
      const { data: history } = await supabaseClient
        .from('ai_chat_history')
        .select('role, content')
        .eq('session_id', session_id)
        .order('created_at', { ascending: true })
        .limit(10)

      if (history) {
        messages.push(...history.map((h: any) => ({
          role: h.role as 'user' | 'assistant',
          content: h.content
        })))
      }
    }

    // Add user message
    messages.push({ role: 'user', content: message })

    // Call AI provider via routing module
    const response = await chatCompletion(
      supabaseClient,
      {
        messages,
        max_tokens: max_tokens ?? 1000,
        temperature: temperature ?? 0.7,
      },
      model_id
    )

    // Get the model for cost calculation
    const model = await getModel(supabaseClient, model_id, 'chat')
    if (!model) {
      throw new Error('Model not found')
    }

    // Calculate cost
    const cost = calculateCost(model, response.input_tokens, response.output_tokens, 0)

    // Log usage
    await logUsage(
      supabaseClient,
      user_id,
      model.id,
      'ai-chat-assistant',
      response.input_tokens,
      response.output_tokens,
      0,
      cost
    )

    // Save chat history
    if (user_id) {
      await supabaseClient.from('ai_chat_history').insert([
        { session_id, user_id, role: 'user', content: message },
        { session_id, user_id, role: 'assistant', content: response.content },
      ])
    }

    return new Response(
      JSON.stringify({
        response: response.content,
        token_usage: {
          prompt_tokens: response.input_tokens,
          completion_tokens: response.output_tokens,
          total_tokens: response.input_tokens + response.output_tokens,
        },
        model_used: response.model,
        estimated_cost: cost,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    console.error('AI chat error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
