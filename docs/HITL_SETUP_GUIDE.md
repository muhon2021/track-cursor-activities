# Human-in-the-Loop (HITL) Setup Guide

Learn how to add human approval workflows to your AI agents for safety, compliance, and quality control.

## Table of Contents

1. [Introduction](#introduction)
2. [When to Require Approval](#when-to-require-approval)
3. [Quick Start](#quick-start)
4. [Approval Workflows](#approval-workflows)
5. [Approval Delegation](#approval-delegation)
6. [Real-World Examples](#real-world-examples)
7. [Best Practices](#best-practices)
8. [UI Components](#ui-components)

---

## Introduction

Human-in-the-Loop (HITL) adds checkpoints where humans review and approve AI agent actions before they execute. This is crucial for:

- **Safety**: Prevent harmful or incorrect actions
- **Compliance**: Meet regulatory requirements
- **Cost Control**: Approve expensive operations
- **Quality Assurance**: Human oversight for critical decisions

---

## When to Require Approval

### ✅ **Require Approval For:**

1. **High-Cost Operations**
   - Sending 1000+ emails ($50+)
   - Running expensive API calls
   - Bulk data operations

2. **Data Modifications**
   - Deleting production data
   - Updating customer records
   - Changing system configurations

3. **External Actions**
   - Posting to social media
   - Sending customer communications
   - Making purchases

4. **Low-Confidence Decisions**
   - Agent confidence score < 70%
   - Ambiguous user requests
   - Edge cases

5. **Compliance**
   - GDPR data access
   - Financial transactions
   - Medical advice

### ❌ **Don't Require Approval For:**

1. **Read-Only Operations**
   - Searching knowledge base
   - Viewing reports
   - Analyzing data

2. **Low-Risk Actions**
   - Creating drafts
   - Internal notes
   - Scheduling suggestions

3. **Time-Sensitive**
   - Real-time chat responses
   - Emergency notifications
   - System alerts

---

## Quick Start

### 1. Create Your First Approval Workflow

```typescript
import { useCreateApprovalWorkflow } from '@/hooks/useApprovals'

const createWorkflow = useCreateApprovalWorkflow()

const workflow = await createWorkflow.mutateAsync({
  name: "High Cost Operations",
  description: "Requires approval for operations costing $10 or more",

  // When to trigger approval
  trigger_type: "tool_execution",
  trigger_conditions: {
    min_cost: 10,           // Trigger if cost >= $10
  },

  // Who can approve
  approver_type: "role",
  approver_config: {
    role: "manager",        // Any user with "manager" role
  },

  // Workflow settings
  require_reason: false,    // Approver doesn't need to explain
  timeout_minutes: 60,      // Auto-reject after 1 hour
  auto_approve_threshold: 0.95, // Auto-approve if confidence >= 95%
})
```

### 2. Agent Requests Approval

```typescript
import { useRequestApproval } from '@/hooks/useApprovals'

const requestApproval = useRequestApproval()

// Agent wants to execute expensive operation
const approval = await requestApproval.mutateAsync({
  agent_id: agentId,
  action_description: "Send 1000 marketing emails to newsletter subscribers",
  request_type: "tool_execution",
  tool_name: "send_bulk_email",
  tool_parameters: {
    recipients: 1000,
    template: "monthly_newsletter",
  },
  estimated_cost: 50,      // $50 (triggers approval)
  risk_level: "medium",
  agent_reasoning: "Monthly newsletter scheduled for today",
  confidence_score: 0.85,
})

if (approval.requires_approval) {
  console.log("Waiting for approval:", approval.approval_request_id)
  console.log("Approvers:", approval.approvers)
  console.log("Expires:", approval.expires_at)
} else {
  console.log("Auto-approved! Proceeding...")
}
```

### 3. Manager Approves

```typescript
import { useRespondToApproval } from '@/hooks/useApprovals'

const respondToApproval = useRespondToApproval()

// Manager reviews and approves
await respondToApproval.mutateAsync({
  approval_request_id: approval.approval_request_id,
  approved: true,
  approval_note: "Looks good, proceed with send",
  execute_immediately: true, // Execute the tool automatically
})

// Action executes automatically after approval
```

---

## Approval Workflows

### Workflow Types

#### 1. **Cost-Based Approval**

Trigger when operation exceeds cost threshold:

```typescript
{
  name: "Cost Approval Tiers",
  trigger_type: "tool_execution",
  trigger_conditions: {
    min_cost: 100,  // $100+
  },
  approver_type: "role",
  approver_config: {
    role: "director",  // Senior approval for high costs
  },
  timeout_minutes: 120,
}
```

**Use Cases:**
- Bulk email campaigns
- API-intensive operations
- Large data exports

---

#### 2. **Risk-Based Approval**

Trigger based on risk level:

```typescript
{
  name: "High Risk Operations",
  trigger_type: "data_modification",
  trigger_conditions: {
    min_risk_level: "high",  // "low", "medium", "high", "critical"
  },
  approver_type: "role",
  approver_config: {
    role: "admin",
  },
  require_reason: true,  // Admin must explain their decision
  timeout_minutes: 30,
}
```

**Risk Level Guide:**
- **Low**: Read-only, no impact
- **Medium**: Updates non-critical data
- **High**: Deletes data, external actions
- **Critical**: Production changes, financial transactions

---

#### 3. **Confidence-Based Approval**

Trigger when agent is uncertain:

```typescript
{
  name: "Low Confidence Check",
  trigger_type: "tool_execution",
  trigger_conditions: {
    max_confidence: 0.7,  // Trigger if confidence <= 70%
  },
  approver_type: "any_user",  // Any authenticated user
  auto_approve_threshold: null,  // Always require human
  timeout_minutes: 15,
}
```

**When to Use:**
- Ambiguous requests
- Edge cases
- New/untested workflows

---

#### 4. **Specific Tool Approval**

Require approval for specific tools:

```typescript
{
  name: "Social Media Posting",
  trigger_type: "tool_execution",
  trigger_conditions: {
    tool_names: ["post_to_twitter", "post_to_linkedin"],
  },
  approver_type: "specific_user",
  approver_config: {
    user_ids: [marketingManagerId],  // Only marketing manager
  },
  require_reason: false,
  timeout_minutes: 240,  // 4 hours (posts can wait)
}
```

---

### Multiple Workflows

You can have multiple workflows. The system checks all enabled workflows:

```typescript
// Workflow 1: Cost
await createWorkflow({
  name: "Cost > $10",
  trigger_conditions: { min_cost: 10 },
  approver_type: "role",
  approver_config: { role: "manager" },
})

// Workflow 2: Risk
await createWorkflow({
  name: "High Risk",
  trigger_conditions: { min_risk_level: "high" },
  approver_type: "role",
  approver_config: { role: "admin" },
})

// If an action is both high-cost AND high-risk,
// BOTH workflows trigger (requires both approvers)
```

---

## Approval Delegation

Delegate approval authority to others:

### Simple Delegation

```typescript
import { useDelegateApproval } from '@/hooks/useApprovals'

const delegate = useDelegateApproval()

// CEO delegates to VP
await delegate.mutateAsync({
  delegate_id: vpUserId,
  // No constraints = full delegation
})
```

### Constrained Delegation

```typescript
// CEO delegates to VP with limits
await delegate.mutateAsync({
  delegate_id: vpUserId,
  max_cost_limit: 100,     // VP can approve up to $100
  allowed_risk_levels: ['low', 'medium'],  // Not high/critical
  workflow_id: costWorkflowId,  // Only for cost workflow
  valid_until: '2024-12-31',   // Delegation expires
})

// VP can now approve:
// ✅ $50 operation (under limit)
// ✅ Medium risk (allowed)
// ❌ $150 operation (exceeds limit → escalates to CEO)
// ❌ High risk (not allowed → escalates to CEO)
```

### Agent-Specific Delegation

```typescript
// Manager delegates for specific agent only
await delegate.mutateAsync({
  delegate_id: teamLeadId,
  agent_id: specificAgentId,  // Only for this agent
  max_cost_limit: 50,
})

// Team lead can approve for specificAgentId only
// Other agents still require manager approval
```

---

## Real-World Examples

### Example 1: Email Campaign Approval

**Scenario:** Marketing agent wants to send bulk emails

```typescript
// 1. Create workflow
await createWorkflow({
  name: "Bulk Email Approval",
  trigger_type: "tool_execution",
  trigger_conditions: {
    min_cost: 20,  // Campaigns > $20
    tool_names: ["send_bulk_email"],
  },
  approver_type: "role",
  approver_config: { role: "marketing_manager" },
  timeout_minutes: 120,
})

// 2. Agent requests
const approval = await requestApproval({
  agent_id: marketingAgentId,
  action_description: "Send product launch announcement to 5,000 subscribers",
  request_type: "tool_execution",
  tool_name: "send_bulk_email",
  tool_parameters: {
    template: "product_launch",
    segment: "active_subscribers",
    count: 5000,
  },
  estimated_cost: 100,
  risk_level: "medium",
  confidence_score: 0.9,
})

// 3. Marketing manager gets notification
// 4. Approves in UI
await respondToApproval({
  approval_request_id: approval.id,
  approved: true,
  execute_immediately: true,
})

// 5. Emails send automatically
```

---

### Example 2: Data Deletion Approval

**Scenario:** Agent wants to delete customer data (GDPR request)

```typescript
// 1. Create high-security workflow
await createWorkflow({
  name: "Data Deletion",
  trigger_type: "data_modification",
  trigger_conditions: {
    min_risk_level: "critical",
    actions: ["delete_user_data"],
  },
  approver_type: "role",
  approver_config: { role: "admin" },
  require_reason: true,  // Admin must explain
  timeout_minutes: 60,
  auto_approve_threshold: null,  // Never auto-approve
})

// 2. Agent requests
const approval = await requestApproval({
  agent_id: complianceAgentId,
  action_description: "Delete all data for user ID 12345 (GDPR request)",
  request_type: "data_modification",
  estimated_cost: 0,
  risk_level: "critical",
  agent_reasoning: "GDPR deletion request received via email on 2024-02-05",
  confidence_score: 1.0,  // Even at 100%, still requires approval
})

// 3. Admin reviews GDPR request
await respondToApproval({
  approval_request_id: approval.id,
  approved: true,
  approval_note: "GDPR request verified. Email dated 2024-02-05 confirmed.",
  execute_immediately: true,
})
```

---

### Example 3: Budget Approval with Delegation

**Scenario:** Project agents need budget approval, but CEO is busy

```typescript
// 1. CEO creates tiered approval
await createWorkflow({
  name: "Project Budget",
  trigger_type: "tool_execution",
  trigger_conditions: {
    min_cost: 1000,  // $1000+
  },
  approver_type: "specific_user",
  approver_config: {
    user_ids: [ceoId],
  },
  timeout_minutes: 480,  // 8 hours
})

// 2. CEO delegates small budgets to department heads
await delegate({
  delegate_id: engineeringDirectorId,
  workflow_id: budgetWorkflowId,
  max_cost_limit: 5000,  // Can approve up to $5k
  agent_id: engineeringAgentId,  // Only engineering agent
})

// 3. Engineering agent requests $3k
const approval = await requestApproval({
  agent_id: engineeringAgentId,
  action_description: "Purchase cloud credits for Q1",
  estimated_cost: 3000,
  risk_level: "medium",
})

// Engineering Director approves (within delegation)
await respondToApproval({
  approval_request_id: approval.id,
  approved: true,
})

// 4. Engineering agent requests $8k
const bigApproval = await requestApproval({
  agent_id: engineeringAgentId,
  action_description: "Purchase additional cloud credits",
  estimated_cost: 8000,  // Exceeds delegation limit
  risk_level: "high",
})

// Escalates to CEO (exceeds $5k delegation limit)
// CEO must approve
```

---

### Example 4: Social Media Posting

**Scenario:** Social media agent needs approval before posting

```typescript
// 1. Create workflow
await createWorkflow({
  name: "Social Media Posts",
  trigger_type: "tool_execution",
  trigger_conditions: {
    tool_names: ["post_to_twitter", "post_to_linkedin", "post_to_facebook"],
  },
  approver_type: "role",
  approver_config: { role: "social_media_manager" },
  timeout_minutes: 30,
})

// 2. Agent drafts post
const approval = await requestApproval({
  agent_id: socialAgentId,
  action_description: "Post about new product feature",
  request_type: "tool_execution",
  tool_name: "post_to_twitter",
  tool_parameters: {
    content: "🚀 Excited to announce our new AI-powered analytics dashboard! Get insights in seconds, not hours. Try it free: https://acme.com/analytics",
    media: ["dashboard_screenshot.png"],
  },
  risk_level: "medium",
  confidence_score: 0.85,
})

// 3. Social Media Manager reviews in UI
// Sees preview of post
// Can edit before approving
await respondToApproval({
  approval_request_id: approval.id,
  approved: true,
  approval_note: "Great! Changed 'Try it free' to 'Learn more' per brand guidelines",
  execute_immediately: true,
})
```

---

## Best Practices

### 1. **Start Conservative, Relax Over Time**

```typescript
// Week 1: Require approval for everything
trigger_conditions: { min_cost: 1 }

// Week 2: After building trust
trigger_conditions: { min_cost: 10 }

// Week 3: Only expensive operations
trigger_conditions: { min_cost: 50 }
```

### 2. **Use Auto-Approval for Confident Agents**

```typescript
{
  trigger_conditions: { min_cost: 10 },
  auto_approve_threshold: 0.9,  // If agent is 90%+ confident, auto-approve
}

// Agent at 85% confidence → requires approval
// Agent at 95% confidence → auto-approved
```

### 3. **Set Appropriate Timeouts**

| Operation Type | Recommended Timeout |
|----------------|---------------------|
| Real-time actions | 5-15 minutes |
| Daily operations | 1-4 hours |
| Scheduled tasks | 8-24 hours |
| Low priority | 48+ hours |

### 4. **Provide Context**

```typescript
// ❌ Bad
await requestApproval({
  action_description: "Send emails",
  estimated_cost: 50,
})

// ✅ Good
await requestApproval({
  action_description: "Send monthly newsletter to 1,000 active subscribers",
  estimated_cost: 50,
  risk_level: "low",
  agent_reasoning: "Newsletter scheduled for first Tuesday of month. Last sent: 2024-01-02. Open rate: 45%",
  confidence_score: 0.95,
  // Include preview or draft
  metadata: {
    preview_url: "https://preview.acme.com/newsletter/feb-2024",
    subject_line: "February Updates: New Features & Customer Stories",
  },
})
```

### 5. **Monitor Approval Metrics**

```typescript
// View approval workflow performance
const { data: metrics } = await supabase
  .from('approval_workflow_metrics')
  .select('*')

metrics.forEach(wf => {
  console.log(`${wf.workflow_name}:`)
  console.log(`  Approval rate: ${(wf.approval_rate * 100).toFixed(1)}%`)
  console.log(`  Avg response time: ${wf.avg_response_time_minutes} min`)
  console.log(`  Pending: ${wf.pending_requests}`)
})

// If approval rate is too low → workflow might be too strict
// If response time is too high → add more approvers or delegate
```

### 6. **Handle Rejections Gracefully**

```typescript
const result = await respondToApproval({
  approval_request_id: approval.id,
  approved: false,
  approval_note: "Budget allocated for next month. Please resubmit March 1.",
})

// Agent receives rejection
// Can either:
// 1. Retry with modifications
// 2. Escalate to user
// 3. Wait and resubmit later
```

---

## UI Components

### Approval Inbox Component

```typescript
import { usePendingApprovals } from '@/hooks/useApprovals'

function ApprovalInbox() {
  const { data: approvals, isLoading } = usePendingApprovals()

  if (isLoading) return <Loader />

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">
        Pending Approvals ({approvals.length})
      </h2>

      {approvals.map(approval => (
        <ApprovalCard
          key={approval.request_id}
          approval={approval}
        />
      ))}
    </div>
  )
}
```

### Approval Card Component

```typescript
function ApprovalCard({ approval }) {
  const respond = useRespondToApproval()

  const handleApprove = async () => {
    await respond.mutateAsync({
      approval_request_id: approval.request_id,
      approved: true,
      execute_immediately: true,
    })
  }

  const handleReject = async () => {
    await respond.mutateAsync({
      approval_request_id: approval.request_id,
      approved: false,
      approval_note: "Rejected",
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{approval.action_description}</CardTitle>
            <CardDescription>
              Agent: {approval.agent_name}
            </CardDescription>
          </div>
          <Badge variant={getRiskVariant(approval.risk_level)}>
            {approval.risk_level}
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-2 text-sm">
          {approval.estimated_cost && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Estimated Cost:</span>
              <span className="font-medium">${approval.estimated_cost}</span>
            </div>
          )}

          <div className="flex justify-between">
            <span className="text-muted-foreground">Requested:</span>
            <span>{formatDistanceToNow(new Date(approval.requested_at))} ago</span>
          </div>

          {approval.expires_at && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Expires:</span>
              <span className="text-red-600">
                {formatDistanceToNow(new Date(approval.expires_at), { addSuffix: true })}
              </span>
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-4">
          <Button
            onClick={handleApprove}
            className="flex-1"
            variant="default"
          >
            Approve & Execute
          </Button>
          <Button
            onClick={handleReject}
            className="flex-1"
            variant="outline"
          >
            Reject
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
```

---

## Troubleshooting

### Problem: Too Many Approval Requests

**Solution:**
1. Increase auto-approval threshold
2. Delegate more authority
3. Review trigger conditions (might be too sensitive)

### Problem: Requests Timing Out

**Solution:**
1. Increase timeout duration
2. Add more approvers
3. Send notifications (email, Slack)

### Problem: Wrong Approver Assigned

**Solution:**
1. Check approver_config matches user roles
2. Verify user has correct role in user_roles table
3. Review delegation constraints

---

## Next Steps

1. **Create your first workflow** (start with cost-based)
2. **Test with low-risk operation**
3. **Add delegation** for common scenarios
4. **Monitor metrics** and adjust

**Further Reading:**
- [Multi-Agent Tutorial](./MULTI_AGENT_TUTORIAL.md) - Combine HITL with teams
- [Phase 2 Quick Reference](./PHASE_2_QUICK_REFERENCE.md) - Complete API docs
- [Admin Panel Guide](./ADMIN_PANEL_GUIDE.md) - Configure workflows in UI

---

**Questions?** Check the [API reference](./PHASE_2_QUICK_REFERENCE.md) for complete function signatures.
