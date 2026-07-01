import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

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

    const { meeting_id, meeting_title, meeting_description } = requestBody;
    console.log('Categorizing meeting:', { meeting_id, meeting_title });

    if (!meeting_id) {
      console.error('Missing meeting_id in request:', requestBody);
      return new Response(
        JSON.stringify({
          error: 'meeting_id is required',
          received: { meeting_id, meeting_title, meeting_description }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Build content for categorization
    let content = '';
    if (meeting_title) content += `Title: ${meeting_title}\n`;
    if (meeting_description) content += `Description: ${meeting_description}\n`;

    // If no title/description provided, fetch from database
    if (!content.trim()) {
      const { data: meeting, error } = await supabaseClient
        .from('meetings')
        .select('title, description')
        .eq('id', meeting_id)
        .single();

      if (error) {
        console.error('Error fetching meeting:', error);
        throw new Error('Meeting not found');
      }

      content = `Title: ${meeting.title || 'Untitled'}\nDescription: ${meeting.description || 'No description'}`;
    }

    console.log('Content for categorization:', content);

    // Categorize using OpenAI
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
            content: `You are a meeting categorization assistant. Categorize meetings into one of these categories:
- client_meeting: External meetings with clients or customers
- internal_meeting: Team or company internal meetings
- planning: Sprint planning, project planning, roadmap discussions
- review: Code reviews, performance reviews, retrospectives
- standup: Daily standups, quick sync meetings
- interview: Job interviews, candidate screenings
- training: Training sessions, workshops, onboarding
- other: Anything that doesn't fit above categories

Respond with a JSON object containing:
- category: one of the categories above
- confidence: a number between 0 and 1 indicating your confidence
- confidence_reason: short rationale for this classification
- topic_tags: array of up to 5 concise tags`
          },
          {
            role: 'user',
            content: `Categorize this meeting:\n\n${content}`
          }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI API error:', errorText);
      throw new Error('Failed to categorize meeting');
    }

    const data = await openaiResponse.json();
    const result = JSON.parse(data.choices[0].message.content);
    console.log('Categorization result:', result);

    // Ensure we have the expected format
    const response = {
      category: result.category || 'other',
      confidence: result.confidence || 0.5,
      confidence_reason: typeof result.confidence_reason === 'string' ? result.confidence_reason : 'Inferred from title and description signals',
      topic_tags: Array.isArray(result.topic_tags)
        ? result.topic_tags.filter((tag: unknown) => typeof tag === 'string').slice(0, 5)
        : [],
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: unknown) {
    console.error('Categorize meeting error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
