---
name: ai-agents-domain
description: "AI agents domain knowledge for the SJ Control Tower Framework. Triggers: agent, AI, chat, assistant, LLM, RAG, embeddings, MCP, guardrails, tools, orchestration."
---

# AI Agents Domain — SJ Control Tower Framework

## Domain Overview

This project implements a multi-agent AI system with:
- Configurable AI agents with custom system prompts, models, and tools
- RAG (Retrieval Augmented Generation) via vector embeddings and semantic search
- Agent orchestration for multi-agent collaboration
- MCP (Model Context Protocol) server integration
- Human-in-the-loop (HITL) approval workflows
- Guardrails and safety constraints
- Streaming chat responses
- Agent memory (short-term and long-term)

## Key Database Tables

### ai_agents
Stores agent configurations:
- `id`, `name`, `description`, `system_prompt`
- `model` — which LLM model to use
- `tools` — JSON array of tool definitions
- `temperature`, `max_tokens` — generation parameters
- `is_active`, `is_public`
- `created_by`, `organization_id`

### ai_agent_runs
Tracks agent execution history:
- `id`, `agent_id`, `user_id`
- `status` — running, completed, failed, cancelled
- `input`, `output`
- `tokens_used`, `execution_time_ms`
- `error_message`

### ai_chat_history
Stores conversation messages:
- `id`, `user_id`, `agent_id`, `conversation_id`
- `role` — system, user, assistant, tool
- `content` — message text
- `metadata` — tool calls, function results

### embeddings
Vector storage for RAG:
- `id`, `content` — text chunk
- `embedding` — vector (pgvector)
- `source_type` — knowledge_entry, meeting_transcript, document
- `source_id` — reference to source record
- `metadata` — additional context

### mcp_servers
MCP server configurations:
- `id`, `name`, `url`, `api_key`
- `capabilities` — JSON of server capabilities
- `is_active`

### approvals
HITL approval requests:
- `id`, `agent_id`, `user_id`
- `action_type`, `action_data`
- `status` — pending, approved, rejected
- `reviewer_id`, `reviewed_at`

## Key Edge Functions

### Chat & Conversation
- `ai-chat` — basic AI chat endpoint
- `ai-chat-assistant` — enhanced assistant with context
- `agent-chat-stream` — streaming chat responses
- `agent-conversation-chat` — multi-turn conversation management

### Agent Execution
- `run-ai-agent` — execute a single agent
- `orchestrate-agent-team` — multi-agent collaboration

### RAG & Knowledge
- `semantic-search` — vector similarity search
- `unified-knowledge-search` — search across all knowledge sources
- `generate-embeddings` — create vector embeddings
- `auto-embed-knowledge-entry` — auto-embed new KB entries
- `auto-embed-knowledge-files` — auto-embed uploaded files
- `auto-embed-meetings` — auto-embed meeting transcripts
- `gemini-rag-query` — RAG via Google Gemini
- `process-embedding-queue` — batch embedding processing
- `embedding-retention-cleanup` — clean old embeddings

### Agent Memory
- `extract-agent-memories` — extract memories from conversations
- `retrieve-agent-memories` — recall relevant memories
- `consolidate-agent-memories` — merge/compress memories

### MCP (Model Context Protocol)
- `execute-mcp-tool` — call a tool on an MCP server
- `verify-mcp-server` — check MCP server availability

### Safety & Guardrails
- `enforce-guardrails` — check agent actions against rules
- `validate-guardrails` — validate guardrail configurations
- `request-approval` — create HITL approval request
- `respond-to-approval` — approve/reject pending actions

### Specialized AI
- `deal-coach` — sales coaching AI
- `eos-triage-assistant` — EOS issue triage
- `suggest-okrs` — AI-generated OKR suggestions
- `analyze-okr-progress` — OKR progress analysis
- `generate-meeting-summary` / `v2` — meeting summarization
- `meeting-efficiency-analyzer` — meeting quality analysis
- `lead-followup-research` — lead research AI
- `generate-conversation-opener` — AI conversation starters

## Key Frontend Hooks

- `useAIAgents.ts` — agent CRUD operations
- `useAIChatAssistant.ts` — AI chat management
- `useAgentChatStream.ts` — streaming chat hook
- `useAgentConversations.ts` — conversation management
- `useAgentCollaboration.ts` — multi-agent workflows
- `useActiveCollabTasks.ts` — active collaboration tracking
- `useAgentTools.ts` — agent tool management
- `useAgentMemory.ts` — agent memory operations
- `useMCPServers.ts` — MCP server management
- `useGuardrails.ts` — guardrail configuration
- `useApprovals.ts` — HITL approval management
- `useSemanticSearch.ts` — vector search
- `useModelSync.ts` — AI model synchronization

## Key Frontend Components

- `src/components/ai/` — AI chat interface, message bubbles, input
- `src/components/agent/` — Agent configuration, tool setup, run history
- `src/components/mcp/` — MCP server management UI

## Architecture Patterns

### Agent Execution Flow
```
User Message → Frontend (useAgentChatStream)
  → Edge Function (agent-chat-stream)
    → Load agent config from ai_agents table
    → Retrieve relevant memories (retrieve-agent-memories)
    → RAG: semantic search for context (semantic-search)
    → Enforce guardrails (enforce-guardrails)
    → Call LLM (OpenAI API)
    → If tool call needed:
      → Check approval required (request-approval)
      → Execute tool (execute-mcp-tool or built-in)
      → Feed result back to LLM
    → Stream response back to frontend
    → Save to ai_chat_history
    → Extract memories (extract-agent-memories)
```

### RAG Pipeline
```
Content Ingestion:
  Knowledge Entry → auto-embed-knowledge-entry → generate-embeddings → embeddings table
  Meeting Transcript → auto-embed-meetings → generate-embeddings → embeddings table
  Uploaded File → auto-embed-knowledge-files → generate-embeddings → embeddings table

Query Time:
  User Query → generate embedding → cosine similarity search → top-K results → LLM context
```

### Multi-Agent Orchestration
```
orchestrate-agent-team:
  1. Receive task and team configuration
  2. Select lead agent
  3. Lead agent decomposes task
  4. Assign subtasks to specialist agents
  5. Each agent executes with guardrails
  6. Collect and merge results
  7. Lead agent synthesizes final response
```

## AI Model Configuration

Models synced from OpenAI via `sync-ai-models` Edge Function. Agent configs reference model IDs. Temperature and max_tokens configurable per agent.

## Security Considerations

- Agent system prompts are not exposed to users
- Guardrails enforce action boundaries
- HITL approvals required for sensitive operations
- API keys (OpenAI, etc.) stored as Edge Function secrets only
- Agent actions logged in ai_agent_runs for audit trail
- RLS ensures users can only access their own chat history

## Terminology

| Term | Meaning |
|------|---------|
| Agent | Configured AI entity with specific role, tools, and behavior |
| RAG | Retrieval Augmented Generation — enhancing LLM with relevant context |
| Embedding | Vector representation of text for similarity search |
| MCP | Model Context Protocol — standard for AI tool integration |
| HITL | Human-in-the-Loop — requiring human approval for agent actions |
| Guardrails | Rules constraining what agents can do |
| Tool | Function an agent can call (MCP tool, built-in action) |
| Memory | Persistent facts extracted from agent conversations |
| Orchestration | Coordinating multiple agents on a complex task |
