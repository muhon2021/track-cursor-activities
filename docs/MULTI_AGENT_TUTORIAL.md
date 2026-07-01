# Multi-Agent Collaboration Tutorial

Learn how to create teams of AI agents that work together to solve complex tasks.

## Table of Contents

1. [Introduction](#introduction)
2. [When to Use Multi-Agent Collaboration](#when-to-use)
3. [Collaboration Strategies](#collaboration-strategies)
4. [Creating Your First Team](#creating-your-first-team)
5. [Real-World Examples](#real-world-examples)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)

---

## Introduction

Multi-agent collaboration enables multiple AI agents to work together on complex tasks that require diverse skills, perspectives, or parallel processing. Instead of one agent doing everything, specialized agents collaborate based on their expertise.

**Benefits:**
- **Specialization**: Each agent focuses on what it does best
- **Parallel Processing**: Multiple agents work simultaneously
- **Quality Assurance**: Peer review and consensus building
- **Complex Workflows**: Break down large tasks into manageable pieces

---

## When to Use Multi-Agent Collaboration

### ✅ **Use Multi-Agent Teams When:**

1. **Task requires multiple skills**
   - Example: Website redesign needs design, development, copywriting, and SEO expertise

2. **Peer review is valuable**
   - Example: Code reviews from security, performance, and maintainability perspectives

3. **Parallel work speeds things up**
   - Example: Research synthesis where agents analyze different sources simultaneously

4. **Complex decision-making**
   - Example: Budget allocation requiring consensus from department heads

5. **Sequential escalation**
   - Example: Customer support (L1 → L2 → L3 based on complexity)

### ❌ **Don't Use Multi-Agent When:**

1. **Simple, single-skill task**
   - Example: Writing a single email (one agent is enough)

2. **Real-time chat required**
   - Example: Live customer support chat (handoffs add latency)

3. **Cost is a concern**
   - Multiple agents = multiple API calls = higher cost

4. **Task is time-sensitive**
   - Collaboration adds overhead (coordination, handoffs)

---

## Collaboration Strategies

Choose the right strategy for your use case:

### 1. **Sequential** 📋
Agents work one after another in a defined order (assembly line).

**Best For:**
- Customer support escalation
- Document review chain (draft → edit → approve)
- Project phases (research → design → implement → test)

**Example:**
```
User Query → L1 Support Agent → L2 Specialist → L3 Engineer
```

**When each agent:**
- Builds on previous work
- Requires output from the prior agent
- Has a clear handoff point

---

### 2. **Parallel** ⚡
Multiple agents work simultaneously on different aspects.

**Best For:**
- Research from multiple sources
- Multi-perspective analysis
- Speed-critical tasks

**Example:**
```
Research Topic
    ├─ Academic Papers Agent
    ├─ Industry Reports Agent
    ├─ News & Trends Agent
    └─ Social Media Agent

All feed into Summary Agent
```

**When:**
- Tasks are independent
- Speed is more important than cost
- You need multiple perspectives

---

### 3. **Hierarchical** 🎯
Coordinator agent delegates to specialists.

**Best For:**
- Complex project management
- Resource allocation
- Dynamic task breakdown

**Example:**
```
Project Manager Agent
    ├─ Assigns Design Agent (mockups)
    ├─ Assigns Dev Agent (implementation)
    ├─ Assigns QA Agent (testing)
    └─ Coordinates timeline
```

**When:**
- Task can be broken into subtasks
- You have a natural "leader" agent
- Dynamic delegation based on workload

---

### 4. **Consensus** 🤝
Agents discuss and reach agreement.

**Best For:**
- Strategic decisions
- Controversial topics
- Quality assurance through agreement

**Example:**
```
Code Review
    ├─ Security Agent (vulnerabilities)
    ├─ Performance Agent (optimization)
    ├─ Standards Agent (style guide)
    └─ Discussion → Consensus
```

**When:**
- Multiple valid approaches exist
- Group decision is more reliable
- You need buy-in from different perspectives

---

## Creating Your First Team

### Step 1: Define Your Agents

First, create individual agents with specific expertise:

```typescript
// 1. Design Agent
const designAgent = await createAgent({
  name: "UI/UX Designer",
  system_prompt: `You are an expert UI/UX designer. Focus on:
    - User-centered design principles
    - Modern design trends
    - Accessibility (WCAG compliance)
    - Mobile-first responsive design`,
  category: "design",
})

// 2. Developer Agent
const devAgent = await createAgent({
  name: "Full-Stack Developer",
  system_prompt: `You are a full-stack developer. Focus on:
    - Clean, maintainable code
    - Performance optimization
    - Security best practices
    - Modern frameworks (React, Node.js)`,
  category: "development",
})

// 3. QA Agent
const qaAgent = await createAgent({
  name: "Quality Assurance",
  system_prompt: `You are a QA specialist. Focus on:
    - Test coverage
    - Edge cases
    - Cross-browser compatibility
    - Performance testing`,
  category: "testing",
})
```

### Step 2: Create the Team

```typescript
import { useCreateTeam } from '@/hooks/useAgentCollaboration'

const createTeam = useCreateTeam()

const team = await createTeam.mutateAsync({
  name: "Website Redesign Team",
  description: "Specialized team for website redesign projects",
  team_type: "specialized",
  collaboration_strategy: "sequential", // Design → Dev → QA
  agent_ids: [
    designAgent.id,
    devAgent.id,
    qaAgent.id,
  ],
})
```

### Step 3: Configure Team Members (Optional)

Add roles and expertise tags:

```typescript
// In the database or through UI
await supabase
  .from('agent_team_members')
  .update({
    role: 'lead',
    expertise_tags: ['UI', 'UX', 'Figma', 'Design Systems'],
    priority_order: 1, // Goes first in sequential
  })
  .eq('team_id', team.id)
  .eq('agent_id', designAgent.id)

await supabase
  .from('agent_team_members')
  .update({
    role: 'specialist',
    expertise_tags: ['React', 'TypeScript', 'Node.js', 'API'],
    priority_order: 2, // Goes second
  })
  .eq('team_id', team.id)
  .eq('agent_id', devAgent.id)

await supabase
  .from('agent_team_members')
  .update({
    role: 'reviewer',
    expertise_tags: ['Testing', 'Automation', 'CI/CD'],
    priority_order: 3, // Goes last
  })
  .eq('team_id', team.id)
  .eq('agent_id', qaAgent.id)
```

### Step 4: Start Collaboration

```typescript
import { useStartCollaboration } from '@/hooks/useAgentCollaboration'

const startCollab = useStartCollaboration()

const session = await startCollab.mutateAsync({
  team_id: team.id,
  goal: `Redesign the homepage for Acme Corp:
    - Modern, clean design
    - Mobile responsive
    - Accessibility compliant
    - Fast loading time`,
  session_type: 'sequential', // Or override team default
  initial_context: {
    client: 'Acme Corp',
    deadline: '2024-03-15',
    budget: 5000,
    current_site: 'https://acme.com',
  },
})

console.log('Collaboration started:', session.session_id)
// Design Agent will start first, then handoff to Dev, then QA
```

---

## Real-World Examples

### Example 1: Customer Support Escalation (Sequential)

**Team:**
- L1 Support Agent (FAQ, basic troubleshooting)
- L2 Technical Agent (advanced troubleshooting)
- L3 Engineering Agent (bug fixes, escalations)

**Flow:**
```
Customer: "App crashes when uploading photos"
    ↓
L1 Agent: Checks FAQ, tries basic troubleshooting
    ↓ (If unresolved)
L2 Agent: Advanced diagnostics, log analysis
    ↓ (If bug found)
L3 Agent: Code review, bug fix
```

**Implementation:**
```typescript
const supportTeam = await createTeam({
  name: "Customer Support Team",
  collaboration_strategy: "sequential",
  agent_ids: [l1Agent.id, l2Agent.id, l3Agent.id],
})

// Customer query triggers team
await startCollaboration({
  team_id: supportTeam.id,
  goal: "Customer reports: App crashes when uploading photos from iPhone 15",
  initial_context: {
    user_id: "user_123",
    device: "iPhone 15 Pro",
    app_version: "3.2.1",
    error_logs: [...],
  },
})
```

---

### Example 2: Content Creation (Parallel)

**Team:**
- Research Agent (gathers data)
- Writer Agent (creates content)
- SEO Agent (optimizes)
- Editor Agent (final review)

**Flow:**
```
Topic: "AI in Healthcare 2024"
    ├─ Research Agent → academic papers
    ├─ Writer Agent → draft content
    └─ SEO Agent → keyword research
        ↓
All outputs → Editor Agent → final article
```

**Implementation:**
```typescript
const contentTeam = await createTeam({
  name: "Content Team",
  collaboration_strategy: "parallel",
  agent_ids: [researchAgent.id, writerAgent.id, seoAgent.id],
})

const session = await startCollaboration({
  team_id: contentTeam.id,
  goal: "Create comprehensive article: 'AI in Healthcare 2024'",
  session_type: "parallel",
})

// All agents work simultaneously
// Then manually aggregate results or use a coordinator
```

---

### Example 3: Code Review (Consensus)

**Team:**
- Security Agent
- Performance Agent
- Maintainability Agent

**Flow:**
```
Pull Request Submitted
    ↓
All agents review independently
    ↓
Discussion round (agents comment on each other's findings)
    ↓
Consensus: Approve / Request Changes / Reject
```

**Implementation:**
```typescript
const codeReviewTeam = await createTeam({
  name: "Code Review Team",
  collaboration_strategy: "consensus",
  agent_ids: [securityAgent.id, perfAgent.id, maintainAgent.id],
})

await startCollaboration({
  team_id: codeReviewTeam.id,
  goal: "Review PR #123: New payment processing feature",
  initial_context: {
    pr_number: 123,
    files_changed: ['payment.ts', 'checkout.tsx'],
    diff: "...",
  },
})
```

---

### Example 4: Project Planning (Hierarchical)

**Team:**
- Project Manager Agent (coordinator)
- Design Specialist
- Dev Specialist
- Marketing Specialist

**Flow:**
```
PM Agent receives project goal
    ↓
PM breaks into tasks:
    ├─ Design Agent: Create mockups
    ├─ Dev Agent: Set up infrastructure
    └─ Marketing Agent: Plan launch campaign
    ↓
PM coordinates timeline and dependencies
```

**Implementation:**
```typescript
const projectTeam = await createTeam({
  name: "Project Launch Team",
  team_type: "hierarchical",
  collaboration_strategy: "hierarchical",
  coordinator_agent_id: pmAgent.id, // PM coordinates
  agent_ids: [pmAgent.id, designAgent.id, devAgent.id, marketingAgent.id],
})

await startCollaboration({
  team_id: projectTeam.id,
  goal: "Launch new product: AI Writing Assistant",
  initial_context: {
    launch_date: "2024-04-01",
    target_audience: "Content creators",
    budget: 50000,
  },
})
```

---

## Best Practices

### 1. **Clear Agent Roles**

✅ **Good:**
```typescript
{
  name: "Security Reviewer",
  system_prompt: "Focus ONLY on security vulnerabilities: SQL injection, XSS, CSRF, auth issues",
  expertise_tags: ['security', 'OWASP', 'penetration-testing'],
}
```

❌ **Bad:**
```typescript
{
  name: "General Agent",
  system_prompt: "You can do anything",
  expertise_tags: [],
}
```

### 2. **Appropriate Team Size**

- **2-3 agents**: Ideal for most use cases
- **4-5 agents**: Complex projects only
- **6+ agents**: Rarely needed, high coordination overhead

### 3. **Strategy Selection**

| Use Case | Best Strategy | Why |
|----------|--------------|-----|
| Customer support | Sequential | Clear escalation path |
| Research | Parallel | Speed, multiple sources |
| Project management | Hierarchical | Natural delegation |
| Decision-making | Consensus | Group wisdom |

### 4. **Cost Management**

```typescript
// Track costs per session
const { data: session } = await supabase
  .from('agent_collaboration_sessions')
  .select('total_cost, total_tokens_used')
  .eq('id', sessionId)
  .single()

console.log(`Session cost: $${session.total_cost}`)
console.log(`Tokens used: ${session.total_tokens_used}`)
```

### 5. **Monitoring & Debugging**

```typescript
// View collaboration messages
const { data: messages } = await supabase
  .from('agent_collaboration_messages')
  .select(`
    *,
    from_agent:ai_agents!from_agent_id(name),
    to_agent:ai_agents!to_agent_id(name)
  `)
  .eq('session_id', sessionId)
  .order('created_at')

messages.forEach(msg => {
  console.log(`${msg.from_agent.name} → ${msg.to_agent.name}:`, msg.content)
})
```

### 6. **Handoff Quality**

Good handoff includes:
```typescript
await supabase
  .from('agent_handoffs')
  .insert({
    session_id,
    from_agent_id: currentAgent.id,
    to_agent_id: nextAgent.id,
    handoff_reason: "expertise_needed",
    context_summary: "Customer issue requires database expertise",
    work_completed: {
      steps_taken: ["Checked logs", "Verified credentials"],
      findings: "Database connection timeout after 30s",
    },
    work_remaining: {
      next_steps: ["Check DB server status", "Investigate query performance"],
      priority: "high",
    },
  })
```

---

## Troubleshooting

### Problem: Agents Not Communicating

**Symptoms:** Session stays in "active" but no messages

**Solutions:**
1. Check agent prompts include collaboration instructions
2. Verify team members are all `is_active = true`
3. Check session status isn't stuck

### Problem: Infinite Loops

**Symptoms:** Agents keep passing work back and forth

**Solutions:**
1. Set maximum handoffs per session
2. Define clear completion criteria
3. Add timeout to sessions

### Problem: High Costs

**Symptoms:** Session costs exceed budget

**Solutions:**
1. Use parallel only when needed (sequential is cheaper)
2. Set token limits per agent
3. Enable approval workflows for high-cost operations

### Problem: Poor Handoffs

**Symptoms:** Next agent doesn't have enough context

**Solutions:**
1. Require `context_summary` in handoffs
2. Automatically pass session context
3. Use structured handoff templates

---

## Next Steps

1. **Start Simple**: Create a 2-agent sequential team
2. **Monitor**: Watch the collaboration session in real-time
3. **Iterate**: Adjust agent prompts based on results
4. **Scale**: Add more agents as needed

**Further Reading:**
- [HITL Setup Guide](./HITL_SETUP_GUIDE.md) - Add human approvals
- [Phase 2 Quick Reference](./PHASE_2_QUICK_REFERENCE.md) - API documentation
- [Agent Performance Analytics](./AGENT_PERFORMANCE_ANALYTICS.md) - Monitor team effectiveness

---

**Have questions?** Check the [troubleshooting](#troubleshooting) section or review the [API reference](./PHASE_2_QUICK_REFERENCE.md).
