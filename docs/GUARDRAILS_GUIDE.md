# Guardrails & Safety System Guide

**Version:** 1.0
**Phase:** 3.2 - Human-in-the-Loop & Governance
**Last Updated:** February 6, 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Why Guardrails?](#why-guardrails)
3. [Guardrail Types](#guardrail-types)
4. [Pre-Built Guardrails](#pre-built-guardrails)
5. [Quick Start](#quick-start)
6. [Real-World Examples](#real-world-examples)
7. [API Reference](#api-reference)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)

---

## Overview

The Guardrails & Safety System provides comprehensive safety controls for your AI agents, ensuring they operate within defined boundaries and comply with security, privacy, and business requirements.

### What Are Guardrails?

Guardrails are automated safety rules that:
- **Validate** agent inputs and outputs
- **Block** dangerous or inappropriate content
- **Redact** sensitive information (PII, credentials)
- **Limit** resource usage (costs, API calls)
- **Enforce** security policies (data access, tool usage)

### Architecture

```
User Input → Input Validation → Agent Processing → Output Validation → Safe Output
              ↓                                        ↓
         Block/Warn                              Redact/Block/Warn
```

---

## Why Guardrails?

### 1. **Security & Privacy**
- Prevent PII leakage (emails, phone numbers, SSNs, credit cards)
- Block credential exposure (passwords, API keys, tokens)
- Restrict access to sensitive database tables

### 2. **Cost Control**
- Prevent runaway AI costs
- Set daily/monthly budgets per agent
- Alert when approaching limits

### 3. **Safety & Compliance**
- Block offensive or harmful content
- Prevent prompt injection attacks
- Enforce data governance policies

### 4. **Operational Limits**
- Prevent infinite loops (max tool calls)
- Rate limit tool usage
- Require approval for dangerous operations

---

## Guardrail Types

### 1. Input Validation
**Purpose:** Validate user inputs before processing

**Use Cases:**
- Detect prompt injection attempts
- Block malformed queries
- Validate input formats

**Example:**
```typescript
{
  guardrail_type: "input_validation",
  rules: {
    patterns: [
      "ignore (previous|all) (instructions|prompts)",
      "you are now",
      "system:\\s*you are"
    ],
    case_sensitive: false,
    action: "block"
  }
}
```

### 2. Output Filtering
**Purpose:** Filter agent outputs before showing to users

**Use Cases:**
- Redact PII from responses
- Block offensive content
- Remove confidential information

**Example:**
```typescript
{
  guardrail_type: "output_filtering",
  rules: {
    patterns: [
      "\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b" // Email
    ],
    pii_types: ["email"],
    action: "redact"
  }
}
```

### 3. Tool Restriction
**Purpose:** Control which tools agents can use and how often

**Use Cases:**
- Block dangerous tools (delete, execute SQL)
- Require approval for sensitive operations
- Rate limit API calls

**Example:**
```typescript
{
  guardrail_type: "tool_restriction",
  rules: {
    restricted_tools: ["execute_sql", "delete_file"],
    action: "require_approval",
    max_calls: 20
  }
}
```

### 4. Cost Control
**Purpose:** Prevent excessive AI spending

**Use Cases:**
- Set per-execution cost limits
- Daily/monthly budgets
- Alert thresholds

**Example:**
```typescript
{
  guardrail_type: "cost_control",
  rules: {
    max_cost: 1.0,
    currency: "USD",
    action: "block"
  }
}
```

### 5. Data Access
**Purpose:** Restrict access to sensitive data

**Use Cases:**
- Block queries to sensitive tables
- Enforce schema restrictions
- Audit data access

**Example:**
```typescript
{
  guardrail_type: "data_access",
  rules: {
    blocked_tables: ["user_credentials", "payment_methods"],
    blocked_schemas: ["auth", "vault"],
    action: "block"
  }
}
```

---

## Pre-Built Guardrails

The system includes 10 pre-configured guardrails:

### 1. PII Detection ✅
**Blocks:** Emails, phone numbers, SSNs, credit cards
**Action:** Redact
**Status:** Active by default

### 2. Offensive Content Filter ✅
**Blocks:** Hate speech, violence, harassment
**Action:** Block
**Status:** Active by default

### 3. Confidential Keywords Filter ✅
**Blocks:** password, api_key, secret, token
**Action:** Block
**Status:** Active by default

### 4. Max Tool Calls Per Execution ✅
**Limit:** 20 tool calls
**Prevents:** Infinite loops
**Status:** Active by default

### 5. Max Cost Per Execution ✅
**Limit:** $1.00 USD
**Prevents:** Runaway costs
**Status:** Active by default

### 6. Daily Budget Alert ⚠️
**Threshold:** 80% of daily budget
**Action:** Warning
**Status:** Active by default

### 7. Sensitive Table Protection ✅
**Blocks:** Access to auth tables, credentials
**Action:** Block
**Status:** Active by default

### 8. Prompt Injection Detection ✅
**Detects:** Common injection patterns
**Action:** Block
**Status:** Active by default

### 9. Dangerous Operations Protection ✅
**Requires Approval:** execute_sql, delete_file, system_command
**Timeout:** 30 minutes
**Status:** Active by default

### 10. Agent Execution Rate Limit ✅
**Limit:** 10/min, 100/hour
**Prevents:** Abuse
**Status:** Active by default

---

## Quick Start

### Step 1: View Active Guardrails

```typescript
import { useGuardrails } from "@/hooks/useGuardrails";

function GuardrailsList() {
  const { data: guardrails } = useGuardrails();

  return (
    <div>
      {guardrails?.map(g => (
        <div key={g.id}>
          {g.name} ({g.guardrail_type}) - {g.is_active ? "Active" : "Inactive"}
        </div>
      ))}
    </div>
  );
}
```

### Step 2: Create a Custom Guardrail

```typescript
import { useCreateGuardrail } from "@/hooks/useGuardrails";

function CreateGuardrail() {
  const createGuardrail = useCreateGuardrail();

  const handleCreate = async () => {
    await createGuardrail.mutateAsync({
      name: "Block Company Secrets",
      description: "Prevents disclosure of confidential company information",
      guardrail_type: "output_filtering",
      rules: {
        keywords: ["project_apollo", "secret_sauce", "acquisition"],
        case_sensitive: false,
        action: "block"
      },
      severity: "block"
    });
  };

  return <button onClick={handleCreate}>Create Guardrail</button>;
}
```

### Step 3: Set Cost Limits for Agent

```typescript
import { useSetCostLimit } from "@/hooks/useGuardrails";

function SetCostLimit({ agentId }: { agentId: string }) {
  const setCostLimit = useSetCostLimit();

  const handleSetLimit = async () => {
    await setCostLimit.mutateAsync({
      agent_id: agentId,
      limit_type: "daily",
      max_cost: 10.0, // $10/day
      alert_threshold: 0.80 // Alert at 80%
    });
  };

  return <button onClick={handleSetLimit}>Set Daily Budget</button>;
}
```

### Step 4: View Violations

```typescript
import { useGuardrailViolations } from "@/hooks/useGuardrails";

function ViolationsList({ agentId }: { agentId: string }) {
  const { data: violations } = useGuardrailViolations(agentId);

  return (
    <div>
      {violations?.map(v => (
        <div key={v.id}>
          {v.guardrail.name}: {v.action_taken} at {v.created_at}
        </div>
      ))}
    </div>
  );
}
```

---

## Real-World Examples

### Example 1: Customer Support Agent - PII Protection

**Scenario:** Customer support agent must never leak customer PII

**Solution:**
```typescript
// 1. Enable PII Detection guardrail (active by default)
// 2. Add custom company-specific PII patterns
await createGuardrail.mutateAsync({
  name: "Customer ID Protection",
  guardrail_type: "output_filtering",
  rules: {
    patterns: [
      "\\bCUST-\\d{6}\\b", // Customer IDs like CUST-123456
      "\\bORD-\\d{8}\\b"   // Order IDs like ORD-12345678
    ],
    action: "redact"
  },
  severity: "block"
});

// Example output transformation:
// Before: "Your customer ID is CUST-123456"
// After:  "Your customer ID is [REDACTED_PII_1]"
```

### Example 2: Data Analysis Agent - Cost Control

**Scenario:** Analysis agent runs expensive queries, need budget control

**Solution:**
```typescript
// Set daily budget limit
await setCostLimit.mutateAsync({
  agent_id: "data-analyst-agent",
  limit_type: "daily",
  max_cost: 50.0, // $50/day
  alert_threshold: 0.90 // Alert at $45
});

// Set per-execution limit to prevent single expensive query
await setCostLimit.mutateAsync({
  agent_id: "data-analyst-agent",
  limit_type: "per_execution",
  max_cost: 2.0 // Max $2 per query
});
```

### Example 3: Code Agent - Dangerous Operations

**Scenario:** Code agent can execute SQL, but needs approval for DELETE/DROP

**Solution:**
```typescript
// Add tool restriction requiring approval
await createGuardrail.mutateAsync({
  name: "Destructive SQL Approval",
  guardrail_type: "tool_restriction",
  rules: {
    restricted_tools: ["execute_sql"],
    action: "require_approval",
    approval_timeout_minutes: 15,
    patterns: ["DELETE", "DROP", "TRUNCATE"] // Additional check in SQL content
  },
  severity: "block"
});

// When agent tries to execute DELETE:
// 1. Guardrail blocks execution
// 2. Creates approval request
// 3. Notifies admin
// 4. Waits for approval (max 15 min)
// 5. If approved, executes
```

### Example 4: Content Writer Agent - Brand Voice Protection

**Scenario:** Marketing agent must not use competitor names or inappropriate language

**Solution:**
```typescript
// Block competitor mentions
await createGuardrail.mutateAsync({
  name: "Competitor Mention Block",
  guardrail_type: "output_filtering",
  rules: {
    keywords: [
      "CompetitorA", "CompetitorB", "CompetitorC",
      "competing product", "alternative to"
    ],
    case_sensitive: false,
    action: "block"
  },
  severity: "warning"
});

// Block inappropriate language
await createGuardrail.mutateAsync({
  name: "Professional Tone Enforcement",
  guardrail_type: "output_filtering",
  rules: {
    patterns: [
      "\\b(slang|jargon|curse|inappropriate)\\b"
    ],
    action: "block"
  },
  severity: "block"
});
```

### Example 5: HR Agent - Sensitive Data Access

**Scenario:** HR agent can read employee data but not salary/compensation tables

**Solution:**
```typescript
await createGuardrail.mutateAsync({
  name: "HR Data Access Control",
  guardrail_type: "data_access",
  rules: {
    blocked_tables: [
      "salaries",
      "compensation",
      "stock_grants",
      "bonuses",
      "performance_reviews"
    ],
    blocked_schemas: ["payroll", "hr_confidential"],
    action: "block",
    error_message: "Access denied. Salary data requires HR Director approval."
  },
  severity: "block"
});
```

---

## API Reference

### React Hooks

#### `useGuardrails()`
Fetch all guardrails.

```typescript
const { data: guardrails, isLoading } = useGuardrails();
```

#### `useAgentGuardrails(agentId: string)`
Fetch guardrails for a specific agent.

```typescript
const { data: agentGuardrails } = useAgentGuardrails("agent-123");
```

#### `useCreateGuardrail()`
Create a new guardrail.

```typescript
const createGuardrail = useCreateGuardrail();
await createGuardrail.mutateAsync({ name, guardrail_type, rules, severity });
```

#### `useSetCostLimit()`
Set cost limit for an agent.

```typescript
const setCostLimit = useSetCostLimit();
await setCostLimit.mutateAsync({ agent_id, limit_type, max_cost });
```

#### `useGuardrailViolations(agentId?, limit?)`
Fetch recent violations.

```typescript
const { data: violations } = useGuardrailViolations("agent-123", 50);
```

#### `useValidateGuardrails()`
Validate content against guardrails.

```typescript
const validate = useValidateGuardrails();
const result = await validate.mutateAsync({
  agent_id,
  content,
  validation_type: "output"
});
```

### Edge Functions

#### `validate-guardrails`
**POST** `/functions/v1/validate-guardrails`

**Request:**
```json
{
  "agent_id": "agent-123",
  "content": "Text to validate",
  "validation_type": "output",
  "tool_name": "optional",
  "estimated_cost": 0.05
}
```

**Response:**
```json
{
  "passed": false,
  "violations": 2,
  "blockers": 1,
  "warnings": 1,
  "details": [
    {
      "guardrail_name": "PII Detection",
      "severity": "block",
      "action": "blocked",
      "violation_details": {
        "matches": ["user@example.com"]
      }
    }
  ]
}
```

#### `enforce-guardrails`
**POST** `/functions/v1/enforce-guardrails`

**Request:**
```json
{
  "agent_id": "agent-123",
  "content": "Email me at john@example.com",
  "enforcement_type": "output"
}
```

**Response:**
```json
{
  "allowed": true,
  "action": "transformed",
  "content": "Email me at [REDACTED_PII_1]",
  "transformations": [
    {
      "type": "redaction",
      "guardrail": "PII Detection",
      "count": 1,
      "pii_type": "email"
    }
  ]
}
```

### Database Functions

#### `check_agent_cost_limit(agent_id, estimated_cost, limit_type)`
Check if agent can proceed based on cost limit.

```sql
SELECT * FROM check_agent_cost_limit(
  'agent-123',
  0.50,
  'daily'
);
```

#### `record_agent_cost(agent_id, cost)`
Record cost and update limits.

```sql
SELECT record_agent_cost('agent-123', 0.50);
```

#### `check_tool_rate_limit(agent_id, tool_name)`
Check if tool usage is within rate limits.

```sql
SELECT * FROM check_tool_rate_limit(
  'agent-123',
  'execute_sql'
);
```

---

## Best Practices

### 1. Start Conservative, Relax Gradually
```typescript
// ✅ GOOD: Start with strict limits
max_cost: 1.0,
max_tool_calls: 10,
requires_approval: true

// ❌ BAD: Starting too permissive
max_cost: 100.0,
max_tool_calls: 1000,
requires_approval: false
```

### 2. Use Multiple Layers of Defense
```typescript
// Layer 1: Input validation (prompt injection)
// Layer 2: Cost control (budget limits)
// Layer 3: Output filtering (PII redaction)
// Layer 4: Tool restrictions (dangerous operations)
```

### 3. Monitor Violations, Adjust Rules
```typescript
// Review violations weekly
const { data: stats } = useViolationStats(agentId, 7);

if (stats.blocked > 100) {
  // Too strict - review and adjust
} else if (stats.total === 0) {
  // Possibly too lenient - add monitoring
}
```

### 4. Use System Guardrails
```typescript
// ✅ GOOD: Keep system guardrails enabled
// They provide baseline safety

// ❌ BAD: Disabling system guardrails
// Even if you add custom ones
```

### 5. Test Guardrails Before Production
```typescript
// Test with known violations
const testCases = [
  "My email is test@example.com", // Should redact
  "DROP TABLE users;",             // Should block
  "Cost $1000",                     // Should trigger budget alert
];

for (const test of testCases) {
  const result = await validate.mutateAsync({
    agent_id,
    content: test,
    validation_type: "output"
  });
  console.log(result);
}
```

### 6. Set Appropriate Timeouts
```typescript
// ✅ GOOD: Reasonable approval timeouts
approval_timeout_minutes: 15 // For normal operations
approval_timeout_minutes: 60 // For complex workflows

// ❌ BAD: Too short (causes auto-rejection)
approval_timeout_minutes: 1

// ❌ BAD: Too long (blocks agent indefinitely)
approval_timeout_minutes: 1440 // 24 hours
```

---

## Troubleshooting

### Issue: Too Many False Positives

**Symptoms:** Legitimate content being blocked

**Solutions:**
1. Review violation logs to identify patterns
2. Adjust regex patterns to be more specific
3. Lower severity from "block" to "warning"
4. Add exceptions for known false positives

```typescript
// Before: Too broad
pattern: "\\btest\\b" // Blocks "test results", "testing phase"

// After: More specific
pattern: "\\btest@\\b" // Only blocks "test@example.com"
```

### Issue: Guardrails Not Triggering

**Symptoms:** Violations not being caught

**Solutions:**
1. Verify guardrail is active: `is_active = true`
2. Check if assigned to agent
3. Verify validation_type matches (`input` vs `output`)
4. Test regex pattern independently

```typescript
// Debug guardrail assignment
const { data } = await supabase
  .from("agent_guardrail_assignments")
  .select("*")
  .eq("agent_id", agentId)
  .eq("guardrail_id", guardrailId);

console.log("Assigned?", data.length > 0);
```

### Issue: Cost Limits Not Resetting

**Symptoms:** Agent blocked despite budget period ending

**Solution:**
Run the reset function (should be automated via cron):

```sql
SELECT reset_expired_cost_limits();
```

**Prevention:**
Set up cron job to run hourly:
```sql
-- In Supabase Dashboard: Database > Cron Jobs
SELECT cron.schedule(
  'reset-cost-limits',
  '0 * * * *', -- Every hour
  $$ SELECT reset_expired_cost_limits() $$
);
```

### Issue: Performance Degradation

**Symptoms:** Slow agent responses

**Solutions:**
1. Reduce number of active guardrails
2. Optimize regex patterns
3. Add database indexes
4. Cache guardrail rules

```typescript
// Use agentspecific guardrails only
const { data } = useAgentGuardrails(agentId); // Faster

// Instead of all guardrails
const { data } = useGuardrails(); // Slower, loads all
```

---

## Next Steps

1. **Review Pre-Built Guardrails**: Familiarize yourself with the 10 system guardrails
2. **Set Cost Limits**: Configure daily budgets for your agents
3. **Monitor Violations**: Check the violations dashboard regularly
4. **Create Custom Guardrails**: Add organization-specific safety rules
5. **Test Thoroughly**: Validate guardrails work as expected before production

---

## Related Documentation

- [HITL Setup Guide](./HITL_SETUP_GUIDE.md) - Approval workflows
- [Multi-Agent Tutorial](./MULTI_AGENT_TUTORIAL.md) - Agent collaboration
- [Phase 2 Quick Reference](./PHASE_2_QUICK_REFERENCE.md) - API reference

---

**Version:** 1.0
**Last Updated:** February 6, 2026
**Feedback:** Report issues at https://github.com/sjinnovation/sj-control-tower-framework/issues
