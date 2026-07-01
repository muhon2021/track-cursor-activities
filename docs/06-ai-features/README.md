# AI Features

CollabAi includes powerful AI capabilities for chat, summarization, semantic search, and custom agents.

---

## AI Providers

| Provider | Setup Required | Best For |
|----------|----------------|----------|
| [Lovable AI](./lovable-ai.md) | None (included) | Quick setup, Lovable users |
| [OpenAI](./provider-routing.md) | API key | GPT-4, advanced features |
| [Anthropic](./provider-routing.md) | API key | Claude, long context |
| [Google AI](./provider-routing.md) | API key | Gemini, multimodal |

---

## Features Overview

### AI Chat Assistant
Interactive chat interface for asking questions about your data.

- Query knowledge base articles
- Summarize meeting transcripts
- Get insights from client data
- [Learn more →](./ai-chat.md)

### AI Agents
Configurable AI agents for specific tasks.

- Meeting summarizer
- Document analyzer
- Task extractor
- Custom agents
- [Learn more →](./ai-agents.md)

### Semantic Search
Find information using natural language, not just keywords.

- Search across all knowledge base
- Include meeting transcripts
- Personal knowledge files
- [Learn more →](./semantic-search.md)

### Embeddings & RAG
Retrieval-Augmented Generation for accurate AI responses.

- Automatic embedding generation
- Vector similarity search
- Context-aware responses
- [Learn more →](./embeddings.md)

---

## Quick Start

### Using Lovable AI (Recommended)
If you're using Lovable Cloud, AI features work automatically:

1. Enable AI Chat in Admin → Features
2. Start chatting!

No API key needed.

### Using Your Own API Key
For self-hosted or custom models:

1. Add API key to edge function secrets
2. Configure provider in Admin → AI Settings
3. Select your preferred model

---

## Files in This Section

| File | Description |
|------|-------------|
| [lovable-ai.md](./lovable-ai.md) | Using Lovable's built-in AI |
| [provider-routing.md](./provider-routing.md) | Configuring AI providers |
| [ai-chat.md](./ai-chat.md) | AI Chat feature guide |
| [ai-agents.md](./ai-agents.md) | Custom AI agents |
| [semantic-search.md](./semantic-search.md) | Natural language search |
| [embeddings.md](./embeddings.md) | How embeddings work |

---

## Feature Flags

AI features can be toggled in Admin → System Settings:

| Flag | Default | Description |
|------|---------|-------------|
| `enableAIChat` | On | AI Chat interface |
| `enableAIAgents` | On | Custom AI agents |
| `enableSemanticSearch` | On | Vector search |
| `enableMeetingSummary` | On | Auto-summarize meetings |
