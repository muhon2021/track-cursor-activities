import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { syncMemoryGraphLinks } from '../_shared/graphify-extraction.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ExtractMemoriesRequest {
  agent_id: string
  user_id: string
  conversation_id: string
  auto_extract?: boolean  // If true, uses AI to extract memories automatically
  memories?: Array<{
    memory_type: string
    content: string
    relevance_score?: number
  }>
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

    const {
      agent_id,
      user_id,
      conversation_id,
      auto_extract = true,
      memories: providedMemories,
    }: ExtractMemoriesRequest = await req.json()

    if (!agent_id || !user_id || !conversation_id) {
      return new Response(
        JSON.stringify({ error: 'agent_id, user_id, and conversation_id are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    let memoriesToStore: Array<{
      memory_type: string
      content: string
      relevance_score: number
    }> = []

    if (providedMemories && providedMemories.length > 0) {
      // Use provided memories
      memoriesToStore = providedMemories.map(m => ({
        memory_type: m.memory_type,
        content: m.content,
        relevance_score: m.relevance_score ?? 0.8,
      }))
    } else if (auto_extract) {
      // Get conversation messages
      const { data: messages, error: messagesError } = await supabaseClient
        .from('agent_messages')
        .select('role, content, created_at')
        .eq('conversation_id', conversation_id)
        .order('created_at', { ascending: true })

      if (messagesError || !messages || messages.length < 2) {
        return new Response(
          JSON.stringify({ error: 'No messages to extract memories from' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      // Use AI to extract memories
      const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
      if (!OPENAI_API_KEY) {
        return new Response(
          JSON.stringify({ error: 'OpenAI API key not configured' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
      }

      const conversationText = messages
        .map((m: any) => `${m.role}: ${m.content}`)
        .join('\n')

      const extractionPrompt = `Analyze this conversation and extract important memories that would be useful to remember for future conversations.

For each memory, classify it as one of these types:
- summary: A brief summary of what was discussed
- fact: An important fact about the user or their needs
- preference: A user preference that was mentioned or implied
- decision: A decision that was made during the conversation
- pattern: A pattern in how the user works or communicates

Return a JSON array of memories. Each memory should have:
- memory_type: One of the types above
- content: The memory content (1-2 sentences)
- relevance_score: A score from 0.5 to 1.0 indicating importance

CONVERSATION:
${conversationText}

Return ONLY valid JSON, no other text. Example format:
[
  {"memory_type": "fact", "content": "User is working on Q3 budget planning", "relevance_score": 0.9},
  {"memory_type": "preference", "content": "User prefers bullet-point summaries", "relevance_score": 0.8}
]`

      const extractionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are a memory extraction assistant. Extract useful memories from conversations. Always respond with valid JSON only.' },
            { role: 'user', content: extractionPrompt },
          ],
          temperature: 0.3,
          max_tokens: 1000,
        }),
      })

      if (!extractionResponse.ok) {
        throw new Error('AI extraction failed')
      }

      const extractionData = await extractionResponse.json()
      const extractedContent = extractionData.choices?.[0]?.message?.content || '[]'

      try {
        // Clean up response and parse JSON
        const cleanedContent = extractedContent
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim()

        memoriesToStore = JSON.parse(cleanedContent)

        // Validate and sanitize
        memoriesToStore = memoriesToStore
          .filter((m: any) =>
            m.memory_type &&
            m.content &&
            ['summary', 'fact', 'preference', 'decision', 'pattern', 'context'].includes(m.memory_type)
          )
          .map((m: any) => ({
            memory_type: m.memory_type,
            content: String(m.content).slice(0, 1000), // Limit content length
            relevance_score: Math.min(Math.max(Number(m.relevance_score) || 0.8, 0.5), 1.0),
          }))
      } catch (parseError) {
        console.error('Failed to parse extracted memories:', parseError)
        // Create a simple summary as fallback
        memoriesToStore = [{
          memory_type: 'summary',
          content: `Conversation about: ${messages[0]?.content?.slice(0, 100)}...`,
          relevance_score: 0.7,
        }]
      }
    }

    if (memoriesToStore.length === 0) {
      return new Response(
        JSON.stringify({ memories: [], message: 'No memories to store' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Generate embeddings and store memories
    const storedMemories = []

    for (const memory of memoriesToStore) {
      // Generate embedding
      let embedding = null
      try {
        const embeddingResponse = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-embeddings`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text: memory.content, user_id }),
          }
        )

        if (embeddingResponse.ok) {
          const embeddingData = await embeddingResponse.json()
          embedding = embeddingData?.embedding || null
        }
      } catch (embError) {
        console.error('Embedding generation error:', embError)
      }

      // Store memory (updated to use new agent_memories table schema)
      const { data: storedMemory, error: storeError } = await supabaseClient
        .from('agent_memories')
        .insert({
          agent_id,
          user_id,
          memory_type: 'short_term', // New memories start as short-term
          memory_category: memory.memory_type, // Map old memory_type to category
          content: memory.content,
          summary: memory.content.slice(0, 200), // Create summary from first 200 chars
          embedding,
          source_type: 'conversation',
          source_id: conversation_id,
          importance_score: memory.relevance_score,
          is_active: true,
        })
        .select('id, memory_type, memory_category, content, importance_score')
        .single()

      if (!storeError && storedMemory) {
        storedMemories.push(storedMemory)

        try {
          await syncMemoryGraphLinks(supabaseClient, {
            memoryId: storedMemory.id,
            memoryContent: memory.content,
            userId: user_id,
            agentId: agent_id,
            sourceType: 'conversation',
            sourceId: conversation_id,
          })
        } catch (graphErr) {
          console.error('Graphify memory link error:', graphErr)
        }
      } else {
        console.error('Failed to store memory:', storeError)
      }
    }

    return new Response(
      JSON.stringify({
        memories: storedMemories,
        extracted_count: memoriesToStore.length,
        stored_count: storedMemories.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: unknown) {
    console.error('Extract memories error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
