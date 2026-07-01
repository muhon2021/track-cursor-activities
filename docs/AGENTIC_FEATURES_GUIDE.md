# Agentic AI Features Guide

## Overview

This guide covers the new **Tool Orchestration** and **Agent Memory System** capabilities that transform Control Tower agents from simple chat assistants into autonomous, context-aware AI agents.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Tool Orchestration](#tool-orchestration)
3. [Agent Memory System](#agent-memory-system)
4. [Migration Guide](#migration-guide)
5. [Usage Examples](#usage-examples)
6. [API Reference](#api-reference)
7. [Troubleshooting](#troubleshooting)

---

## Quick Start

### 1. Apply Migrations

Run the migration script to set up all required database tables:

```bash
# Make sure you're in the project root
cd /path/to/sj-control-tower-framework

# Run the migration script
./scripts/apply-agentic-migrations.sh
```

This will:
- Apply 3 new migrations (MCP tools, execution framework, memory system)
- Regenerate TypeScript types
- Remove temporary type assertions
- Validate the setup

### 2. Verify Setup

Run the validation script in Supabase SQL Editor:

```sql
-- Copy and paste the contents of:
-- scripts/validate-agentic-setup.sql
```

Expected output:
- ✅ All 9 agentic tables exist
- ✅ 5 helper functions created
- ✅ pgvector extension installed
- ✅ 10+ pre-seeded Control Tower tools

### 3. Enable for an Agent

```typescript
// In your agent configuration UI or API
await supabase
  .from('ai_agents')
  .update({
    memory_enabled: true,        // Enable memory system
    tool_mcp: true,               // Enable MCP tools
    mcp_server_ids: [serverId],   // Link to MCP servers
  })
  .eq('id', agentId)
```

---

## Tool Orchestration

### What It Does

Tool Orchestration enables agents to:
- **Dynamically discover** and select appropriate tools
- **Chain tools together** in multi-step workflows
- **Execute in parallel** when steps are independent
- **Retry automatically** on failures
- **Track execution** with detailed logs

### Architecture

```
┌─────────────────┐
│  User Request   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐       ┌──────────────┐
│ Agent Creates   │──────▶│ Execution    │
│ Execution Plan  │       │ Plan Table   │
└────────┬────────┘       └──────────────┘
         │
         ▼
┌─────────────────┐       ┌──────────────┐
│ Steps Generated │──────▶│ Execution    │
│ with Tools      │       │ Steps Table  │
└────────┬────────┘       └──────────────┘
         │
         ▼
┌─────────────────┐       ┌──────────────┐
│ Execute Tools   │──────▶│ MCP Tool     │
│ via MCP         │       │ Executions   │
└────────┬────────┘       └──────────────┘
         │
         ▼
┌─────────────────┐
│ Return Results  │
└─────────────────┘
```

### Pre-Seeded Control Tower Tools

10 tools are automatically available:

| Tool Name | Description | Parameters |
|-----------|-------------|------------|
| `create_task` | Create a new task | title, description, priority |
| `search_tasks` | Search existing tasks | query, status, assigned_to |
| `update_task` | Update task details | task_id, updates |
| `schedule_meeting` | Schedule a meeting | title, date, participants |
| `get_meeting_transcript` | Retrieve meeting notes | meeting_id |
| `search_knowledge` | Semantic knowledge search | query, limit |
| `create_knowledge_article` | Create knowledge entry | title, content, tags |
| `create_deal` | Create sales deal | title, amount, client |
| `search_contacts` | Find contacts | query, filters |
| `create_project` | Create new project | name, description, team |
| `get_project_status` | Get project health | project_id |

### Using Tool Orchestration

#### React Hook Example

```typescript
import { useExecuteTool, useAgentTools } from '@/hooks/useAgentTools'

function MyComponent() {
  const { data: tools } = useAgentTools(agentId)
  const executeTool = useExecuteTool()

  const handleExecute = async () => {
    const result = await executeTool.mutateAsync({
      tool_id: 'uuid-of-tool',
      input_parameters: {
        title: 'New Task',
        priority: 'high',
      },
      agent_id: agentId,
    })

    console.log('Result:', result.output)
  }

  return (
    <div>
      {tools?.map(tool => (
        <ToolCard key={tool.id} tool={tool} />
      ))}
    </div>
  )
}
```

#### Edge Function Example

```typescript
// From another edge function or workflow
const response = await fetch(
  `${SUPABASE_URL}/functions/v1/execute-mcp-tool`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tool_id: 'uuid-of-create-task-tool',
      input_parameters: {
        title: 'Follow up with client',
        description: 'Send proposal',
        priority: 'high',
      },
      agent_id: agentId,
      user_id: userId,
      execution_context: {
        source: 'automated-workflow',
      },
    }),
  }
)

const result = await response.json()
// result.success === true
// result.output contains tool result
```

### Multi-Step Execution

Create complex workflows with dependencies:

```typescript
// Create execution plan
const { data: plan } = await supabase
  .from('agent_execution_plans')
  .insert({
    agent_id: agentId,
    user_id: userId,
    goal: 'Create project and assign tasks',
    status: 'planning',
  })
  .select()
  .single()

// Create steps
const steps = [
  {
    plan_id: plan.id,
    step_number: 1,
    tool_name: 'create_project',
    parameters: { name: 'Q1 Campaign', description: '...' },
    can_run_parallel: false,
  },
  {
    plan_id: plan.id,
    step_number: 2,
    tool_name: 'create_task',
    parameters: { title: 'Design mockups', project_id: '{{step_1.project_id}}' },
    depends_on: [1], // Wait for step 1
    can_run_parallel: false,
  },
  {
    plan_id: plan.id,
    step_number: 3,
    tool_name: 'create_task',
    parameters: { title: 'Write copy', project_id: '{{step_1.project_id}}' },
    depends_on: [1], // Wait for step 1
    can_run_parallel: true, // Can run parallel with step 2
  },
]

await supabase.from('agent_execution_steps').insert(steps)
```

### Viewing Execution History

```typescript
import { AgentExecutionViewer } from '@/components/agent/AgentExecutionViewer'

function ExecutionHistoryPage() {
  return (
    <div>
      <h1>Agent Execution History</h1>
      <AgentExecutionViewer
        agentId={agentId}
        showReasoningTraces={true}
      />
    </div>
  )
}
```

---

## Agent Memory System

### What It Does

The Memory System enables agents to:
- **Remember conversations** across sessions
- **Learn user preferences** from interactions
- **Store important facts** about users and their work
- **Retrieve relevant context** using semantic search
- **Improve over time** through feedback

### Memory Types

| Type | Purpose | Lifecycle | Example |
|------|---------|-----------|---------|
| **Short-term** | Recent context | 7 days → long-term | "User is working on Q3 budget" |
| **Long-term** | Persistent facts | Permanent | "User prefers bullet-point summaries" |
| **Episodic** | Key events | Permanent | "Completed major product launch 2024-01" |
| **Semantic** | General knowledge | Permanent | "User's company uses Salesforce" |

### Memory Categories

- `preference` - User communication and work preferences
- `fact` - Important facts about user or their context
- `skill` - User's skills and capabilities
- `goal` - User's objectives and goals
- `relationship` - Information about user's team/clients
- `context` - Project or domain context

### Architecture

```
┌──────────────┐
│ Conversation │
└──────┬───────┘
       │
       ▼
┌────────────────┐     ┌─────────────────┐
│ Semantic Search│────▶│ Retrieve        │
│ for Memories   │     │ Top 5-10        │
└────────────────┘     └────────┬────────┘
                                │
                                ▼
                       ┌────────────────┐
                       │ Inject into    │
                       │ System Prompt  │
                       └────────┬───────┘
                                │
                                ▼
                       ┌────────────────┐
                       │ Agent Responds │
                       │ with Context   │
                       └────────┬───────┘
                                │
                                ▼
                       ┌────────────────┐
                       │ Extract New    │
                       │ Memories       │
                       └────────────────┘
```

### Using Memory System

#### Retrieve Memories

```typescript
import { useRetrieveMemories } from '@/hooks/useAgentMemory'

function ChatComponent() {
  const retrieveMemories = useRetrieveMemories()

  const handleSendMessage = async (message: string) => {
    // Get relevant memories
    const result = await retrieveMemories.mutateAsync({
      agent_id: agentId,
      query: message,
      memory_types: ['short_term', 'long_term', 'episodic'],
      limit: 5,
      similarity_threshold: 0.7,
      include_recent: true,
    })

    console.log('Relevant memories:', result.memories)
    // result.memories[0].content
    // result.memories[0].similarity (0.0 - 1.0)
    // result.memories[0].importance_score
  }

  return <ChatInterface onSend={handleSendMessage} />
}
```

#### Extract Memories

```typescript
import { useExtractMemories } from '@/hooks/useAgentMemory'

function ConversationEnd() {
  const extractMemories = useExtractMemories()

  const handleExtract = async () => {
    const result = await extractMemories.mutateAsync({
      agent_id: agentId,
      conversation_id: conversationId,
      auto_extract: true, // Uses AI to extract automatically
    })

    console.log(`Stored ${result.stored_count} memories`)
  }

  return <Button onClick={handleExtract}>Save Memories</Button>
}
```

#### Manual Memory Storage

```typescript
// Store specific memory
await supabase
  .from('agent_memories')
  .insert({
    agent_id: agentId,
    user_id: userId,
    memory_type: 'long_term',
    memory_category: 'preference',
    content: 'User prefers detailed technical explanations',
    importance_score: 0.9,
    source_type: 'explicit',
    is_active: true,
  })
```

#### User Preferences

```typescript
import { useSetPreference } from '@/hooks/useAgentMemory'

function PreferencesPanel() {
  const setPreference = useSetPreference()

  const savePreference = async () => {
    await setPreference.mutateAsync({
      agent_id: agentId,
      preference_key: 'communication_style',
      preference_value: {
        format: 'bullet_points',
        tone: 'professional',
        detail_level: 'high',
      },
      learned_from: 'explicit',
      confidence_score: 1.0,
    })
  }

  return <Button onClick={savePreference}>Save Preferences</Button>
}
```

### Memory Maintenance

#### Consolidation (Run Daily)

```bash
# Set up cron job to run daily
# In Supabase Dashboard > Database > Cron Jobs

SELECT cron.schedule(
  'consolidate-memories-daily',
  '0 2 * * *',  -- 2 AM daily
  $$
  SELECT net.http_post(
    url:='https://your-project.supabase.co/functions/v1/consolidate-agent-memories',
    headers:='{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
    body:='{"dry_run": false}'::jsonb
  );
  $$
);
```

#### Manual Consolidation

```typescript
import { useConsolidateMemories } from '@/hooks/useAgentMemory'

function AdminPanel() {
  const consolidate = useConsolidateMemories()

  const runConsolidation = async () => {
    const result = await consolidate.mutateAsync({
      agent_id: agentId,
      consolidation_age_days: 7,
      pruning_age_days: 30,
      dry_run: false, // Set true to preview without changes
    })

    console.log(`Consolidated: ${result.consolidated_count}`)
    console.log(`Pruned: ${result.pruned_count}`)
    console.log(`Boosted: ${result.boosted_count}`)
  }

  return <Button onClick={runConsolidation}>Consolidate Memories</Button>
}
```

---

## Migration Guide

### Prerequisites

1. **Supabase CLI** installed:
   ```bash
   npm install -g supabase
   ```

2. **pgvector extension** enabled in Supabase:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

3. **Environment variables** configured:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `OPENAI_API_KEY` (for embeddings)

### Step-by-Step Migration

#### Option 1: Automated (Recommended)

```bash
# Run the migration script
./scripts/apply-agentic-migrations.sh

# Follow prompts:
# 1. Confirm migration application
# 2. Choose local or remote database
# 3. Enter project ID (if remote)
```

#### Option 2: Manual

```bash
# 1. Apply migrations
supabase db push

# 2. Regenerate types
supabase gen types typescript --local > src/integrations/supabase/types.ts

# 3. Remove type assertions manually
# Edit src/hooks/useAgentTools.ts
# Edit src/hooks/useAgentMemory.ts
# Remove all "as never" instances

# 4. Rebuild project
npm run build
```

### Verification

Run validation script:

```sql
-- In Supabase SQL Editor
-- Paste contents of scripts/validate-agentic-setup.sql
```

Expected checks:
- ✅ 9 tables created
- ✅ 5 helper functions
- ✅ 10+ pre-seeded tools
- ✅ RLS policies enabled
- ✅ Indexes created

---

## Usage Examples

### Example 1: Memory-Enhanced Chat

```typescript
// Agent automatically retrieves and stores memories
function AgentChat({ agentId }: { agentId: string }) {
  // Memory is automatically injected via agent-chat-stream
  // Just enable it on the agent

  return (
    <ChatInterface
      agent={agentId}
      // Memory is handled automatically:
      // 1. Retrieves relevant context before response
      // 2. Injects into system prompt
      // 3. Extracts new memories after conversation
    />
  )
}
```

### Example 2: Multi-Step Workflow with Tools

```typescript
async function createProjectWorkflow(userId: string, agentId: string) {
  // 1. Create execution plan
  const { data: plan } = await supabase
    .from('agent_execution_plans')
    .insert({
      agent_id: agentId,
      user_id: userId,
      goal: 'Set up new client project',
      status: 'executing',
    })
    .select()
    .single()

  // 2. Execute create_project tool
  const projectResult = await fetch(
    `${SUPABASE_URL}/functions/v1/execute-mcp-tool`,
    {
      body: JSON.stringify({
        tool_id: createProjectToolId,
        input_parameters: { name: 'Acme Corp - Website Redesign' },
        agent_id: agentId,
        user_id: userId,
        plan_id: plan.id,
      }),
    }
  ).then(r => r.json())

  // 3. Create tasks in parallel
  const tasks = [
    { title: 'Design mockups', priority: 'high' },
    { title: 'Write copy', priority: 'medium' },
    { title: 'Set up hosting', priority: 'high' },
  ]

  await Promise.all(
    tasks.map(task =>
      fetch(`${SUPABASE_URL}/functions/v1/execute-mcp-tool`, {
        body: JSON.stringify({
          tool_id: createTaskToolId,
          input_parameters: {
            ...task,
            project_id: projectResult.output.project_id,
          },
          agent_id: agentId,
          user_id: userId,
          plan_id: plan.id,
        }),
      })
    )
  )

  // 4. Mark plan complete
  await supabase
    .from('agent_execution_plans')
    .update({ status: 'completed' })
    .eq('id', plan.id)
}
```

### Example 3: Learning from Feedback

```typescript
import { useRecordLearningEvent } from '@/hooks/useAgentMemory'

function FeedbackComponent() {
  const recordLearning = useRecordLearningEvent()

  const handleFeedback = async (positive: boolean, message: string) => {
    await recordLearning.mutateAsync({
      agent_id: agentId,
      event_type: 'user_feedback',
      event_description: message,
      feedback_type: positive ? 'positive' : 'negative',
      feedback_text: message,
      agent_action_taken: 'Updated importance scoring',
      behavior_change: {
        increased_preference_confidence: true,
      },
    })
  }

  return (
    <div>
      <Button onClick={() => handleFeedback(true, 'Great response!')}>
        👍 Helpful
      </Button>
      <Button onClick={() => handleFeedback(false, 'Not what I needed')}>
        👎 Not Helpful
      </Button>
    </div>
  )
}
```

---

## API Reference

### Edge Functions

#### `execute-mcp-tool`

Execute an MCP tool with automatic retry and error handling.

**Request:**
```typescript
{
  tool_id: string           // UUID of tool (or use tool_name + server_id)
  input_parameters: object  // Tool-specific parameters
  agent_id?: string        // Optional agent context
  plan_id?: string         // Optional execution plan
  step_id?: string         // Optional step (for multi-step)
  user_id: string          // Required user ID
  execution_context?: object
}
```

**Response:**
```typescript
{
  success: boolean
  execution_id: string
  output: any              // Tool result
  execution_time_ms: number
  status: 'success' | 'failed'
}
```

#### `retrieve-agent-memories`

Semantic search for relevant agent memories.

**Request:**
```typescript
{
  agent_id: string
  user_id: string
  query: string
  memory_types?: string[]          // Default: ['short_term', 'long_term', 'episodic']
  memory_categories?: string[]
  limit?: number                   // Default: 10
  similarity_threshold?: number    // Default: 0.7
  include_recent?: boolean         // Default: true
  recent_days?: number            // Default: 7
}
```

**Response:**
```typescript
{
  memories: Array<{
    memory_id: string
    content: string
    memory_type: string
    memory_category: string
    similarity: number           // 0.0 - 1.0
    importance_score: number
    retrieval_method: 'semantic' | 'recent'
    created_at: string
  }>
  total_count: number
  semantic_count: number
  recent_count: number
}
```

#### `extract-agent-memories`

Extract and store memories from a conversation.

**Request:**
```typescript
{
  agent_id: string
  user_id: string
  conversation_id: string
  auto_extract?: boolean    // Default: true (uses AI)
  memories?: Array<{        // Optional manual memories
    memory_type: string
    content: string
    relevance_score?: number
  }>
}
```

**Response:**
```typescript
{
  memories: Array<{
    id: string
    memory_type: string
    content: string
    importance_score: number
  }>
  extracted_count: number
  stored_count: number
}
```

#### `consolidate-agent-memories`

Background maintenance for memory system.

**Request:**
```typescript
{
  agent_id?: string                // Optional: specific agent
  user_id?: string                 // Optional: specific user
  consolidation_age_days?: number  // Default: 7
  pruning_age_days?: number       // Default: 30
  importance_threshold?: number    // Default: 0.2
  dry_run?: boolean               // Default: false
}
```

**Response:**
```typescript
{
  success: boolean
  consolidated_count: number  // Short-term → long-term
  pruned_count: number       // Removed low-value
  boosted_count: number      // Increased importance
  operations: string[]       // Detailed log
  statistics: Array<{...}>   // Memory stats
}
```

### React Hooks

See full TypeScript definitions in:
- `src/hooks/useAgentTools.ts`
- `src/hooks/useAgentMemory.ts`

---

## Troubleshooting

### Migrations Failed

**Problem:** Migration script fails with "table already exists"

**Solution:**
```sql
-- Check what's already applied
SELECT * FROM supabase_migrations.schema_migrations
ORDER BY version DESC
LIMIT 10;

-- Drop conflicting tables (CAREFUL!)
DROP TABLE IF EXISTS agent_memories CASCADE;
-- Then re-run migration
```

### No Memories Being Stored

**Problem:** Conversations don't create memories

**Note:** Memory extraction is now automatic. After every assistant reply in a `memory_enabled` agent conversation, `extract-agent-memories` is called automatically (fire-and-forget) by `useSendMessage`. You no longer need to call it manually.

**Checklist:**
1. Is `memory_enabled` set to `true` on the agent? (Check in Admin → AI Agents → edit the agent)
2. Is `extract-agent-memories` edge function deployed?
3. Are embeddings being generated? (Check `generate-embeddings` function)
4. Check Supabase Edge Function logs for errors from `extract-agent-memories`
5. Verify with SQL: `SELECT COUNT(*), agent_id FROM agent_memories GROUP BY agent_id;`

### Memory Retrieval Returns Empty

**Problem:** `retrieve-agent-memories` returns no results

**Checklist:**
1. Check if memories exist:
   ```sql
   SELECT COUNT(*) FROM agent_memories WHERE agent_id = 'your-agent-id';
   ```
2. Check if vector extension is enabled:
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'vector';
   ```
3. Check similarity threshold (try lowering to 0.5)
4. Verify embeddings are not null:
   ```sql
   SELECT COUNT(*) FROM agent_memories WHERE embedding IS NOT NULL;
   ```

### Tool Execution Fails

**Problem:** `execute-mcp-tool` returns error

**Common Issues:**
1. **Tool not found** - Check tool_id exists in `mcp_tools`
2. **Server not active** - Verify `is_enabled` is true in `mcp_servers`
3. **Invalid parameters** - Check against tool's `input_schema`
4. **Missing user_id** - user_id is required

**Debug:**
```sql
-- Check tool exists
SELECT * FROM mcp_tools WHERE id = 'your-tool-id';

-- Check server is active
SELECT * FROM mcp_servers WHERE id = 'your-server-id';

-- Check recent executions
SELECT * FROM mcp_tool_executions
WHERE tool_id = 'your-tool-id'
ORDER BY created_at DESC
LIMIT 5;
```

### Type Errors After Migration

**Problem:** TypeScript errors about missing table types

**Solution:**
```bash
# Regenerate types
supabase gen types typescript --local > src/integrations/supabase/types.ts

# Or for remote
supabase gen types typescript --project-id YOUR_PROJECT_ID > src/integrations/supabase/types.ts

# Rebuild
npm run build
```

### Performance Issues

**Problem:** Memory retrieval is slow

**Solutions:**
1. Check indexes exist:
   ```sql
   SELECT * FROM pg_indexes
   WHERE tablename = 'agent_memories';
   ```

2. Rebuild vector index:
   ```sql
   REINDEX INDEX idx_agent_memories_embedding;
   ```

3. Reduce limit parameter (default 10 → try 5)

4. Check memory table size:
   ```sql
   SELECT
     pg_size_pretty(pg_total_relation_size('agent_memories')) as total_size,
     COUNT(*) as row_count
   FROM agent_memories;
   ```

---

## Next Steps

1. **Apply Migrations** - Run `./scripts/apply-agentic-migrations.sh`
2. **Enable Memory** - Update your agents to `memory_enabled: true`
3. **Test Tool Execution** - Try executing pre-seeded tools
4. **Add UI Components** - Integrate `AgentExecutionViewer` into your app
5. **Set Up Cron** - Schedule daily memory consolidation
6. **Monitor Performance** - Use validation script to check stats

For more advanced topics, see:
- [Agentic Evolution Roadmap](./AGENTIC_EVOLUTION_ROADMAP.md) - Full roadmap and future phases
- Supabase Edge Functions documentation
- MCP Protocol specification

---

**Questions?** Check the troubleshooting section or open an issue on GitHub.
