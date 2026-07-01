import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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
    // Parse and validate request body
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const { file_id, meeting_id, transcript: providedTranscript, ping } = requestBody || {};

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

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    if (!file_id && !meeting_id && !providedTranscript) {
      return new Response(
        JSON.stringify({ error: 'file_id, meeting_id, or transcript is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Get meeting transcript — prefer provided transcript, then file, then meeting description
    let transcript = providedTranscript || ''
    if (!transcript && file_id) {
      const { data: file } = await supabaseClient
        .from('zoom_files')
        .select('transcript_text, meeting_topic')
        .eq('id', file_id)
        .single()

      transcript = file?.transcript_text || ''
    }
    if (!transcript && meeting_id) {
      // Try meeting_transcripts table first
      const { data: transcriptRow } = await supabaseClient
        .from('meeting_transcripts')
        .select('content')
        .eq('meeting_id', meeting_id)
        .maybeSingle()

      transcript = transcriptRow?.content || ''

      // Fallback to meeting description
      if (!transcript) {
        const { data: meeting } = await supabaseClient
          .from('meetings')
          .select('description')
          .eq('id', meeting_id)
          .single()

        transcript = meeting?.description || ''
      }
    }

    if (!transcript) {
      throw new Error('No transcript found')
    }

    // Generate summary using OpenAI
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an AI assistant that creates concise meeting summaries. Extract key decisions, action items, and follow-up topics.'
          },
          {
            role: 'user',
            content: `Please analyze this meeting transcript and provide:
1. A brief executive summary (2-3 sentences)
2. Key decisions made (bullet points)
3. Action items (bullet points)
4. Follow-up topics (bullet points)

Transcript:
${transcript}

Respond in JSON format with keys: executive_summary, key_decisions, action_items, follow_up_topics`
          }
        ],
        temperature: 0.5,
        response_format: { type: "json_object" }
      }),
    })

    if (!openaiResponse.ok) {
      throw new Error('Failed to generate summary')
    }

    const data = await openaiResponse.json()
    const summary = JSON.parse(data.choices[0].message.content)

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    console.error('Generate meeting summary error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
