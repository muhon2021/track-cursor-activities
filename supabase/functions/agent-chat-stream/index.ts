import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface StreamRequest {
  conversation_id: string
  agent_id: string
  message: string
  user_id: string
  model_id?: string
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Parse query parameters for GET requests (SSE standard)
  const url = new URL(req.url)
  const params: StreamRequest = {
    conversation_id: url.searchParams.get('conversation_id') || '',
    agent_id: url.searchParams.get('agent_id') || '',
    message: url.searchParams.get('message') || '',
    user_id: url.searchParams.get('user_id') || '',
    model_id: url.searchParams.get('model_id') || undefined,
  }

  if (!params.conversation_id || !params.agent_id || !params.message || !params.user_id) {
    return new Response(
      JSON.stringify({ error: 'Missing required parameters' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  // Create SSE stream
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      const startTime = Date.now()

      const sendEvent = (type: string, data: unknown) => {
        const payload = JSON.stringify({ type, data })
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`))
      }

      try {
        // 1. Get agent configuration
        const { data: agent, error: agentError } = await supabaseClient
          .from('ai_agents')
          .select('*')
          .eq('id', params.agent_id)
          .single()

        if (agentError || !agent) {
          sendEvent('error', 'Agent not found')
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
          return
        }

        // Send start event
        sendEvent('start', { conversation_id: params.conversation_id, agent_name: agent.name })

        // 2. Get user personalization
        let additionalContext = ''
        const { data: personalization } = await supabaseClient
          .from('user_agent_personalizations')
          .select('additional_prompt')
          .eq('user_id', params.user_id)
          .eq('agent_id', params.agent_id)
          .eq('is_enabled', true)
          .single()

        if (personalization?.additional_prompt) {
          additionalContext = personalization.additional_prompt
        }

        // 3. Get conversation history
        const { data: history } = await supabaseClient
          .from('agent_messages')
          .select('role, content')
          .eq('conversation_id', params.conversation_id)
          .order('created_at', { ascending: true })
          .limit(20)

        // 4. Get relevant memories (if agent has memory enabled)
        let memoryContext = ''
        if (agent.memory_enabled) {
          try {
            // Use new retrieve-agent-memories edge function
            const memoryResponse = await fetch(
              `${Deno.env.get('SUPABASE_URL')}/functions/v1/retrieve-agent-memories`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  agent_id: params.agent_id,
                  user_id: params.user_id,
                  query: params.message,
                  memory_types: ['short_term', 'long_term', 'episodic'],
                  limit: 5,
                  similarity_threshold: 0.7,
                  include_recent: true,
                  recent_days: 7,
                }),
              }
            )

            if (memoryResponse.ok) {
              const memoryData = await memoryResponse.json()

              if (memoryData?.memories && memoryData.memories.length > 0) {
                // Format memories for injection into system prompt
                const formattedMemories = memoryData.memories
                  .map((m: any) => {
                    const category = m.memory_category ? `[${m.memory_category}]` : ''
                    const similarity = m.similarity ? ` (relevance: ${(m.similarity * 100).toFixed(0)}%)` : ''
                    return `${category} ${m.content}${similarity}`
                  })
                  .join('\n')

                memoryContext = `\n\nRELEVANT CONTEXT FROM PREVIOUS CONVERSATIONS:\n${formattedMemories}\n`

                sendEvent('memory', {
                  count: memoryData.memories.length,
                  semantic_count: memoryData.semantic_count,
                  recent_count: memoryData.recent_count
                })
              }
            }
          } catch (memError) {
            console.error('Memory retrieval error:', memError)
            // Continue without memories - don't fail the chat
          }
        }

        // 5. Build messages array
        const systemPrompt = [
          agent.system_prompt,
          additionalContext,
          memoryContext,
        ].filter(Boolean).join('\n\n')

        const messages = [
          { role: 'system', content: systemPrompt },
          ...(history || [])
            .filter((h: any) => h.role !== 'system')
            .map((h: any) => ({ role: h.role, content: h.content })),
          { role: 'user', content: params.message },
        ]

        // 6. Determine provider and call streaming API
        const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
        if (!OPENAI_API_KEY) {
          sendEvent('error', 'OpenAI API key not configured')
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
          return
        }

        // Get model from database or use default
        let modelId = 'gpt-4o-mini'
        if (params.model_id) {
          const { data: modelData } = await supabaseClient
            .from('ai_models')
            .select('model_id')
            .eq('id', params.model_id)
            .single()
          if (modelData) {
            modelId = modelData.model_id
          }
        }

        // 7. Call OpenAI streaming API
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: modelId,
            messages,
            temperature: agent.provider_config?.temperature ?? 0.7,
            max_tokens: agent.provider_config?.max_tokens ?? 2000,
            stream: true,
          }),
        })

        if (!openaiResponse.ok) {
          const errorData = await openaiResponse.json()
          sendEvent('error', errorData.error?.message || 'AI provider error')
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
          return
        }

        // 8. Stream the response
        const reader = openaiResponse.body?.getReader()
        const decoder = new TextDecoder()
        let fullContent = ''
        let buffer = ''

        if (!reader) {
          sendEvent('error', 'No response body from AI provider')
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
          return
        }

        while (true) {
          const { done, value } = await reader.read()

          if (done) break

          buffer += decoder.decode(value, { stream: true })

          // Process complete SSE lines from OpenAI
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim()

              if (data === '[DONE]') {
                continue
              }

              try {
                const parsed = JSON.parse(data)
                const content = parsed.choices?.[0]?.delta?.content

                if (content) {
                  fullContent += content
                  sendEvent('token', content)
                }

                // Check for tool calls
                const toolCalls = parsed.choices?.[0]?.delta?.tool_calls
                if (toolCalls && toolCalls.length > 0) {
                  for (const tool of toolCalls) {
                    sendEvent('tool_use', {
                      id: tool.id,
                      name: tool.function?.name,
                      input: tool.function?.arguments,
                      status: 'pending',
                      startedAt: new Date().toISOString(),
                    })
                  }
                }
              } catch (parseErr) {
                // Skip non-JSON lines
              }
            }
          }
        }

        const latency = Date.now() - startTime

        // 9. Save the assistant message
        await supabaseClient.from('agent_messages').insert({
          conversation_id: params.conversation_id,
          role: 'assistant',
          content: fullContent,
          model_used: modelId,
          provider_used: 'openai',
          latency_ms: latency,
          is_streaming: false,
          stream_completed_at: new Date().toISOString(),
        })

        // 10. Update conversation stats
        await supabaseClient
          .from('agent_conversations')
          .update({
            last_message_at: new Date().toISOString(),
            message_count: supabaseClient.rpc('increment', { x: 2 }), // +2 for user + assistant
          })
          .eq('id', params.conversation_id)

        // 11. Extract and store memories (if agent has memory enabled)
        // Run asynchronously - don't block response
        if (agent.memory_enabled) {
          // Fire and forget - don't await
          fetch(
            `${Deno.env.get('SUPABASE_URL')}/functions/v1/extract-agent-memories`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                agent_id: params.agent_id,
                user_id: params.user_id,
                conversation_id: params.conversation_id,
                auto_extract: true,
              }),
            }
          ).catch(err => console.error('Background memory extraction error:', err))
        }

        // 12. Send complete event
        sendEvent('complete', {
          fullMessage: fullContent,
          metadata: {
            latency_ms: latency,
            model_used: modelId,
            had_memories: memoryContext.length > 0,
            memory_extraction_triggered: agent.memory_enabled,
          },
        })

        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()

      } catch (error: unknown) {
        console.error('Streaming error:', error)
        const message = error instanceof Error ? error.message : 'Unknown error'
        sendEvent('error', message)
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
})
