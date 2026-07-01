# AI Agents Gap Analysis & Implementation Plan

**Document Version:** 1.0
**Date:** January 2026
**Author:** Senior AI Architect Review
**Framework:** SJ Control Tower Framework
**Reference Guides:** CollabAI AI Agents Implementation Guide, Universal RAG Framework Guide
**Provider Standards Referenced:** Google AI (Gemini), Anthropic (Claude), Amazon Bedrock Best Practices

---

## Executive Summary

After comprehensive review of the CollabAI implementation guides against the existing SJ Control Tower Framework, this document presents:

1. **Current Framework Strengths** - What you already have that matches or exceeds the guide
2. **Gap Analysis** - Features from the guide not yet implemented
3. **Prioritized Implementation Plan** - Phased approach with UI requirements
4. **Architecture Recommendations** - Following Google, Claude, and AWS best practices

### Key Finding

**Your framework is already 60-70% aligned with the CollabAI guide.** The major gaps are in:
- Agent conversation management (threaded conversations per agent)
- Public agent marketplace/sharing
- Agent-specific tool configuration (Code Interpreter, Image Generation)
- MCP Server integration at agent level
- Agent ratings and favorites system
- Streaming SSE responses for chat

---

## Part 1: Current Framework Strengths

### What You Already Have (Exceeds Guide in Some Areas)

| Feature | CollabAI Guide | Your Framework | Status |
|---------|----------------|----------------|--------|
| **Multi-Provider AI Routing** | OpenAI, Anthropic, Google | OpenAI, Anthropic, Google, **Perplexity** | **Exceeds** |
| **Provider Fallback Chains** | Not mentioned | Full fallback chain with telemetry | **Exceeds** |
| **AI Models Catalog** | Basic | Comprehensive with features, pricing, context windows | **Exceeds** |
| **Semantic Search (RAG)** | pgVector 1536 dim | pgVector 1536 dim with similarity scoring | **Matches** |
| **Knowledge Base** | File chunks + embeddings | embeddings + user_knowledge_files + common_knowledge | **Exceeds** |
| **Agent Personalization** | Not in guide | Per-user agent customization with attached files | **Exceeds** |
| **AI Usage Tracking** | Basic usage count | Full telemetry (tokens, cost, latency, provider) | **Exceeds** |
| **Edge Functions** | 3-4 functions | 31+ comprehensive functions | **Exceeds** |
| **RLS Security** | Basic policies | Comprehensive RLS with role-based access | **Matches** |
| **Integration Hub** | Not mentioned | Google, Zoom, Microsoft, Slack | **Exceeds** |
| **Feature Flags** | Not mentioned | Admin-configurable feature toggles | **Exceeds** |
| **File Processing** | Basic upload | Auto-embed with processing status | **Matches** |

### Your Framework's Unique Advantages

1. **Advanced Provider Routing** (`ai-provider-routing.ts`)
   - Automatic fallback chains (Primary → Fallback → Research → Last Resort)
   - Per-model feature flags (reasoning, vision, function_calling)
   - Real-time cost calculation with 2026 pricing
   - Telemetry tracking (latency_ms, token usage, costs)

2. **Agent Personalization System** (`agent-personalization.ts`)
   - User-specific prompt additions per agent
   - Attached knowledge files per user-agent pair
   - Semantic search integration into prompts
   - Common knowledge file references (CommonSJ/ paths)

3. **Comprehensive Integration Ecosystem**
   - Google Drive sync for knowledge
   - Zoom transcript processing for meetings
   - Microsoft Teams/Outlook integration
   - Webhook-based real-time updates

---

## Part 2: Gap Analysis

### Critical Gaps (High Priority)

#### Gap 1: Agent Conversation Threading
**Guide Has:** Dedicated `agent_conversations` table with thread management
**You Have:** `ai_chat_history` with session_id but no formal threading

```
CollabAI Structure:
├── agent_conversations (threads)
│   ├── id, agent_id, user_id, title, summary
│   └── is_archived, created_at
└── messages (individual messages)
    └── conversation_id, role, content, metadata

Your Structure:
└── ai_chat_history (flat)
    └── session_id, agent_id, role, content
```

**Impact:** Users cannot manage multiple conversation threads per agent

---

#### Gap 2: Agent-Level Tool Configuration
**Guide Has:** Per-agent tool toggles
```sql
tool_code_interpreter BOOLEAN DEFAULT false,
tool_file_search BOOLEAN DEFAULT false,
tool_web_search BOOLEAN DEFAULT false,
tool_image_generation BOOLEAN DEFAULT false,
tool_mcp BOOLEAN DEFAULT false,
mcpServerIds UUID[]
```

**You Have:** Model-level features in `ai_models.features` JSONB but no agent-level tool configuration

**Impact:** Cannot enable/disable tools per agent (e.g., Agent A gets web search, Agent B doesn't)

---

#### Gap 3: Public Agent Marketplace
**Guide Has:**
- `is_public` flag on agents
- Public browsing endpoints (`/agents/explore`)
- Rating system (`agent_ratings` table)
- Favorites system (`agent_favorites` table)
- Duplicate/clone functionality
- Usage statistics and leaderboards

**You Have:** Agents are user-scoped, no public sharing

**Impact:** No agent discovery, sharing, or community features

---

#### Gap 4: Streaming Chat (SSE)
**Guide Has:** Server-Sent Events for real-time token streaming
```javascript
// SSE Format
event: token
data: {"token": "The"}

event: tool_use
data: {"toolName": "code_interpreter", "toolInput": {...}}

event: complete
data: {"fullMessage": "..."}

data: [DONE]
```

**You Have:** Standard request/response in `ai-chat-assistant` and `run-ai-agent`

**Impact:** Users wait for full response instead of seeing streaming text

---

#### Gap 5: Agent Memory System
**Guide Has:** Dedicated `agent_memory` table with:
- Memory types: summary, context, pattern, fact, decision
- Vector embeddings for semantic memory retrieval
- Access count and relevance scoring
- Automatic memory extraction from conversations

**You Have:** Conversation history, but no extracted long-term memory

**Impact:** Agents don't "learn" patterns or remember important facts across sessions

---

#### Gap 6: Custom Functions/Tools Definition
**Guide Has:** `tools JSONB` array for custom tool definitions per agent
**You Have:** Model capabilities but no agent-specific tool schemas

**Impact:** Cannot define custom API integrations or function calling per agent

---

### Moderate Gaps (Medium Priority)

| Gap | Description | Guide Feature | Your Status |
|-----|-------------|---------------|-------------|
| **MCP Integration** | Model Context Protocol servers | mcpServerIds array | Not implemented |
| **Agent Categories** | Category taxonomy | agent_categories table | Not implemented |
| **Agent Duplication** | Clone agents | duplicate endpoint | Not implemented |
| **Default Agent** | Per-user default | is_default flag | Not implemented |
| **Conversation Export** | PDF/JSON export | Mentioned as future | Not implemented |
| **RAG Metrics** | Track retrieval quality | rag_metrics table | Partial (in usage logs) |
| **Agent Templates** | Pre-built templates | Mentioned in checklist | Not implemented |

### Minor Gaps (Low Priority)

| Gap | Description | Impact |
|-----|-------------|--------|
| **Agent Avatar** | Emoji or URL avatar | UX enhancement |
| **Welcome Message** | Agent greeting text | UX enhancement |
| **Conversation Starters** | Suggested prompts | UX enhancement |
| **Agent Statistics** | Detailed stats display | Analytics |

---

## Part 3: Implementation Plan

### Phase 1: Foundation Enhancement (Weeks 1-2)
**Focus:** Database schema alignment and conversation threading

#### 1.1 Database Migrations

```sql
-- Migration: Add agent conversation threading
CREATE TABLE IF NOT EXISTS public.agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  title VARCHAR(255),
  summary TEXT,
  is_archived BOOLEAN DEFAULT false,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_agent_conversations_agent_user ON public.agent_conversations(agent_id, user_id);
CREATE INDEX idx_agent_conversations_created_at ON public.agent_conversations(created_at DESC);

-- Migration: Add messages table (normalized from ai_chat_history)
CREATE TABLE IF NOT EXISTS public.agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.agent_conversations(id) ON DELETE CASCADE,

  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL,

  metadata JSONB DEFAULT '{}'::jsonb,
  tokens_used INT,
  model_used VARCHAR(100),
  tool_calls JSONB,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_agent_messages_conversation ON public.agent_messages(conversation_id);
CREATE INDEX idx_agent_messages_created_at ON public.agent_messages(created_at);
```

#### 1.2 Extend ai_agents Table

```sql
-- Migration: Add tool configuration to ai_agents
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS
  tool_code_interpreter BOOLEAN DEFAULT false;

ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS
  tool_file_search BOOLEAN DEFAULT false;

ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS
  tool_web_search BOOLEAN DEFAULT false;

ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS
  tool_image_generation BOOLEAN DEFAULT false;

ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS
  tool_mcp BOOLEAN DEFAULT false;

ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS
  mcp_server_ids UUID[] DEFAULT '{}';

ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS
  tools_config JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS
  is_default BOOLEAN DEFAULT false;

ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS
  avatar VARCHAR(255);

ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS
  welcome_message TEXT;

ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS
  conversation_starters JSONB DEFAULT '[]'::jsonb;
```

#### 1.3 UI Components - Conversation Threading

**New Components:**
```
src/components/ai/
├── AgentConversationList.tsx      # List of threads per agent
├── AgentConversationItem.tsx      # Single thread preview
├── AgentConversationView.tsx      # Thread with messages
├── NewConversationButton.tsx      # Start new thread
└── ConversationActions.tsx        # Archive, delete, rename
```

**Wireframe - Conversation List:**
```
┌─────────────────────────────────────────────────────┐
│ Agent: Board Assistant 📋                           │
├─────────────────────────────────────────────────────┤
│ [+ New Conversation]                                │
├─────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────┐ │
│ │ 📝 Q3 Budget Planning                           │ │
│ │ Last message: 2 hours ago • 12 messages         │ │
│ └─────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────┐ │
│ │ 📝 Annual Report Draft                          │ │
│ │ Last message: Yesterday • 8 messages            │ │
│ └─────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────┐ │
│ │ 📝 Meeting Agenda Review                        │ │
│ │ Last message: 3 days ago • 5 messages           │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

---

### Phase 2: Tool Configuration UI (Weeks 3-4)
**Focus:** Agent-level tool toggles and configuration

#### 2.1 Agent Editor Enhancement

**New UI Sections in Agent Editor:**
```
┌─────────────────────────────────────────────────────┐
│ Agent Configuration                                  │
├─────────────────────────────────────────────────────┤
│ Basic Info                                           │
│ ├─ Name: [________________________]                 │
│ ├─ Description: [________________]                  │
│ ├─ Avatar: [🤖] [Select Emoji]                      │
│ └─ Welcome Message: [_____________]                 │
├─────────────────────────────────────────────────────┤
│ AI Configuration                                     │
│ ├─ Provider: [OpenAI ▼]                             │
│ ├─ Model: [GPT-4o ▼]                                │
│ ├─ Temperature: [0.7 ────○────]                     │
│ └─ Max Tokens: [2000]                               │
├─────────────────────────────────────────────────────┤
│ 🔧 Tools & Capabilities                              │
│ ├─ [✓] Code Interpreter  - Execute code snippets   │
│ ├─ [✓] File Search       - Search knowledge base   │
│ ├─ [ ] Web Search        - Real-time web queries   │
│ ├─ [ ] Image Generation  - Create images (DALL-E)  │
│ └─ [ ] MCP Servers       - External tool servers   │
│     └─ [Select MCP Servers...]                      │
├─────────────────────────────────────────────────────┤
│ 📚 Knowledge Base                                    │
│ ├─ [✓] Enable RAG                                   │
│ ├─ Attached Files: [Select files...]               │
│ └─ Search Scope: [All User Files ▼]                │
├─────────────────────────────────────────────────────┤
│ 💬 Conversation Starters                            │
│ ├─ [+ Add Starter]                                  │
│ ├─ "Help me prepare for the board meeting"         │
│ ├─ "Summarize last quarter's performance"          │
│ └─ "Draft meeting minutes"                          │
└─────────────────────────────────────────────────────┘
```

#### 2.2 Tool Execution Backend

**Edge Function Enhancement:** `run-ai-agent/index.ts`

```typescript
// Add tool execution based on agent config
async function executeAgentWithTools(agent: Agent, message: string, context: any) {
  const tools = [];

  if (agent.tool_code_interpreter) {
    tools.push({
      type: 'function',
      function: {
        name: 'execute_code',
        description: 'Execute Python code',
        parameters: { type: 'object', properties: { code: { type: 'string' } } }
      }
    });
  }

  if (agent.tool_web_search) {
    tools.push({
      type: 'function',
      function: {
        name: 'web_search',
        description: 'Search the web for current information',
        parameters: { type: 'object', properties: { query: { type: 'string' } } }
      }
    });
  }

  if (agent.tool_file_search) {
    tools.push({
      type: 'function',
      function: {
        name: 'search_knowledge',
        description: 'Search knowledge base',
        parameters: { type: 'object', properties: { query: { type: 'string' } } }
      }
    });
  }

  // Call provider with tools
  return await chatCompletion({
    provider: agent.provider_config.primary.provider,
    model: agent.provider_config.primary.model,
    messages: context.messages,
    tools: tools.length > 0 ? tools : undefined,
    tool_choice: tools.length > 0 ? 'auto' : undefined
  });
}
```

---

### Phase 3: Streaming & Real-time (Weeks 5-6)
**Focus:** SSE streaming for chat responses

#### 3.1 SSE Edge Function

**New Edge Function:** `agent-chat-stream/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

serve(async (req: Request) => {
  const { agentId, conversationId, message } = await req.json();

  // Create readable stream
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      // Send initial event
      controller.enqueue(encoder.encode(`event: start\ndata: {"conversationId": "${conversationId}"}\n\n`));

      // Stream from AI provider
      const response = await streamChatCompletion({
        // ... config
        onToken: (token) => {
          controller.enqueue(encoder.encode(`event: token\ndata: ${JSON.stringify({ token })}\n\n`));
        },
        onToolCall: (tool) => {
          controller.enqueue(encoder.encode(`event: tool_use\ndata: ${JSON.stringify(tool)}\n\n`));
        },
        onComplete: (fullMessage) => {
          controller.enqueue(encoder.encode(`event: complete\ndata: ${JSON.stringify({ fullMessage })}\n\n`));
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        }
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
});
```

#### 3.2 Frontend Streaming Hook

**New Hook:** `src/hooks/useAgentChatStream.ts`

```typescript
export function useAgentChatStream(agentId: string, conversationId: string) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedContent, setStreamedContent] = useState('');
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);

  const sendMessage = useCallback(async (message: string) => {
    setIsStreaming(true);
    setStreamedContent('');

    const eventSource = new EventSource(
      `${SUPABASE_URL}/functions/v1/agent-chat-stream?` +
      new URLSearchParams({ agentId, conversationId, message })
    );

    eventSource.addEventListener('token', (e) => {
      const { token } = JSON.parse(e.data);
      setStreamedContent(prev => prev + token);
    });

    eventSource.addEventListener('tool_use', (e) => {
      const tool = JSON.parse(e.data);
      setToolCalls(prev => [...prev, tool]);
    });

    eventSource.addEventListener('complete', (e) => {
      setIsStreaming(false);
      eventSource.close();
    });

    eventSource.onerror = () => {
      setIsStreaming(false);
      eventSource.close();
    };
  }, [agentId, conversationId]);

  return { sendMessage, isStreaming, streamedContent, toolCalls };
}
```

#### 3.3 Streaming Chat UI

**Enhanced Chat Component:**
```
┌─────────────────────────────────────────────────────┐
│ 🤖 Board Assistant                                   │
├─────────────────────────────────────────────────────┤
│                                                      │
│  You: What's our Q3 revenue projection?             │
│                                                      │
│  Assistant: Based on the financial data I found...  │
│  ▊ (streaming cursor)                               │
│                                                      │
│  ┌─ Tool: search_knowledge ──────────────────────┐  │
│  │ Searching: "Q3 revenue financial report"       │  │
│  │ Found: 3 relevant documents                    │  │
│  └───────────────────────────────────────────────┘  │
│                                                      │
├─────────────────────────────────────────────────────┤
│ [Type your message...                    ] [Send]   │
└─────────────────────────────────────────────────────┘
```

---

### Phase 4: Agent Marketplace (Weeks 7-9)
**Focus:** Public sharing, ratings, and discovery

#### 4.1 Database Schema for Marketplace

```sql
-- Add public/marketplace columns to ai_agents
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS
  is_public BOOLEAN DEFAULT false;

ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS
  usage_count INT DEFAULT 0;

ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS
  average_rating DECIMAL(3,2);

ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS
  rating_count INT DEFAULT 0;

ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS
  duplicate_count INT DEFAULT 0;

-- Agent Categories
CREATE TABLE IF NOT EXISTS public.agent_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS
  category_id UUID REFERENCES public.agent_categories(id);

-- Agent Ratings
CREATE TABLE IF NOT EXISTS public.agent_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(agent_id, user_id)
);

-- Agent Favorites
CREATE TABLE IF NOT EXISTS public.agent_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(agent_id, user_id)
);

-- Indexes
CREATE INDEX idx_agents_is_public ON public.ai_agents(is_public) WHERE is_public = true;
CREATE INDEX idx_agents_category ON public.ai_agents(category_id);
CREATE INDEX idx_agents_rating ON public.ai_agents(average_rating DESC NULLS LAST);
CREATE INDEX idx_agent_ratings_agent ON public.agent_ratings(agent_id);
CREATE INDEX idx_agent_favorites_user ON public.agent_favorites(user_id);
```

#### 4.2 Marketplace UI Components

**New Page:** `src/pages/AgentMarketplace.tsx`

```
┌─────────────────────────────────────────────────────────────────┐
│ 🏪 Agent Marketplace                                             │
├─────────────────────────────────────────────────────────────────┤
│ [Search agents...                    ] [Category ▼] [Sort by ▼] │
├─────────────────────────────────────────────────────────────────┤
│ Categories: [All] [Productivity] [Writing] [Analysis] [Meeting] │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐  │
│ │ 📋 Board         │ │ ✍️ Content       │ │ 📊 Data          │  │
│ │ Assistant        │ │ Writer           │ │ Analyst          │  │
│ │                  │ │                  │ │                  │  │
│ │ ⭐ 4.8 (124)     │ │ ⭐ 4.6 (89)      │ │ ⭐ 4.9 (156)     │  │
│ │ 👥 2.3k uses     │ │ 👥 1.8k uses     │ │ 👥 3.1k uses     │  │
│ │                  │ │                  │ │                  │  │
│ │ [Use] [♡] [Copy] │ │ [Use] [♡] [Copy] │ │ [Use] [♡] [Copy] │  │
│ └──────────────────┘ └──────────────────┘ └──────────────────┘  │
│                                                                  │
│ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐  │
│ │ 🎯 Task          │ │ 📝 Meeting       │ │ 💼 Sales         │  │
│ │ Planner          │ │ Summarizer       │ │ Coach            │  │
│ │ ...              │ │ ...              │ │ ...              │  │
│ └──────────────────┘ └──────────────────┘ └──────────────────┘  │
│                                                                  │
│ [Load More...]                                                   │
└─────────────────────────────────────────────────────────────────┘
```

**Agent Detail Modal:**
```
┌─────────────────────────────────────────────────────────────────┐
│ 📋 Board Assistant                               [X]             │
├─────────────────────────────────────────────────────────────────┤
│ Created by: @johndoe • Category: Productivity                    │
│ ⭐ 4.8 (124 ratings) • 👥 2,341 uses • 📋 89 duplicates          │
├─────────────────────────────────────────────────────────────────┤
│ Description:                                                     │
│ Helps nonprofit organizations prepare for board meetings,        │
│ draft agendas, summarize minutes, and track action items.        │
├─────────────────────────────────────────────────────────────────┤
│ Capabilities:                                                    │
│ [✓] File Search  [✓] Web Search  [ ] Code Interpreter           │
├─────────────────────────────────────────────────────────────────┤
│ Conversation Starters:                                           │
│ • "Help me prepare for the board meeting"                        │
│ • "Draft meeting minutes from this transcript"                   │
│ • "What are the key decisions from last meeting?"                │
├─────────────────────────────────────────────────────────────────┤
│ Reviews:                                                         │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ ⭐⭐⭐⭐⭐ "Excellent for board prep!" - @janedoe         │   │
│ │ ⭐⭐⭐⭐ "Very helpful, could use more templates" - @bob  │   │
│ └───────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│ [Use This Agent]  [Add to Favorites ♡]  [Duplicate to My Agents] │
└─────────────────────────────────────────────────────────────────┘
```

#### 4.3 API Endpoints for Marketplace

```typescript
// New routes in agent module
GET  /api/agents/explore          // Browse public agents
GET  /api/agents/explore/stats    // Marketplace statistics
GET  /api/agents/explore/featured // Featured agents
GET  /api/agents/categories       // List categories

POST /api/agents/:id/duplicate    // Clone to user's agents
POST /api/agents/:id/favorite     // Add to favorites
DELETE /api/agents/:id/favorite   // Remove from favorites
GET  /api/agents/:id/favorite/status // Check if favorited

POST /api/agents/:id/rate         // Rate agent (1-5)
GET  /api/agents/:id/rating       // Get user's rating
DELETE /api/agents/:id/rating     // Remove rating
GET  /api/agents/:id/rating/stats // Get rating statistics
```

---

### Phase 5: Agent Memory System (Weeks 10-11)
**Focus:** Long-term memory extraction and retrieval

#### 5.1 Memory Database Schema

```sql
-- Agent Memory Table
CREATE TABLE IF NOT EXISTS public.agent_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  memory_type VARCHAR(50) NOT NULL CHECK (memory_type IN (
    'summary',    -- Conversation summaries
    'context',    -- User preferences/background
    'pattern',    -- Learned user patterns
    'fact',       -- Important facts
    'decision',   -- Previous decisions
    'preference'  -- User preferences
  )),

  content TEXT NOT NULL,
  embedding vector(1536),

  source_conversation_id UUID REFERENCES public.agent_conversations(id),
  relevance_score DECIMAL(3,2) DEFAULT 0.5,
  access_count INT DEFAULT 0,

  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE  -- Optional memory expiration
);

CREATE INDEX idx_agent_memory_embedding ON public.agent_memory
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_agent_memory_agent_user ON public.agent_memory(agent_id, user_id);
CREATE INDEX idx_agent_memory_type ON public.agent_memory(memory_type);

-- RPC Function for memory retrieval
CREATE OR REPLACE FUNCTION match_agent_memories(
  query_embedding vector,
  p_agent_id UUID,
  p_user_id UUID,
  match_count INT DEFAULT 5,
  match_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE(
  id UUID,
  content TEXT,
  memory_type VARCHAR,
  similarity FLOAT,
  relevance_score DECIMAL,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    am.id,
    am.content,
    am.memory_type,
    1 - (am.embedding <=> query_embedding) as similarity,
    am.relevance_score,
    am.created_at
  FROM agent_memory am
  WHERE am.agent_id = p_agent_id
    AND am.user_id = p_user_id
    AND (am.expires_at IS NULL OR am.expires_at > NOW())
    AND (1 - (am.embedding <=> query_embedding)) > match_threshold
  ORDER BY
    am.relevance_score DESC,
    am.embedding <=> query_embedding
  LIMIT match_count;
$$;
```

#### 5.2 Memory Extraction Service

**Edge Function:** `extract-agent-memories/index.ts`

```typescript
// Automatically extract memories after conversation ends
async function extractMemories(
  agentId: string,
  userId: string,
  conversationId: string,
  messages: Message[]
) {
  // 1. Generate conversation summary
  const summaryPrompt = `Summarize this conversation in 2-3 sentences,
    focusing on key topics discussed and outcomes:
    ${messages.map(m => `${m.role}: ${m.content}`).join('\n')}`;

  const summary = await generateCompletion(summaryPrompt);

  // 2. Extract key facts
  const factsPrompt = `Extract 3-5 key facts or preferences
    the user mentioned that would be useful to remember:
    ${messages.map(m => `${m.role}: ${m.content}`).join('\n')}
    Return as JSON array of strings.`;

  const facts = await generateCompletion(factsPrompt);

  // 3. Store memories with embeddings
  const summaryEmbedding = await generateEmbedding(summary);
  await supabase.from('agent_memory').insert({
    agent_id: agentId,
    user_id: userId,
    memory_type: 'summary',
    content: summary,
    embedding: summaryEmbedding,
    source_conversation_id: conversationId,
    relevance_score: 0.8
  });

  for (const fact of JSON.parse(facts)) {
    const factEmbedding = await generateEmbedding(fact);
    await supabase.from('agent_memory').insert({
      agent_id: agentId,
      user_id: userId,
      memory_type: 'fact',
      content: fact,
      embedding: factEmbedding,
      source_conversation_id: conversationId,
      relevance_score: 0.9
    });
  }
}
```

#### 5.3 Memory Integration in Chat

```typescript
// Enhanced agent context building
async function buildAgentContextWithMemory(
  agent: Agent,
  userId: string,
  userMessage: string
) {
  // 1. Get base personalization
  const personalization = await buildPersonalizedContext(agent, userId);

  // 2. Retrieve relevant memories
  const queryEmbedding = await generateEmbedding(userMessage);
  const { data: memories } = await supabase.rpc('match_agent_memories', {
    query_embedding: queryEmbedding,
    p_agent_id: agent.id,
    p_user_id: userId,
    match_count: 5,
    match_threshold: 0.7
  });

  // 3. Update memory access counts
  if (memories?.length) {
    const memoryIds = memories.map(m => m.id);
    await supabase.from('agent_memory')
      .update({
        access_count: supabase.raw('access_count + 1'),
        accessed_at: new Date()
      })
      .in('id', memoryIds);
  }

  // 4. Build enhanced context
  const memoryContext = memories?.length
    ? `\n\nRELEVANT MEMORIES:\n${memories.map(m =>
        `[${m.memory_type}] ${m.content}`
      ).join('\n')}`
    : '';

  return {
    systemPrompt: personalization.systemPrompt + memoryContext,
    context: personalization.context
  };
}
```

---

### Phase 6: MCP Integration (Weeks 12-13)
**Focus:** Model Context Protocol server support

#### 6.1 MCP Server Configuration

```sql
-- MCP Servers table
CREATE TABLE IF NOT EXISTS public.mcp_servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name VARCHAR(255) NOT NULL,
  description TEXT,
  server_url TEXT NOT NULL,

  transport_type VARCHAR(50) DEFAULT 'stdio' CHECK (
    transport_type IN ('stdio', 'http', 'websocket')
  ),

  auth_type VARCHAR(50) CHECK (
    auth_type IN ('none', 'api_key', 'oauth', 'bearer')
  ),
  auth_config JSONB DEFAULT '{}'::jsonb,  -- Encrypted credentials

  available_tools JSONB DEFAULT '[]'::jsonb,  -- Tool definitions

  is_global BOOLEAN DEFAULT false,  -- Available to all users
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_mcp_servers_user ON public.mcp_servers(user_id);
CREATE INDEX idx_mcp_servers_global ON public.mcp_servers(is_global) WHERE is_global = true;
```

#### 6.2 MCP Server Management UI

```
┌─────────────────────────────────────────────────────────────────┐
│ 🔌 MCP Server Configuration                                      │
├─────────────────────────────────────────────────────────────────┤
│ [+ Add MCP Server]                                               │
├─────────────────────────────────────────────────────────────────┤
│ Your MCP Servers:                                                │
│                                                                  │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ 🌐 Web Search Server                           [Active]   │   │
│ │ URL: http://localhost:3001/mcp                            │   │
│ │ Tools: web_search, fetch_url, scrape_page                 │   │
│ │ [Edit] [Test Connection] [Delete]                         │   │
│ └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ 📊 Database Query Server                       [Active]   │   │
│ │ URL: http://localhost:3002/mcp                            │   │
│ │ Tools: query_database, list_tables, describe_schema       │   │
│ │ [Edit] [Test Connection] [Delete]                         │   │
│ └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│ Global MCP Servers (Admin managed):                             │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ 📁 File System Server                          [Global]   │   │
│ │ Tools: read_file, write_file, list_directory              │   │
│ └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 4: UI Component Library Summary

### New Pages Required

| Page | Description | Priority |
|------|-------------|----------|
| `AgentMarketplace.tsx` | Public agent discovery | P2 |
| `AgentDetail.tsx` | Detailed agent view | P2 |
| `MCPServerManagement.tsx` | MCP server config | P3 |

### New Components Required

| Component | Description | Priority |
|-----------|-------------|----------|
| `AgentConversationList.tsx` | Thread list | P1 |
| `AgentConversationItem.tsx` | Thread preview | P1 |
| `AgentToolConfig.tsx` | Tool toggles | P1 |
| `AgentStreamingChat.tsx` | SSE chat | P1 |
| `AgentCard.tsx` | Marketplace card | P2 |
| `AgentRating.tsx` | Star rating | P2 |
| `AgentFavoriteButton.tsx` | Favorite toggle | P2 |
| `AgentCategoryFilter.tsx` | Category filter | P2 |
| `MCPServerCard.tsx` | MCP server display | P3 |
| `MCPServerForm.tsx` | MCP server editor | P3 |
| `AgentMemoryViewer.tsx` | Memory debug view | P3 |

### Enhanced Existing Components

| Component | Enhancement | Priority |
|-----------|-------------|----------|
| `AgentPersonalizationModal.tsx` | Add tool config | P1 |
| `AIChatInterface.tsx` | Add streaming | P1 |
| `AIAgents.tsx` page | Add marketplace link | P2 |

---

## Part 5: Provider Best Practices Applied

### Google AI (Gemini) Best Practices

1. **Context Caching** - Implement for repeated knowledge base queries
2. **Grounding** - Use Google Search grounding for factual responses
3. **Safety Settings** - Configure per-agent safety filters
4. **Multimodal** - Support image inputs in chat

### Anthropic (Claude) Best Practices

1. **System Prompts** - Use Claude's extended thinking for complex tasks
2. **Tool Use** - Implement Claude's native tool use format
3. **Context Windows** - Leverage 200K context for large documents
4. **XML Formatting** - Use XML tags for structured outputs

### Amazon Bedrock Best Practices

1. **Knowledge Bases** - Consider Bedrock KB for enterprise RAG
2. **Guardrails** - Implement content filtering
3. **Model Evaluation** - Use Bedrock's evaluation for quality
4. **Inference Profiles** - Cross-region inference for reliability

---

## Part 6: Implementation Timeline Summary

```
Week 1-2:   Phase 1 - Conversation Threading (P1)
Week 3-4:   Phase 2 - Tool Configuration (P1)
Week 5-6:   Phase 3 - Streaming Chat (P1)
Week 7-9:   Phase 4 - Agent Marketplace (P2)
Week 10-11: Phase 5 - Memory System (P2)
Week 12-13: Phase 6 - MCP Integration (P3)
```

### Resource Requirements

| Phase | Backend Hours | Frontend Hours | Total |
|-------|---------------|----------------|-------|
| Phase 1 | 16 | 24 | 40 |
| Phase 2 | 20 | 16 | 36 |
| Phase 3 | 24 | 20 | 44 |
| Phase 4 | 32 | 40 | 72 |
| Phase 5 | 24 | 12 | 36 |
| Phase 6 | 20 | 16 | 36 |
| **Total** | **136** | **128** | **264** |

---

## Part 7: Quick Wins (Implement This Week)

### 1. Add Missing Agent Columns (2 hours)

```sql
ALTER TABLE public.ai_agents
ADD COLUMN IF NOT EXISTS avatar VARCHAR(255),
ADD COLUMN IF NOT EXISTS welcome_message TEXT,
ADD COLUMN IF NOT EXISTS conversation_starters JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;
```

### 2. Update Agent Editor UI (4 hours)
- Add avatar emoji picker
- Add welcome message field
- Add conversation starters editor

### 3. Add Default Agent Selection (2 hours)
- Add "Set as Default" button to agent list
- Update useAIAgents hook to fetch default

### 4. Display Agent Stats (2 hours)
- Show usage_count in agent cards
- Add last_used_at tracking

---

## Conclusion

Your SJ Control Tower Framework has a **strong foundation** that exceeds the CollabAI guide in several areas (provider routing, personalization, integrations). The primary gaps are in:

1. **User Experience** - Conversation threading, streaming responses
2. **Social Features** - Marketplace, ratings, sharing
3. **Advanced AI** - Tool configuration, memory system, MCP

By following this phased implementation plan, you can achieve full parity with the CollabAI guide while maintaining your framework's unique advantages in provider routing and personalization.

**Recommended Priority:**
1. Start with Phase 1 (Conversation Threading) - Highest user impact
2. Then Phase 3 (Streaming) - Modern UX expectation
3. Then Phase 2 (Tool Config) - Enables advanced use cases
4. Marketplace and Memory can follow based on user demand

---

*Document prepared by Senior AI Architect review following Google, Claude, and AWS Bedrock best practices.*
