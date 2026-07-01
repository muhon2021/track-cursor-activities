# Phase 2 Quick Reference

Fast lookup for Multi-Agent Collaboration and HITL Approval APIs.

## 🚀 Quick Navigation

- [Multi-Agent](#multi-agent)
- [HITL Approvals](#hitl-approvals)
- [Observability](#observability)
- [Database Tables](#database-tables)

---

## Multi-Agent

### Create Team

```typescript
import { useCreateTeam } from '@/hooks/useAgentCollaboration'

const team = await createTeam({
  name: "Team Name",
  description: "Optional description",
  team_type: "specialized",  // specialized, general, hierarchy, swarm
  collaboration_strategy: "sequential",  // sequential, parallel, hierarchical, consensus
  agent_ids: [agent1Id, agent2Id, agent3Id],
})
```

### Start Collaboration

```typescript
import { useStartCollaboration } from '@/hooks/useAgentCollaboration'

const session = await startCollaboration({
  team_id: teamId,
  goal: "What the team should accomplish",
  session_type: "task_delegation",  // task_delegation, consensus_building, parallel_execution, review_chain
  initial_context: { key: "value" },  // Optional context
})
```

### Request Handoff

```typescript
import { useRequestHandoff } from '@/hooks/useAgentCollaboration'

await requestHandoff({
  session_id: sessionId,
  from_agent_id: currentAgentId,
  to_agent_id: nextAgentId,
  handoff_reason: "expertise_needed",  // expertise_needed, task_complete, escalation, review_required
  context_summary: "What's been done so far",
  work_completed: { steps: [...] },
  work_remaining: { next_steps: [...] },
})
```

### View Collaboration Status

```typescript
// Get sessions
const { data: sessions } = useCollaborationSessions(teamId)

// Get messages
const { data: messages } = useCollaborationMessages(sessionId)

// Get handoffs
const { data: handoffs } = useHandoffs(sessionId)
```

---

## HITL Approvals

### Request Approval

```typescript
import { useRequestApproval } from '@/hooks/useApprovals'

const approval = await requestApproval({
  agent_id: agentId,
  action_description: "Human-readable description",
  request_type: "tool_execution",  // tool_execution, data_modification, external_api, cost_threshold
  tool_name: "tool_name",  // Optional
  tool_parameters: { ... },  // Optional
  estimated_cost: 50,  // Optional
  risk_level: "medium",  // low, medium, high, critical
  agent_reasoning: "Why the agent wants to do this",
  confidence_score: 0.85,  // 0.0 to 1.0
  timeout_minutes: 60,  // Optional, default from workflow
})

// Check if approval needed
if (approval.requires_approval) {
  console.log("Waiting for approval:", approval.approval_request_id)
} else {
  console.log("Auto-approved, can proceed")
}
```

### Respond to Approval

```typescript
import { useRespondToApproval } from '@/hooks/useApprovals'

await respondToApproval({
  approval_request_id: requestId,
  approved: true,  // or false
  approval_note: "Optional explanation",  // Required if workflow.require_reason = true
  execute_immediately: true,  // Auto-execute if approved
})
```

### View Pending Approvals

```typescript
import { usePendingApprovals } from '@/hooks/useApprovals'

const { data: approvals } = usePendingApprovals()
// Polls every 10 seconds automatically

// Each approval has:
{
  request_id,
  agent_name,
  action_description,
  risk_level,
  estimated_cost,
  requested_at,
  expires_at,
}
```

### Create Approval Workflow

```typescript
import { useCreateApprovalWorkflow } from '@/hooks/useApprovals'

const workflow = await createWorkflow({
  name: "Workflow Name",
  description: "Optional description",
  trigger_type: "tool_execution",  // tool_execution, data_modification, external_api, cost_threshold
  trigger_conditions: {
    min_cost: 10,  // Trigger if cost >= $10
    min_risk_level: "high",  // low, medium, high, critical
    max_confidence: 0.7,  // Trigger if confidence <= 70%
    tool_names: ["tool1", "tool2"],  // Trigger for specific tools
  },
  approver_type: "role",  // specific_user, role, agent, any_user
  approver_config: {
    role: "manager",  // For approver_type: role
    user_ids: [id1, id2],  // For approver_type: specific_user
  },
  require_reason: false,  // Approver must explain decision
  timeout_minutes: 60,  // Auto-reject after timeout
  auto_approve_threshold: 0.95,  // Auto-approve if confidence >= 95%
})
```

### Delegate Approval Authority

```typescript
import { useDelegateApproval } from '@/hooks/useApprovals'

await delegateApproval({
  delegate_id: userId,  // Who to delegate to
  workflow_id: workflowId,  // Optional: specific workflow only
  agent_id: agentId,  // Optional: specific agent only
  max_cost_limit: 100,  // Optional: max cost they can approve
  allowed_risk_levels: ['low', 'medium'],  // Optional: risk levels allowed
  valid_until: '2024-12-31',  // Optional: expiration date
})
```

---

## Observability

### Record Performance Metrics

```sql
-- Automatically called by execute-mcp-tool
SELECT record_agent_performance(
  p_agent_id := 'agent-uuid',
  p_execution_time_ms := 1500,
  p_was_successful := true,
  p_cost := 0.05,
  p_tokens_used := 1000,
  p_tool_name := 'create_task'
);
```

### View Agent Performance

```typescript
// Query performance metrics
const { data } = await supabase
  .from('agent_performance_metrics')
  .select('*')
  .eq('agent_id', agentId)
  .eq('metric_date', '2024-02-06')

// Or use view
const { data: overview } = await supabase
  .from('agent_performance_overview')
  .select('*')
  .eq('agent_id', agentId)
  .single()

// Returns:
{
  total_executions: 150,
  successful_executions: 145,
  failed_executions: 5,
  success_rate: 96.67,
  avg_latency_ms: 1200,
  total_cost: 7.50,
  total_tokens_used: 15000,
  avg_user_rating: 4.5,
}
```

### Track Errors

```typescript
// Query errors
const { data: errors } = await supabase
  .from('agent_errors')
  .select('*')
  .eq('agent_id', agentId)
  .eq('resolution_status', 'open')
  .order('occurred_at', { ascending: false })

// Record error
await supabase
  .from('agent_errors')
  .insert({
    agent_id: agentId,
    user_id: userId,
    error_type: 'api_error',
    error_code: 'TIMEOUT',
    error_message: 'API request timed out after 30s',
    severity: 'high',
    is_user_facing: true,
    context: { endpoint: '/api/v1/data', timeout: 30000 },
  })
```

### Audit Trail

```typescript
// Query audit trail
const { data: audit } = await supabase
  .from('agent_audit_trail')
  .select('*')
  .eq('agent_id', agentId)
  .gte('created_at', '2024-02-01')
  .order('created_at', { ascending: false })

// Each entry has:
{
  action_type,  // tool_execution, memory_access, configuration_change
  action_description,
  before_state,
  after_state,
  action_result,  // success, failure, partial
  ip_address,
  user_agent,
  created_at,
}
```

---

## Database Tables

### Multi-Agent Tables

| Table | Purpose |
|-------|---------|
| `agent_teams` | Team configurations |
| `agent_team_members` | Team membership |
| `agent_collaboration_sessions` | Active collaborations |
| `agent_collaboration_messages` | Inter-agent communication |
| `agent_handoffs` | Work transfers |

### HITL Tables

| Table | Purpose |
|-------|---------|
| `approval_workflows` | Workflow definitions |
| `approval_requests` | Individual requests |
| `approval_delegations` | Delegated authority |

### Observability Tables

| Table | Purpose |
|-------|---------|
| `agent_performance_metrics` | Hourly metrics |
| `agent_errors` | Error tracking |
| `agent_audit_trail` | Action logs |
| `system_health_metrics` | System-wide metrics |

---

## Common Queries

### Get Team Summary

```sql
SELECT * FROM agent_collaboration_summary WHERE team_id = 'team-uuid';
```

### Get Approval Metrics

```sql
SELECT * FROM approval_workflow_metrics WHERE workflow_id = 'workflow-uuid';
```

### Get Agent Performance

```sql
SELECT * FROM agent_performance_overview WHERE agent_id = 'agent-uuid';
```

### Expire Old Approvals

```sql
SELECT expire_old_approval_requests();  -- Returns count of expired
```

### Get Pending Approvals for User

```sql
SELECT * FROM get_pending_approvals_for_user('user-uuid');
```

---

## Edge Functions

### orchestrate-agent-team

**URL:** `/functions/v1/orchestrate-agent-team`

**Body:**
```json
{
  "team_id": "uuid",
  "user_id": "uuid",
  "goal": "What to accomplish",
  "session_type": "task_delegation",
  "initial_context": {}
}
```

**Response:**
```json
{
  "success": true,
  "session_id": "uuid",
  "strategy": "sequential",
  "message": "Orchestration started",
  "current_agent": { "id": "uuid", "name": "Agent Name" }
}
```

---

### request-approval

**URL:** `/functions/v1/request-approval`

**Body:**
```json
{
  "agent_id": "uuid",
  "user_id": "uuid",
  "action_description": "Description",
  "request_type": "tool_execution",
  "tool_name": "tool_name",
  "tool_parameters": {},
  "estimated_cost": 50,
  "risk_level": "medium",
  "agent_reasoning": "Why",
  "confidence_score": 0.85,
  "timeout_minutes": 60
}
```

**Response:**
```json
{
  "requires_approval": true,
  "approval_request_id": "uuid",
  "expires_at": "2024-02-06T10:00:00Z",
  "approvers": [
    { "id": "uuid", "email": "approver@example.com", "name": "Manager" }
  ],
  "message": "Approval request created"
}
```

---

### respond-to-approval

**URL:** `/functions/v1/respond-to-approval`

**Headers:** `Authorization: Bearer <token>`

**Body:**
```json
{
  "approval_request_id": "uuid",
  "approved": true,
  "approval_note": "Looks good",
  "execute_immediately": true
}
```

**Response:**
```json
{
  "success": true,
  "status": "approved",
  "execution_result": {
    "success": true,
    "output": {...}
  }
}
```

---

## React Hook Quick Reference

### Multi-Agent Hooks

```typescript
// Teams
useAgentTeams()  // Get all teams
useCreateTeam()  // Create team

// Collaboration
useStartCollaboration()  // Start session
useCollaborationSessions(teamId?)  // Get sessions
useCollaborationMessages(sessionId)  // Get messages
useHandoffs(sessionId)  // Get handoffs
useRequestHandoff()  // Request handoff
```

### Approval Hooks

```typescript
// Requests
useRequestApproval()  // Request approval
useRespondToApproval()  // Approve/reject
usePendingApprovals()  // Get pending (polls every 10s)
useApprovalRequests(filters?)  // Get all requests

// Workflows
useApprovalWorkflows()  // Get workflows
useCreateApprovalWorkflow()  // Create workflow

// Delegation
useDelegateApproval()  // Delegate authority
useApprovalDelegations()  // Get delegations
```

---

## Collaboration Strategies

| Strategy | When to Use | Example |
|----------|-------------|---------|
| **Sequential** | Assembly line, escalation | L1 → L2 → L3 support |
| **Parallel** | Speed, multi-perspective | Research from multiple sources |
| **Hierarchical** | Complex projects, delegation | PM delegates to specialists |
| **Consensus** | Group decisions, quality | Code review by security, perf, style agents |

---

## Approval Trigger Conditions

```typescript
trigger_conditions: {
  min_cost: 10,              // Trigger if cost >= $10
  min_risk_level: "high",    // low, medium, high, critical
  max_confidence: 0.7,       // Trigger if confidence <= 70%
  tool_names: ["tool1"],     // Specific tools only
  actions: ["delete_user"],  // Specific actions only
}
```

---

## Risk Level Guide

| Level | Definition | Examples |
|-------|------------|----------|
| **Low** | Read-only, no impact | Search, view reports |
| **Medium** | Non-critical updates | Update task description |
| **High** | Data deletion, external actions | Delete records, post to social media |
| **Critical** | Production changes, financial | Database migrations, payments |

---

## Approver Types

| Type | Usage | Config |
|------|-------|--------|
| **specific_user** | Requires specific person | `{ user_ids: [id1, id2] }` |
| **role** | Any user with role | `{ role: "manager" }` |
| **agent** | Another agent approves | `{ agent_id: "uuid" }` |
| **any_user** | Any authenticated user | `{}` |

---

## Status Values

### Collaboration Session Status
- `active` - In progress
- `completed` - Successfully finished
- `failed` - Error occurred
- `paused` - Temporarily stopped

### Approval Request Status
- `pending` - Waiting for approval
- `approved` - Approved by user
- `rejected` - Rejected by user
- `expired` - Timeout reached
- `cancelled` - Cancelled by requester

### Handoff Status
- `pending` - Waiting for acceptance
- `accepted` - Next agent accepted
- `rejected` - Next agent declined
- `completed` - Handoff finished

---

## Performance Tips

### 1. Index Usage

Already optimized indexes on:
- `agent_id` (all tables)
- `status` (sessions, approvals)
- `created_at` (all tables)

### 2. Query Limits

```typescript
// Always use limits
.limit(50)  // Reasonable default

// For real-time, use smaller limits
.limit(10)  // Pending approvals
```

### 3. Polling Intervals

- Pending approvals: 10s
- Active sessions: 5s
- Performance metrics: 60s

### 4. Batch Operations

```typescript
// ✅ Good: Batch inserts
await supabase
  .from('agent_team_members')
  .insert([member1, member2, member3])

// ❌ Bad: Individual inserts
await supabase.from('agent_team_members').insert(member1)
await supabase.from('agent_team_members').insert(member2)
await supabase.from('agent_team_members').insert(member3)
```

---

## Debugging

### Enable Function Logs

```bash
# View edge function logs
supabase functions logs orchestrate-agent-team
supabase functions logs request-approval
```

### Check RLS Policies

```sql
-- See what policies apply to you
SELECT * FROM pg_policies WHERE tablename = 'agent_teams';
```

### Verify Approver Access

```sql
-- Check if user can approve
SELECT * FROM get_pending_approvals_for_user('user-uuid');
```

---

## Environment Variables

Required for edge functions:

```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhb...
OPENAI_API_KEY=sk-...  # For AI-powered features
```

---

## Migration Commands

```bash
# Apply Phase 2 migration
psql -d your_db -f supabase/migrations/20260206_multi_agent_hitl.sql

# Verify tables
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'agent_%';

# Check functions
SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public';
```

---

## Further Reading

- [Multi-Agent Tutorial](./MULTI_AGENT_TUTORIAL.md) - Step-by-step guides
- [HITL Setup Guide](./HITL_SETUP_GUIDE.md) - Approval workflows
- [Phase 1 Quick Reference](./AGENTIC_QUICK_REFERENCE.md) - Tool orchestration & memory

---

**Need help?** See full tutorials or [open an issue](https://github.com/your-repo/issues).
