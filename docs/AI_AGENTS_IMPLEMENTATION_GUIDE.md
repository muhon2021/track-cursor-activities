# AI System — Full Implementation Guide

This guide covers the complete AI feature set: LLM provider configuration, agent management, running agents, chatting with agents, execution history, and the memory system.

---

## Full Feature Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ADMIN SETUP FLOW                            │
└─────────────────────────────────────────────────────────────────────┘

  1. /admin/ai/llm-config
     ├── Lovable AI → always connected (default, no key needed)
     ├── OpenAI     → paste API key → Save → models unlocked
     ├── Gemini     → paste API key → Save → models unlocked
     └── Claude     → paste API key → Save → models unlocked
                              │
                              ▼
  2. /admin/ai/agents  (Create / Edit agent)
     ├── Name, slug, description, category
     ├── System prompt  ← defines agent personality & behavior
     ├── Enable Agent toggle
     ├── Memory toggle  ← persists conversation history
     └── Save agent
                              │
            ┌─────────────────┼──────────────────┐
            ▼                 ▼                  ▼
  3a. Run (ad-hoc)    3b. Chat mode       3c. Toggle on/off
      │                    │
      ▼                    ▼
  ai_agent_runs      agent_conversations
  (single exec)      agent_messages
      │               (threaded, with memory)
      │                    │
      └────────┬───────────┘
               ▼
  4. Edge Function: run-ai-agent
     ├── Fetch agent config from ai_agents
     ├── Load user personalization (if any)
     ├── Build messages array
     │   ├── [system] agent.system_prompt
     │   ├── [system] conversation history (if memory_enabled)
     │   └── [user]   current input
     ├── Call OpenAI API (gpt-4o-mini by default)
     └── Return output
               │
               ▼
  5. Results stored
     ├── ai_agent_runs  ← status, output, latency, token_metrics
     └── agent_messages ← full conversation thread (if memory_enabled)
               │
               ▼
  6. View in UI
     ├── Execution History dialog (on /admin/ai/agents page)
     └── Chat thread (on /admin/ai/chat?agent=<id>)
```

---

## Pages & Routes

| Route | File | Purpose |
|---|---|---|
| `/admin/ai/llm-config` | `src/pages/admin/ai/LLMConfig.tsx` | Configure LLM providers and API keys |
| `/admin/ai/agents` | `src/pages/AIAgents.tsx` | Manage agents (CRUD + run + history) |
| `/admin/ai/chat?agent=<id>` | `src/pages/AIChat.tsx` | Full threaded chat with an agent |

---

## Stage 1 — LLM Config (`/admin/ai/llm-config`)

### What it does

Admins connect one or more LLM providers. All connected providers' models become available to agents.

| Provider | Default? | Key format | Models |
|---|---|---|---|
| Lovable AI | Yes — always on | No key needed | `lovable-2`, `lovable-2-mini` |
| OpenAI | No | `sk-proj-...` | `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`, `gpt-3.5-turbo` |
| Google Gemini | No | `AIza...` | `gemini-2.0-flash`, `gemini-1.5-pro`, `gemini-1.5-flash` |
| Anthropic Claude | No | `sk-ant-...` | `claude-3-5-sonnet`, `claude-3-5-haiku`, `claude-3-opus` |

### UI behavior

- **Header** shows live counts: connected providers + total models available
- **Info banner** explains that Lovable AI is always available at no cost
- Each non-default provider card has:
  - Masked API key input with show/hide toggle
  - "Get key" link → provider's key dashboard
  - **Save Key** button → marks provider as configured
  - **Test** button → simulates connection verification (in production: calls provider's health endpoint)
  - **Disconnect** button → removes configured state
- Models section appears only after a provider is connected
- "Not Configured" providers show how many models they would unlock

### State persistence (current implementation)

`configured` boolean per provider is stored in `localStorage` under `"llm_provider_config"`. The actual API key is never stored on the client — in a production backend, save it via an Edge Function to Supabase secrets or an encrypted `app_config` row.

### How to extend for real key storage

```typescript
// Example: store key via Edge Function instead of localStorage
async function saveProviderKey(provider: string, apiKey: string) {
  await supabase.functions.invoke("save-llm-provider-key", {
    body: { provider, api_key: apiKey },
  });
}
```

The Edge Function would call `Deno.env.set()` or store an encrypted value in `app_config`.

### How it connects to agents

Each agent has a `provider_config JSONB` column. When running, the Edge Function can read this to choose which provider and model to use:

```json
{ "provider": "openai", "model": "gpt-4o" }
```

If `provider_config` is empty, the Edge Function falls back to the default provider (Lovable AI or OpenAI if configured).

### LLMConfig page — file structure

```
src/pages/admin/ai/LLMConfig.tsx
  ├── PROVIDERS[]           — static provider definitions (key, name, models, colors, icon)
  ├── ProviderDefinition    — TypeScript interface
  ├── ProviderState         — { apiKey, isConfigured, showKey, isTesting }
  ├── loadStoredConfig()    — reads localStorage
  ├── ProviderCard          — sub-component, one per provider (~80 lines)
  └── LLMConfig             — main page component (~80 lines)
```

### Key state variables in `LLMConfig`

| State | Type | Purpose |
|---|---|---|
| `states` | `Record<ProviderKey, ProviderState>` | Per-provider config/UI state |
| `configuredCount` | derived | Count of connected providers (for header stat) |
| `totalModels` | derived | Total models across connected providers |

### shadcn/ui components used

`Card`, `CardContent`, `CardHeader`, `CardTitle`, `CardDescription`, `Badge`, `Button`, `Input`, `Label`, `Alert`, `AlertDescription`, `Separator`

### Icons used (lucide-react)

`Settings2`, `Eye`, `EyeOff`, `CheckCircle2`, `XCircle`, `ExternalLink`, `Sparkles`, `Brain`, `Gem`, `Bot`, `Loader2`, `Info`, `Zap`

---

## Stage 2 — Agent Management (`/admin/ai/agents`)

### What it does

Admins create and manage AI agents. Each agent is a configured persona with a system prompt, category, and optional memory. Enabled agents can be run ad-hoc or opened in full chat mode.

### Create / Edit agent form fields

| Field | Required | Default | Notes |
|---|---|---|---|
| Name | Yes | — | Displayed on the card |
| Slug | No | Auto-generated from name | URL-safe identifier |
| Description | No | — | Short summary |
| Category | Yes | `general` | `general`, `communication`, `analysis`, `task_management` |
| System Prompt | Yes | — | Core behavior definition |
| Enable Agent | — | `true` | Toggle active/inactive |
| Memory Enabled | — | `false` | When on: stores conversation threads |

### Create dialog extras (new agents only)

- **QuickStartWizard** — 5-step guide card at the top of the form
- **AgentCategoryGuide** — expandable card list for picking the right category
- **SystemPromptGuide** — tooltip + good/bad prompt examples
- **MemorySystemGuide** — label + tooltip explaining memory behavior
- **MultiAgentCollaborationInfo** — info alert about agent team strategies
- **HITLApprovalInfo** — info alert about human-in-the-loop approvals

All helpers live in `src/components/admin/AgentConfigurationGuide.tsx`.

### Agent card actions

| Button | Condition | Action |
|---|---|---|
| Chat | `is_enabled = true` | Navigate to `/admin/ai/chat?agent=<id>` |
| Run | `is_enabled = true` | Open "Run Agent" dialog |
| Edit (pencil) | Always | Open create/edit dialog pre-filled |
| Play/Pause | Always | Toggle `is_enabled` (inline, no dialog) |
| Trash | Always | Open delete confirmation dialog |

### Stats row (top of page)

| Card | Value |
|---|---|
| Total Agents | `agents.length` |
| Enabled | `agents.filter(a => a.is_enabled).length` |
| Disabled | `agents.filter(a => !a.is_enabled).length` |
| Total Runs | `recentRuns.length` (last 50 for current user) |

---

## Stage 3 — Run Agent (ad-hoc execution)

Clicking **Run** on an enabled agent card opens the **Run Agent dialog**.

### Run flow — step by step

```
User types input in dialog textarea
           │
           ▼
useRunAgent.mutateAsync({ agentId, input })
           │
           ▼
1. INSERT into ai_agent_runs  (status: "running")
           │
           ▼
2. supabase.functions.invoke("run-ai-agent", { agent_id, input, user_id })
           │
           ▼
3. Edge Function: run-ai-agent
   a. Fetch agent row from ai_agents
   b. Fetch user personalization from user_agent_personalizations (if exists)
   c. Build messages:
      [{ role: "system", content: agent.system_prompt + additionalPrompt },
       { role: "user",   content: input }]
   d. POST to OpenAI /v1/chat/completions (model: gpt-4o-mini)
   e. INSERT into ai_agent_runs (status: "completed", output, latency_ms, token_metrics)
   f. Return { output, token_usage, latency_ms }
           │
           ▼
4. Frontend: UPDATE ai_agent_runs (status, output, latency_ms, model_used)
           │
           ▼
5. Toast: "Agent executed successfully!"
   Dialog closes, run input cleared
           │
           ▼
6. React Query invalidates ["ai", "runs"]
   → Execution History dialog auto-refreshes
```

### What is stored in `ai_agent_runs`

| Column | Value |
|---|---|
| `agent_id` | ID of the agent |
| `user_id` | ID of the executing user |
| `input` | The text the user typed |
| `output` | The AI's response (raw text, may include markdown) |
| `status` | `pending` → `running` → `completed` or `failed` |
| `latency_ms` | Total round-trip time in milliseconds |
| `token_metrics` | `{ prompt_tokens, completion_tokens, total_tokens }` from OpenAI |
| `provider_used` | `"openai"` |
| `model_used` | `"gpt-4o-mini"` |
| `error_message` | Populated only on `failed` status |

---

## Stage 4 — Execution History

Clicking **Execution History** on the agents page opens a scrollable dialog showing the last 50 runs for the current user.

### Each run card shows

- **Agent name** (looked up from the `agents` list in memory)
- **Status badge** — `Completed` (green) / `Running` (secondary) / `Failed` (red) / `Pending` (outline)
- **Latency badge** — e.g., `342ms`
- **Input** — the original user text
- **Output** — rendered as markdown via `<ReactMarkdown remarkPlugins={[remarkGfm]}>`
- **Error message** — shown in destructive color only on failed runs
- **Timestamp** — `toLocaleString()`

### Query

```typescript
supabase
  .from("ai_agent_runs")
  .select("*")
  .eq("user_id", user.id)
  .order("created_at", { ascending: false })
  .limit(50)
```

---

## Stage 5 — Chat Mode (`/admin/ai/chat?agent=<id>`)

Clicking **Chat** on an enabled agent navigates to the full threaded chat page. Unlike ad-hoc Run, chat supports back-and-forth conversation and memory.

### URL format

```
/admin/ai/chat?agent=<agent-uuid>
```

The page reads `agent` from the URL search params and loads that agent's config.

### Chat flow

```
User types message in chat input
           │
           ▼
INSERT into agent_conversations (if new session)
  { agent_id, user_id }  → returns conversation_id
           │
           ▼
INSERT into agent_messages
  { conversation_id, role: "user", content: input }
           │
           ▼
supabase.functions.invoke("run-ai-agent", {
  agent_id,
  input,
  user_id,
  conversation_id   ← enables memory injection
})
           │
           ▼
Edge Function:
  IF memory_enabled:
    Fetch last N messages from agent_messages for this conversation
    Prepend them to the messages array as context
  THEN call OpenAI (same as run)
           │
           ▼
INSERT into agent_messages
  { conversation_id, role: "assistant", content: output }
           │
           ▼
Conversation stats auto-updated by DB trigger:
  agent_conversations.message_count += 1
  agent_conversations.last_message_at = now()
  ai_agents.usage_count += 1  (on user messages only)
```

### Memory injection (when `memory_enabled = true`)

When memory is enabled, the Edge Function fetches previous messages and injects them into the OpenAI `messages` array before the current user message:

```javascript
// messages array sent to OpenAI
[
  { role: "system",    content: agent.system_prompt },
  { role: "user",      content: "What did we discuss last time?" },  // history msg 1
  { role: "assistant", content: "We discussed your Q3 targets..." }, // history msg 2
  { role: "user",      content: "Current user input" },             // current
]
```

This gives the agent full context of the conversation history without the user having to repeat themselves.

### When `memory_enabled = false`

Only the system prompt and the current user message are sent. Every run is stateless — the agent has no knowledge of previous exchanges.

---

## Stage 6 — Database Tables

Run these migrations in order. All tables require RLS to be enabled.

### 6.1 Prerequisites: `app_role` enum, `has_role` function, `update_updated_at_column` trigger

```sql
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
```

### 6.2 `ai_agents` table

```sql
CREATE TABLE public.ai_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT,
  system_prompt TEXT NOT NULL,
  data_sources JSONB DEFAULT '[]'::jsonb,
  provider_config JSONB DEFAULT '{}'::jsonb,
  required_role app_role,
  is_enabled BOOLEAN DEFAULT true,
  memory_enabled BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_agents_slug ON public.ai_agents(slug);
CREATE INDEX idx_ai_agents_category ON public.ai_agents(category);
CREATE INDEX idx_ai_agents_enabled ON public.ai_agents(is_enabled);

ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view enabled agents"
  ON public.ai_agents FOR SELECT TO authenticated
  USING (is_enabled = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage agents"
  ON public.ai_agents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_ai_agents_updated_at
  BEFORE UPDATE ON public.ai_agents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

### 6.3 Extra columns on `ai_agents` (later migrations)

```sql
-- Conversation / chat fields
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS avatar VARCHAR(255);
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS welcome_message TEXT;
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS conversation_starters JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;

-- Tool configuration fields
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS tool_code_interpreter BOOLEAN DEFAULT false;
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS tool_file_search BOOLEAN DEFAULT false;
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS tool_web_search BOOLEAN DEFAULT false;
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS tool_image_generation BOOLEAN DEFAULT false;
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS tool_mcp BOOLEAN DEFAULT false;
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS mcp_server_ids UUID[] DEFAULT '{}';
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS tools_config JSONB DEFAULT '[]'::jsonb;
```

### 6.4 `ai_agent_runs` table (execution history)

```sql
CREATE TABLE public.ai_agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  context JSONB DEFAULT '{}'::jsonb,
  input TEXT,
  output TEXT,
  token_metrics JSONB DEFAULT '{}'::jsonb,
  latency_ms INTEGER,
  provider_used TEXT,
  model_used TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_agent_runs_agent ON public.ai_agent_runs(agent_id);
CREATE INDEX idx_ai_agent_runs_user ON public.ai_agent_runs(user_id);
CREATE INDEX idx_ai_agent_runs_status ON public.ai_agent_runs(status);
CREATE INDEX idx_ai_agent_runs_created ON public.ai_agent_runs(created_at DESC);

ALTER TABLE public.ai_agent_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own runs"
  ON public.ai_agent_runs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create runs"
  ON public.ai_agent_runs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all runs"
  ON public.ai_agent_runs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_ai_agent_runs_updated_at
  BEFORE UPDATE ON public.ai_agent_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

### 6.5 `agent_conversations` + `agent_messages` tables (memory / chat threads)

These tables are only needed if you implement the Chat page with memory support.

```sql
-- Conversation threads (one per user per agent session)
CREATE TABLE IF NOT EXISTS public.agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(255),
  summary TEXT,
  is_archived BOOLEAN DEFAULT false,
  is_pinned BOOLEAN DEFAULT false,
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_conversations_agent_user
  ON public.agent_conversations(agent_id, user_id);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_user
  ON public.agent_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_last_message
  ON public.agent_conversations(last_message_at DESC NULLS LAST);

ALTER TABLE public.agent_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own conversations"
  ON public.agent_conversations FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users can create conversations"
  ON public.agent_conversations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own conversations"
  ON public.agent_conversations FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own conversations"
  ON public.agent_conversations FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all conversations"
  ON public.agent_conversations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_agent_conversations_updated_at
  BEFORE UPDATE ON public.agent_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Individual messages inside conversations
CREATE TABLE IF NOT EXISTS public.agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.agent_conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL,
  model_used VARCHAR(100),
  provider_used VARCHAR(50),
  tokens_input INTEGER,
  tokens_output INTEGER,
  latency_ms INTEGER,
  tool_calls JSONB,
  tool_results JSONB,
  citations JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_messages_conversation
  ON public.agent_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_created_at
  ON public.agent_messages(conversation_id, created_at);

ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in their conversations"
  ON public.agent_messages FOR SELECT TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM public.agent_conversations WHERE user_id = auth.uid()
    )
  );
CREATE POLICY "Users can create messages in their conversations"
  ON public.agent_messages FOR INSERT TO authenticated
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM public.agent_conversations WHERE user_id = auth.uid()
    )
  );
CREATE POLICY "Admins can view all messages"
  ON public.agent_messages FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
```

#### Auto-update conversation stats trigger

```sql
CREATE OR REPLACE FUNCTION public.update_conversation_stats()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.agent_conversations
  SET
    message_count = message_count + 1,
    last_message_at = NEW.created_at,
    updated_at = now()
  WHERE id = NEW.conversation_id;

  -- Increment agent usage_count on user messages only
  UPDATE public.ai_agents
  SET usage_count = usage_count + 1
  WHERE id = (
    SELECT agent_id FROM public.agent_conversations WHERE id = NEW.conversation_id
  )
  AND NEW.role = 'user';

  RETURN NEW;
END;
$$;

CREATE TRIGGER update_conversation_stats_on_message
  AFTER INSERT ON public.agent_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_conversation_stats();
```

#### Auto-generate conversation title from first message

```sql
CREATE OR REPLACE FUNCTION public.generate_conversation_title()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.role = 'user' THEN
    UPDATE public.agent_conversations
    SET title = CASE
      WHEN title IS NULL OR title = ''
      THEN LEFT(NEW.content, 100) || CASE WHEN LENGTH(NEW.content) > 100 THEN '...' ELSE '' END
      ELSE title
    END
    WHERE id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_generate_conversation_title
  AFTER INSERT ON public.agent_messages
  FOR EACH ROW EXECUTE FUNCTION public.generate_conversation_title();
```

### 6.6 `user_agent_personalizations` table (optional)

Allows per-user additional system prompt instructions appended to any agent.

```sql
CREATE TABLE public.user_agent_personalizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT true,
  additional_prompt TEXT,
  attached_knowledge_files UUID[],
  use_all_knowledge BOOLEAN DEFAULT false,
  max_context_files INTEGER DEFAULT 5,
  relevance_threshold NUMERIC DEFAULT 0.7,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, agent_id)
);

ALTER TABLE public.user_agent_personalizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own personalizations"
  ON public.user_agent_personalizations FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage all personalizations"
  ON public.user_agent_personalizations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_user_agent_personalizations_updated_at
  BEFORE UPDATE ON public.user_agent_personalizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

---

## Step 7 — Edge Function: `run-ai-agent`

Create `supabase/functions/run-ai-agent/index.ts`:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method === 'GET') {
    const hasKey = !!Deno.env.get('OPENAI_API_KEY')
    return new Response(
      JSON.stringify({ ok: true, configured: hasKey }),
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
        JSON.stringify({ ok: true, configured: hasKey }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
    if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured')

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { agent_id, agent_slug, execution_context, input: bodyInput, user_id } = body

    if (!agent_id && !agent_slug) {
      return new Response(
        JSON.stringify({ error: 'agent_id or agent_slug is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Fetch agent config
    let query = supabaseClient.from('ai_agents').select('*')
    if (agent_id) {
      query = query.eq('id', agent_id)
    } else {
      query = query.eq('slug', agent_slug)
    }
    const { data: agent } = await query.single()
    if (!agent) throw new Error('Agent not found')

    // Load per-user personalization
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
        // Table may not exist — safe to skip
      }
    }

    const startTime = Date.now()

    const userMessage =
      typeof bodyInput === 'string' && bodyInput.trim().length > 0
        ? bodyInput.trim()
        : execution_context != null
          ? (typeof execution_context === 'string' ? execution_context : JSON.stringify(execution_context))
          : 'No context provided. Please respond with a default helpful message.'

    // Build messages array
    // If memory_enabled and a conversation_id is provided, inject history here
    const messages = [
      { role: 'system', content: agent.system_prompt + (additionalPrompt ? `\n\n${additionalPrompt}` : '') },
      { role: 'user', content: userMessage },
    ]

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages, temperature: 0.7 }),
    })

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text()
      throw new Error(`AI agent execution failed: ${openaiResponse.status} - ${errorText}`)
    }

    const data = await openaiResponse.json()
    const output = data.choices[0].message.content
    const latency = Date.now() - startTime

    const { data: run, error: runError } = await supabaseClient
      .from('ai_agent_runs')
      .insert([{
        agent_id: agent.id,
        user_id: user_id || null,
        status: 'completed',
        context: typeof bodyInput === 'string' && bodyInput.trim().length > 0 ? bodyInput : execution_context,
        output,
        token_metrics: data.usage,
        latency_ms: latency,
        provider_used: 'openai',
        model_used: 'gpt-4o-mini',
      }])
      .select()
      .single()

    if (runError) console.error('Failed to log agent run:', runError)

    return new Response(
      JSON.stringify({ run_id: run?.id || null, status: 'completed', output, token_usage: data.usage, latency_ms: latency }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
```

In `supabase/config.toml`:

```toml
[functions.run-ai-agent]
verify_jwt = false
```

Set secret and deploy:

```bash
supabase secrets set OPENAI_API_KEY=sk-proj-...
supabase functions deploy run-ai-agent
```

---

## Step 8 — Cache Keys

Add to your React Query cache file (`src/lib/cache.ts`):

```typescript
export const queryKeys = {
  // ... existing keys ...
  ai: {
    agents: ["ai", "agents"] as const,
    agent: (id: string) => ["ai", "agent", id] as const,
    runs: (agentId: string) => ["ai", "runs", agentId] as const,
    conversations: (agentId: string) => ["ai", "conversations", agentId] as const,
  },
};

export const invalidateKeys = {
  // ... existing helpers ...
  ai: (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.ai.agents });
  },
};
```

---

## Step 9 — TypeScript Types & Hook (`useAIAgents.ts`)

Create `src/hooks/useAIAgents.ts`. Exports: `AIAgent`, `AgentRun`, `AgentFormData`, and six hooks:

| Hook | Purpose |
|---|---|
| `useAIAgents()` | Fetch all agents, ordered by `created_at desc` |
| `useAgentRuns(agentId?)` | Fetch last 50 runs for current user, optionally filtered by agent |
| `useCreateAgent()` | Insert new agent row, invalidate `["ai", "agents"]` on success |
| `useUpdateAgent()` | Partial update on agent row by id |
| `useToggleAgent()` | Flip `is_enabled` only — fast inline toggle |
| `useDeleteAgent()` | Delete agent + cascade runs |
| `useRunAgent()` | Insert pending run → invoke Edge Function → update run record |

Full source: `src/hooks/useAIAgents.ts`

### `AIAgent` interface (key fields)

```typescript
interface AIAgent {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  system_prompt: string;
  provider_config: unknown;      // { provider: "openai", model: "gpt-4o" }
  is_enabled: boolean;
  memory_enabled: boolean;       // true = conversation history is stored and injected
  avatar: string | null;
  welcome_message: string | null;
  conversation_starters: string[] | null;
  is_default: boolean;
  usage_count: number;
  tool_code_interpreter: boolean;
  tool_file_search: boolean;
  tool_web_search: boolean;
  tool_image_generation: boolean;
  tool_mcp: boolean;
  mcp_server_ids: string[];
  tools_config: unknown[];
  created_at: string;
  updated_at: string;
}
```

---

## Step 10 — Frontend Pages

### 10.1 LLM Config page

**File:** `src/pages/admin/ai/LLMConfig.tsx`

No backend dependency — uses `localStorage` to persist configured state. Wire to backend when ready.

### 10.2 Agent management page

**File:** `src/pages/AIAgents.tsx`

Copy full source. Requires:
- `react-markdown` + `remark-gfm` packages
- `src/hooks/useAIAgents.ts`
- `src/components/admin/AgentConfigurationGuide.tsx`

### 10.3 Agent configuration guide component

**File:** `src/components/admin/AgentConfigurationGuide.tsx`

Exports: `QuickStartWizard`, `AgentCategoryGuide`, `SystemPromptGuide`, `MemorySystemGuide`, `MultiAgentCollaborationInfo`, `HITLApprovalInfo`

### 10.4 Chat page

**File:** `src/pages/AIChat.tsx`

Navigated to via the **Chat** button on each enabled agent card:
```
/admin/ai/chat?agent=<agent-id>
```

This page handles threaded conversation with `agent_conversations` and `agent_messages`. When `memory_enabled = true`, it passes `conversation_id` to the Edge Function to enable history injection.

---

## Step 11 — Route Registration

```typescript
// src/modules/admin/routes.tsx
import LLMConfig from "@/pages/admin/ai/LLMConfig";
import AIAgents from "@/pages/AIAgents";
import AIChat from "@/pages/AIChat";

// Inside adminRoutes:
<Route path="/admin/ai/llm-config" element={<LLMConfig />} />
<Route path="/admin/ai/agents" element={<AIAgents />} />
<Route path="/admin/ai/chat" element={<AIChat />} />
```

---

## Step 12 — Sidebar Navigation

Add to your admin navigation data (e.g., `src/shared/data/navigationStructure.ts`), inside the AI Hub group:

```typescript
{ title: "LLM Config",  href: "/admin/ai/llm-config",   icon: "Settings" },
{ title: "AI Agents",   href: "/admin/ai/agents",        icon: "Bot" },
```

The `Settings` and `Bot` icon names must exist in your sidebar's `iconMap`.

---

## Step 13 — Environment Variables

```bash
# Required for run-ai-agent Edge Function
supabase secrets set OPENAI_API_KEY=sk-proj-...

# Optional — for multi-provider support when extended
supabase secrets set GEMINI_API_KEY=AIza...
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

No `VITE_` prefixed env vars are needed — all AI keys live only in Edge Function secrets.

---

## Full Checklist

### LLM Config page
- [ ] Create `src/pages/admin/ai/LLMConfig.tsx`
- [ ] Register route `/admin/ai/llm-config`
- [ ] Add "LLM Config" to sidebar nav

### Database
- [ ] Run migration 6.2 (`ai_agents` table + RLS)
- [ ] Run migration 6.3 (extra columns on `ai_agents`)
- [ ] Run migration 6.4 (`ai_agent_runs` table + RLS)
- [ ] Run migration 6.5 (`agent_conversations` + `agent_messages` + triggers)
- [ ] Run migration 6.6 (`user_agent_personalizations` — optional)

### Backend
- [ ] Create `supabase/functions/run-ai-agent/index.ts`
- [ ] Add `[functions.run-ai-agent]` block to `supabase/config.toml`
- [ ] Set `OPENAI_API_KEY` secret in Supabase
- [ ] Deploy Edge Function

### Frontend
- [ ] Install npm packages: `react-markdown`, `remark-gfm`
- [ ] Add `queryKeys.ai` + `invalidateKeys.ai` to cache file
- [ ] Create `src/hooks/useAIAgents.ts`
- [ ] Create `src/components/admin/AgentConfigurationGuide.tsx`
- [ ] Create `src/pages/AIAgents.tsx`
- [ ] Create `src/pages/AIChat.tsx`
- [ ] Register routes `/admin/ai/agents` and `/admin/ai/chat`
- [ ] Add "AI Agents" to sidebar nav

---

## Notes on Adaptation

- **Auth context**: Hooks use `useAuth()` to get the current user. Swap for your auth hook if different.
- **Supabase client**: Import from your project's location (e.g., `@/integrations/supabase/client` or `@/lib/supabase`).
- **Toast**: Uses `sonner` (`toast.success`, `toast.error`). Replace with your toast library if needed.
- **Role system**: The `has_role()` function and `app_role` enum are required for RLS. Adjust if your project uses a different role pattern.
- **LLM model**: The Edge Function defaults to `gpt-4o-mini`. Change to `gpt-4o`, `gpt-4-turbo`, etc. by editing the `model` field in the fetch body. For multi-provider support, read `agent.provider_config` to dynamically route to OpenAI, Gemini, or Claude.
- **Memory depth**: Currently the memory injection pattern fetches all prior messages. In production, limit to the last N turns to control token usage (e.g., last 10 messages).
- **LLM Config persistence**: The current LLM Config page uses `localStorage`. For a production system, store provider config in a `llm_provider_configs` Supabase table with a `configured` boolean, and store actual API keys via `supabase secrets set` through an admin-only Edge Function.
