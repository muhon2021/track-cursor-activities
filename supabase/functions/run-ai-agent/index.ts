import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const LOVABLE_GATEWAY = 'https://ai.gateway.lovable.dev/v1/chat/completions'
const MAX_DATA_SOURCE_ROWS = 20
const MAX_DATA_CONTEXT_CHARS = 14000

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// --- Agent MCP tools (inlined for single-file dashboard deploy) ---

const MCP_HTTP_CONFIG_KEY = "x-http-config";

interface AgentMcpToolDef {
  tool_id: string;
  server_id: string;
  tool_name: string;
  function_name: string;
  description: string;
  parameters: Record<string, unknown>;
}

interface McpChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

function stripHttpConfig(schema: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...schema };
  delete copy[MCP_HTTP_CONFIG_KEY];
  if (!copy.type) copy.type = "object";
  if (!copy.properties) copy.properties = {};
  return copy;
}

function makeFunctionName(serverName: string, toolName: string): string {
  const raw = `${serverName}_${toolName}`
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return (raw || "mcp_tool").slice(0, 64);
}

async function loadAgentMcpToolDefs(
  supabase: ReturnType<typeof createClient>,
  serverIds: string[]
): Promise<AgentMcpToolDef[]> {
  if (!serverIds.length) return [];

  const { data: tools, error } = await supabase
    .from("mcp_tools")
    .select("id, server_id, name, description, input_schema")
    .in("server_id", serverIds)
    .eq("is_enabled", true)
    .order("name");

  if (error || !tools?.length) {
    if (error) console.warn("loadAgentMcpToolDefs:", error.message);
    return [];
  }

  const { data: servers } = await supabase
    .from("mcp_servers")
    .select("id, name")
    .in("id", serverIds);

  const serverNames = new Map(
    (servers ?? []).map((s: { id: string; name: string }) => [s.id, s.name])
  );

  const usedNames = new Set<string>();
  const defs: AgentMcpToolDef[] = [];

  for (const tool of tools) {
    const serverName = serverNames.get(tool.server_id) ?? "server";
    let functionName = makeFunctionName(serverName, tool.name);
    let suffix = 2;
    while (usedNames.has(functionName)) {
      functionName = `${makeFunctionName(serverName, tool.name).slice(0, 58)}_${suffix}`;
      suffix++;
    }
    usedNames.add(functionName);

    const schema = (tool.input_schema as Record<string, unknown>) ?? {};

    defs.push({
      tool_id: tool.id,
      server_id: tool.server_id,
      tool_name: tool.name,
      function_name: functionName,
      description: tool.description || tool.name,
      parameters: stripHttpConfig(schema),
    });
  }

  return defs;
}

async function executeMcpToolViaEdgeFunction(
  supabaseUrl: string,
  serviceKey: string,
  params: {
    tool_id: string;
    input_parameters: Record<string, unknown>;
    user_id: string;
    agent_id?: string;
    conversation_id?: string;
  }
): Promise<string> {
  const response = await fetch(`${supabaseUrl}/functions/v1/execute-mcp-tool`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tool_id: params.tool_id,
      input_parameters: params.input_parameters,
      user_id: params.user_id,
      agent_id: params.agent_id,
      conversation_id: params.conversation_id,
    }),
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body.error || `MCP tool execution failed (${response.status})`);
  }

  if (body.success === false) {
    throw new Error(body.error || "MCP tool execution failed");
  }

  const output = body.output ?? body;
  return typeof output === "string" ? output : JSON.stringify(output, null, 2);
}

async function chatWithMcpToolsOpenAI(
  apiKey: string,
  model: string,
  messages: McpChatMessage[],
  toolDefs: AgentMcpToolDef[],
  executeTool: (toolId: string, args: Record<string, unknown>) => Promise<string>,
  options?: { max_tokens?: number; temperature?: number; max_rounds?: number }
): Promise<{ content: string; input_tokens: number; output_tokens: number; model: string }> {
  const openaiTools = toolDefs.map((t) => ({
    type: "function" as const,
    function: {
      name: t.function_name,
      description: t.description,
      parameters: t.parameters,
    },
  }));

  const workingMessages = [...messages];
  let inputTokens = 0;
  let outputTokens = 0;
  const maxRounds = options?.max_rounds ?? 5;

  for (let round = 0; round < maxRounds; round++) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: workingMessages,
        tools: openaiTools,
        tool_choice: "auto",
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.max_tokens ?? 2000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API error: ${errText}`);
    }

    const data = await response.json();
    inputTokens += data.usage?.prompt_tokens ?? 0;
    outputTokens += data.usage?.completion_tokens ?? 0;

    const assistantMessage = data.choices?.[0]?.message;
    if (!assistantMessage) {
      throw new Error("No response from AI model");
    }

    const toolCalls = assistantMessage.tool_calls;
    if (!toolCalls?.length) {
      return {
        content: assistantMessage.content || "",
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        model: data.model || model,
      };
    }

    workingMessages.push(assistantMessage);

    for (const toolCall of toolCalls) {
      const fnName = toolCall.function?.name;
      const def = toolDefs.find((d) => d.function_name === fnName);
      let toolResult: string;

      try {
        const args = JSON.parse(toolCall.function?.arguments || "{}");
        if (!def) {
          toolResult = `Error: Unknown tool ${fnName}`;
        } else {
          toolResult = await executeTool(def.tool_id, args);
        }
      } catch (err: unknown) {
        toolResult = `Error: ${err instanceof Error ? err.message : "Tool execution failed"}`;
      }

      workingMessages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: toolResult,
      });
    }
  }

  return {
    content: "I reached the maximum number of tool calls for this request. Please try a simpler question.",
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    model,
  };
}

// --- End agent MCP tools ---

interface DataSourceConfig {
  table: string
  columns?: string[]
  limit?: number
  order_by?: string
  ascending?: boolean
  filters?: Record<string, string | number | boolean | null>
  user_scope_column?: string
}

type GenericRecord = Record<string, unknown>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function normalizeDataSourceConfig(raw: unknown): DataSourceConfig[] {
  if (!Array.isArray(raw)) {
    return []
  }

  const normalized: DataSourceConfig[] = []
  for (const source of raw) {
    if (typeof source === 'string' && source.trim().length > 0) {
      normalized.push({
        table: source.trim(),
        limit: 5,
      })
      continue
    }

    if (!isRecord(source)) {
      continue
    }

    const tableCandidate = source.table
    if (typeof tableCandidate !== 'string' || tableCandidate.trim().length === 0) {
      continue
    }

    const columnsRaw = source.columns
    const columns = Array.isArray(columnsRaw)
      ? columnsRaw.filter((col): col is string => typeof col === 'string' && col.trim().length > 0)
      : undefined

    const limitRaw = source.limit
    const safeLimit = typeof limitRaw === 'number' && Number.isFinite(limitRaw)
      ? Math.min(Math.max(Math.floor(limitRaw), 1), MAX_DATA_SOURCE_ROWS)
      : 5

    const orderBy = typeof source.order_by === 'string' && source.order_by.trim().length > 0
      ? source.order_by
      : undefined

    const filtersRaw = source.filters
    const filters: Record<string, string | number | boolean | null> = {}
    if (isRecord(filtersRaw)) {
      for (const [key, value] of Object.entries(filtersRaw)) {
        if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          filters[key] = value
        }
      }
    }

    const userScopeColumn = typeof source.user_scope_column === 'string' && source.user_scope_column.trim().length > 0
      ? source.user_scope_column
      : undefined

    normalized.push({
      table: tableCandidate.trim(),
      columns,
      limit: safeLimit,
      order_by: orderBy,
      ascending: source.ascending === false ? false : true,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      user_scope_column: userScopeColumn,
    })
  }

  return normalized
}

function applyFilterPlaceholders(
  value: string | number | boolean | null,
  userId: string | null,
): string | number | boolean | null {
  if (typeof value !== 'string') {
    return value
  }

  if (value === '$user_id') {
    return userId
  }

  return value
}

async function fetchDataSourceRecords(
  supabaseClient: ReturnType<typeof createClient>,
  source: DataSourceConfig,
  userId: string | null,
): Promise<GenericRecord[]> {
  const selectClause = source.columns && source.columns.length > 0 ? source.columns.join(',') : '*'

  let query = supabaseClient
    .from(source.table)
    .select(selectClause)
    .limit(source.limit ?? 5)

  if (source.order_by) {
    query = query.order(source.order_by, { ascending: source.ascending !== false })
  }

  if (source.user_scope_column && userId) {
    query = query.eq(source.user_scope_column, userId)
  }

  if (source.filters) {
    for (const [column, rawValue] of Object.entries(source.filters)) {
      const resolvedValue = applyFilterPlaceholders(rawValue, userId)
      if (resolvedValue === null) {
        query = query.is(column, null)
        continue
      }
      query = query.eq(column, resolvedValue)
    }
  }

  const { data, error } = await query
  if (error) {
    console.warn(`Failed to fetch data source "${source.table}":`, error.message)
    return []
  }

  if (!Array.isArray(data)) {
    return []
  }

  return data as GenericRecord[]
}

async function buildDataSourceContext(
  supabaseClient: any,
  rawDataSources: unknown,
  userId: string | null,
): Promise<string> {
  const sources = normalizeDataSourceConfig(rawDataSources)
  if (sources.length === 0) {
    return ''
  }

  const sections: string[] = []
  let totalChars = 0

  for (const source of sources) {
    const records = await fetchDataSourceRecords(supabaseClient, source, userId)
    if (records.length === 0) {
      continue
    }

    const serialized = JSON.stringify(records, null, 2)
    const section = `### ${source.table}\n${serialized}`
    if (totalChars + section.length > MAX_DATA_CONTEXT_CHARS) {
      break
    }
    totalChars += section.length
    sections.push(section)
  }

  return sections.join('\n\n')
}

function tokenizeForMatch(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3)
    .slice(0, 20)
}

function scoreOverlap(content: string, tokens: string[]): number {
  const lower = content.toLowerCase()
  let score = 0
  for (const token of tokens) {
    if (lower.includes(token)) {
      score += 1
    }
  }
  return score
}

function isIntegrationTaskQuery(message: string): boolean {
  const normalized = message.toLowerCase()
  const mentionsTask = /\btasks?\b/.test(normalized)
  const mentionsIntegration = /\b(clickup|click up|activecollab|active collab)\b/.test(normalized)
  return mentionsTask && mentionsIntegration
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // GET or ping = health check (no OpenAI call)
  if (req.method === 'GET') {
    const hasKey = !!(Deno.env.get('LOVABLE_API_KEY') || Deno.env.get('OPENAI_API_KEY'))
    return new Response(
      JSON.stringify({ ok: true, configured: hasKey, message: hasKey ? 'AI provider configured' : 'No AI provider key set' }),
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
      const hasKey = !!(Deno.env.get('LOVABLE_API_KEY') || Deno.env.get('OPENAI_API_KEY'))
      return new Response(
        JSON.stringify({ ok: true, configured: hasKey, message: hasKey ? 'AI provider configured' : 'No AI provider key set' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const anonClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authHeader } } })
    const { data: userData, error: userErr } = await anonClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const authedUserId = userData.user.id

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { agent_id, agent_slug, execution_context, input: bodyInput } = body
    const user_id = authedUserId

    if (!agent_id && !agent_slug) {
      return new Response(
        JSON.stringify({ error: 'agent_id or agent_slug is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Get agent configuration
    let query = supabaseClient.from('ai_agents').select('*')
    if (agent_id) {
      query = query.eq('id', agent_id)
    } else {
      query = query.eq('slug', agent_slug)
    }

    const { data: agent } = await query.single()
    if (!agent) {
      throw new Error('Agent not found')
    }

    // Get user personalization if exists
    let additionalPrompt = ''
    if (user_id) {
      try {
        const { data: personalization } = await supabaseClient
          .from('user_agent_personalizations')
          .select('additional_prompt')
          .eq('user_id', user_id)
          .eq('agent_id', agent.id)
          .eq('is_enabled', true)
          .single()

        additionalPrompt = personalization?.additional_prompt || ''
      } catch {
        // Table may not exist yet, skip personalization
        console.warn('user_agent_personalizations query failed, skipping')
      }
    }

    const startTime = Date.now()

    // User message: prefer explicit input (Run Agent modal), then execution_context (programmatic calls)
    const userMessage =
      typeof bodyInput === 'string' && bodyInput.trim().length > 0
        ? bodyInput.trim()
        : execution_context != null
          ? (typeof execution_context === 'string' ? execution_context : JSON.stringify(execution_context))
          : 'No context provided. Please respond with a default helpful message.'

    // Build contextual database data based on agent.data_sources.
    const dataSourceContext = await buildDataSourceContext(
      supabaseClient,
      agent.data_sources,
      typeof user_id === 'string' && user_id.length > 0 ? user_id : null,
    )

    // Build RAG context via semantic search when agent has RAG enabled.
    let ragContext = ''
    const integrationTaskQuery = isIntegrationTaskQuery(userMessage)
    if (agent.rag_enabled === true || integrationTaskQuery) {
      try {
        const baseUrl = Deno.env.get('SUPABASE_URL')
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        if (baseUrl && serviceKey) {
          const semRes = await fetch(`${baseUrl}/functions/v1/semantic-search`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({
              query: userMessage,
              match_threshold: 0.5,
              match_count: 8,
              entity_type: integrationTaskQuery ? 'task' : null,
              user_id: typeof user_id === 'string' && user_id.length > 0 ? user_id : null,
            }),
          })
          if (semRes.ok) {
            const semBody = await semRes.json()
            const rawResults = semBody.results ?? []
            const results = integrationTaskQuery
              ? rawResults.filter((doc: { metadata?: Record<string, unknown> }) => {
                  const sourceValue = doc.metadata?.source
                  const source = typeof sourceValue === 'string' ? sourceValue.toLowerCase() : ''
                  return source === 'clickup' || source === 'activecollab'
                })
              : rawResults
            if (results.length > 0) {
              const contextChunks = results.map((doc: { content?: string; entity_type?: string; similarity?: number; metadata?: Record<string, unknown> }, idx: number) => {
                const source = doc.metadata?.source ?? doc.entity_type ?? 'unknown'
                return `[${idx + 1}] (${source}, relevance: ${(doc.similarity ?? 0).toFixed(2)})\n${doc.content ?? ''}`
              })
              ragContext = contextChunks.join('\n\n')
            }
          } else {
            console.warn('Semantic search returned non-OK:', semRes.status)
          }
        }
      } catch (ragError) {
        console.warn('RAG semantic search failed, falling back to keyword match:', ragError)
        // Fallback: simple keyword search on embeddings
        try {
          const { data: embeddingRows } = await supabaseClient
            .from('embeddings')
            .select('entity_id, entity_type, content, metadata')
            .limit(200)

          if (Array.isArray(embeddingRows) && embeddingRows.length > 0) {
            const tokens = tokenizeForMatch(userMessage)
            const ranked = embeddingRows
              .filter((row) => typeof row.content === 'string' && row.content.length > 0)
              .map((row) => ({ ...row, score: scoreOverlap(row.content, tokens) }))
              .filter((row) => row.score > 0)
              .sort((a, b) => b.score - a.score)
              .slice(0, 8)

            if (ranked.length > 0) {
              ragContext = ranked.map((row, idx) => {
                const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata as Record<string, unknown> : {}
                const source = typeof metadata.source === 'string' ? metadata.source : (row.entity_type ?? 'unknown')
                return `[${idx + 1}] (${source})\n${row.content}`
              }).join('\n\n')
            }
          }
        } catch (fallbackErr) {
          console.warn('Keyword fallback also failed:', fallbackErr)
        }
      }
    }

    // Build system prompt with data context + RAG context.
    const systemPrompt = [
      agent.system_prompt,
      additionalPrompt ? additionalPrompt : null,
      dataSourceContext
        ? `\n\nDATABASE CONTEXT (from configured data_sources):\nUse only this context when it is relevant. If context is missing or insufficient, state assumptions clearly.\n\n${dataSourceContext}`
        : null,
      ragContext
        ? `\n\nRELEVANT CONTEXT (from knowledge base):\nUse the following retrieved context to answer the user's query. If the context doesn't contain relevant information, say so clearly and answer based on your general knowledge.\n\n${ragContext}`
        : null,
    ].filter(Boolean).join('\n\n')

    // Determine AI provider: prefer Lovable AI gateway, fallback to OpenAI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')

    const serverIds = Array.isArray(agent.mcp_server_ids) ? agent.mcp_server_ids as string[] : []
    const mcpEnabled = agent.tool_mcp === true && serverIds.length > 0

    if (mcpEnabled && OPENAI_API_KEY) {
      const toolDefs = await loadAgentMcpToolDefs(supabaseClient, serverIds)
      if (toolDefs.length > 0) {
        const mcpMessages: McpChatMessage[] = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ]

        const baseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

        const mcpResponse = await chatWithMcpToolsOpenAI(
          OPENAI_API_KEY,
          'gpt-4o-mini',
          mcpMessages,
          toolDefs,
          (toolId, args) =>
            executeMcpToolViaEdgeFunction(baseUrl, serviceKey, {
              tool_id: toolId,
              input_parameters: args,
              user_id: typeof user_id === 'string' ? user_id : authedUserId,
              agent_id: agent.id,
            }),
          { temperature: 0.7 }
        )

        const latency = Date.now() - startTime

        const { data: run, error: runError } = await supabaseClient
          .from('ai_agent_runs')
          .insert([{
            agent_id: agent.id,
            user_id: user_id || null,
            status: 'completed',
            context: typeof bodyInput === 'string' && bodyInput.trim().length > 0 ? bodyInput : execution_context,
            output: mcpResponse.content,
            token_metrics: {
              prompt_tokens: mcpResponse.input_tokens,
              completion_tokens: mcpResponse.output_tokens,
            },
            latency_ms: latency,
            provider_used: 'openai',
            model_used: mcpResponse.model,
          }])
          .select()
          .single()

        if (runError) {
          console.error('Failed to log agent run:', runError)
        }

        return new Response(
          JSON.stringify({
            run_id: run?.id || null,
            status: 'completed',
            output: mcpResponse.content,
            token_usage: {
              prompt_tokens: mcpResponse.input_tokens,
              completion_tokens: mcpResponse.output_tokens,
            },
            latency_ms: latency,
            mcp_tools_used: toolDefs.length,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }
    }

    let aiUrl: string
    let aiHeaders: Record<string, string>
    let modelName: string

    if (LOVABLE_API_KEY) {
      aiUrl = LOVABLE_GATEWAY
      aiHeaders = { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' }
      modelName = 'google/gemini-2.5-flash'
    } else if (OPENAI_API_KEY) {
      aiUrl = 'https://api.openai.com/v1/chat/completions'
      aiHeaders = { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' }
      modelName = 'gpt-4o-mini'
    } else {
      throw new Error('No AI provider configured (LOVABLE_API_KEY or OPENAI_API_KEY required)')
    }

    // Execute agent
    const openaiResponse = await fetch(aiUrl, {
      method: 'POST',
      headers: aiHeaders,
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.7,
      }),
    })

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text()
      console.error('OpenAI API error:', openaiResponse.status, errorText)
      throw new Error(`AI agent execution failed: ${openaiResponse.status} - ${errorText}`)
    }

    const data = await openaiResponse.json()
    const output = data.choices[0].message.content
    const latency = Date.now() - startTime

    // Log agent run (context stores what was sent as user message for audit)
    const { data: run, error: runError } = await supabaseClient
      .from('ai_agent_runs')
      .insert([{
        agent_id: agent.id,
        user_id: user_id || null,
        status: 'completed',
        context: typeof bodyInput === 'string' && bodyInput.trim().length > 0 ? bodyInput : execution_context,
        output: output,
        token_metrics: data.usage,
        latency_ms: latency,
        provider_used: LOVABLE_API_KEY ? 'lovable' : 'openai',
        model_used: modelName,
      }])
      .select()
      .single()

    if (runError) {
      console.error('Failed to log agent run:', runError)
    }

    return new Response(
      JSON.stringify({
        run_id: run?.id || null,
        status: 'completed',
        output,
        token_usage: data.usage,
        latency_ms: latency,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    console.error('Run AI agent error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
