/**
 * AI Chat Edge Function
 *
 * Simple one-shot AI chat completion. Accepts messages and returns
 * a response using the configured AI provider/model.
 *
 * Input:  { model_id?, messages: ChatMessage[] }
 * Output: { response: string, model: string, usage: { input_tokens, output_tokens } }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { chatCompletion, logUsage } from '../_shared/ai-provider-routing.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { model_id, messages, temperature, max_tokens } = await req.json()

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'messages array is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const result = await chatCompletion(
      supabaseClient,
      {
        messages,
        temperature: temperature ?? 0.7,
        max_tokens: max_tokens ?? 1000,
      },
      model_id || undefined
    )

    // Log AI usage
    await logUsage(
      supabaseClient,
      null,
      model_id || null,
      'ai-chat',
      result.input_tokens || 0,
      result.output_tokens || 0,
      0,
      0
    )

    return new Response(
      JSON.stringify({
        response: result.content,
        model: result.model,
        usage: {
          input_tokens: result.input_tokens,
          output_tokens: result.output_tokens,
        },
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
