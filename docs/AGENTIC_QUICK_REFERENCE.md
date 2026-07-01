# Agentic Features Quick Reference

## 🚀 Setup (One-Time)

```bash
# Apply migrations
./scripts/apply-agentic-migrations.sh

# Verify setup
# Run scripts/validate-agentic-setup.sql in Supabase SQL Editor
```

## 🔧 Enable for Agent

```typescript
await supabase.from('ai_agents').update({
  memory_enabled: true,     // Enable memory
  tool_mcp: true,           // Enable tools
  mcp_server_ids: [uuid],   // Link MCP servers
}).eq('id', agentId)
```

## 🧠 Memory System

### Retrieve Memories

```typescript
const { data } = await supabase.functions.invoke('retrieve-agent-memories', {
  body: {
    agent_id, user_id, query,
    limit: 5,
    similarity_threshold: 0.7,
  }
})
// data.memories[0].content
```

### Extract Memories

```typescript
await supabase.functions.invoke('extract-agent-memories', {
  body: {
    agent_id, user_id, conversation_id,
    auto_extract: true,  // Uses AI
  }
})
```

### Manual Memory

```typescript
await supabase.from('agent_memories').insert({
  agent_id, user_id,
  memory_type: 'long_term',      // short_term, long_term, episodic, semantic
  memory_category: 'preference', // preference, fact, skill, goal, context
  content: 'User prefers concise responses',
  importance_score: 0.9,
})
```

### Consolidate (Daily Cron)

```sql
SELECT cron.schedule(
  'consolidate-memories',
  '0 2 * * *',
  $$ SELECT net.http_post(
    url:='https://xxx.supabase.co/functions/v1/consolidate-agent-memories',
    headers:='{"Authorization": "Bearer KEY"}'::jsonb
  ); $$
);
```

## 🛠️ Tool Orchestration

### Execute Tool

```typescript
const { data } = await supabase.functions.invoke('execute-mcp-tool', {
  body: {
    tool_id: 'uuid',
    input_parameters: { title: 'Task', priority: 'high' },
    agent_id, user_id,
  }
})
// data.output
```

### Pre-Seeded Tools

| Tool | Parameters |
|------|------------|
| `create_task` | title, description, priority |
| `search_tasks` | query, status |
| `schedule_meeting` | title, date, participants |
| `search_knowledge` | query |
| `create_project` | name, description |
| `get_project_status` | project_id |

### Multi-Step Workflow

```typescript
// 1. Create plan
const { data: plan } = await supabase
  .from('agent_execution_plans')
  .insert({ agent_id, user_id, goal: 'Setup project' })
  .select().single()

// 2. Create steps
await supabase.from('agent_execution_steps').insert([
  { plan_id: plan.id, step_number: 1, tool_name: 'create_project', parameters: {...} },
  { plan_id: plan.id, step_number: 2, tool_name: 'create_task', depends_on: [1] },
])

// 3. Execute tools with plan_id
await fetch('/functions/v1/execute-mcp-tool', {
  body: JSON.stringify({ ..., plan_id: plan.id })
})
```

## 📊 React Components

### Execution Viewer

```typescript
import { AgentExecutionViewer } from '@/components/agent/AgentExecutionViewer'

<AgentExecutionViewer
  agentId={agentId}
  planId={planId}  // Optional
  showReasoningTraces={true}
/>
```

### React Hooks

```typescript
// Tools
import {
  useAgentTools,        // Get available tools
  useExecuteTool,       // Execute a tool
  useToolExecutions,    // View history
  useAgentExecutionPlans, // Get workflows
} from '@/hooks/useAgentTools'

// Memory
import {
  useAgentMemories,     // List memories
  useRetrieveMemories,  // Semantic search
  useExtractMemories,   // Extract from conversation
  useSetPreference,     // Save preference
  useConsolidateMemories, // Maintenance
} from '@/hooks/useAgentMemory'
```

## 🔍 Debugging

### Check Memory Count

```sql
SELECT COUNT(*) FROM agent_memories
WHERE agent_id = 'uuid' AND is_active = true;
```

### Check Tool Executions

```sql
SELECT * FROM mcp_tool_executions
WHERE agent_id = 'uuid'
ORDER BY created_at DESC LIMIT 10;
```

### Check Pre-Seeded Tools

```sql
SELECT name, description FROM mcp_tools
WHERE server_id IN (
  SELECT id FROM mcp_servers WHERE server_url = 'internal://control-tower'
);
```

### View Memory Stats

```sql
SELECT * FROM agent_memory_stats WHERE agent_id = 'uuid';
```

### Check Embeddings

```sql
SELECT COUNT(*) FROM agent_memories
WHERE embedding IS NOT NULL;
```

## 🚨 Common Issues

| Issue | Solution |
|-------|----------|
| No memories stored | Check `memory_enabled = true` |
| Empty retrieval | Lower `similarity_threshold` to 0.5 |
| Tool not found | Verify `tool_id` exists in `mcp_tools` |
| Type errors | Regenerate types: `supabase gen types typescript --local` |
| Slow queries | Check indexes: `SELECT * FROM pg_indexes WHERE tablename = 'agent_memories'` |

## 📝 Memory Flow

```
User Message
    ↓
Retrieve Memories (semantic search)
    ↓
Inject into System Prompt
    ↓
Agent Responds
    ↓
Extract New Memories (async)
    ↓
Store in Database
```

## 🔄 Tool Flow

```
User Request
    ↓
Create Execution Plan
    ↓
Generate Steps
    ↓
Execute Tools (with retry)
    ↓
Track Results
    ↓
Return to User
```

## 📚 Database Tables

| Table | Purpose |
|-------|---------|
| `mcp_servers` | MCP server configs |
| `mcp_tools` | Tool definitions |
| `mcp_tool_executions` | Execution logs |
| `agent_execution_plans` | Multi-step workflows |
| `agent_execution_steps` | Individual steps |
| `agent_reasoning_traces` | Agent reasoning |
| `agent_memories` | Memory storage |
| `user_preferences` | Learned preferences |
| `agent_learning_events` | Feedback tracking |

## 🎯 Next Steps

1. ✅ Apply migrations
2. ✅ Enable on agent
3. ✅ Test tool execution
4. ✅ Test memory storage/retrieval
5. ⏭️ Set up cron job
6. ⏭️ Add UI components
7. ⏭️ Monitor performance

---

**Full Documentation**: See `docs/AGENTIC_FEATURES_GUIDE.md`
