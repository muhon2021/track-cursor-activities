# Knowledge Base Embedding Strategy

**Context:** Users upload files to the Knowledge Base (stored in **AWS S3**). Some of those files are later attached to **AI agents** for RAG. This document compares when to generate embeddings:

1. **Option A — at file upload** (eager / upload-time indexing)
2. **Option B — at agent creation or file attachment** (lazy / on-demand indexing)

It also covers where vectors should live: **Supabase (pgvector)** vs **provider-managed storage** (OpenAI Vector Stores, etc.).

---

## Shared assumptions

| Layer | Responsibility |
|-------|----------------|
| **File storage** | AWS S3 (`knowledgebase/<userId>/<fileId>.<ext>`) |
| **File metadata** | Supabase `files` table (stable `file_id`, `s3_key`, `mime_type`, owner, sharing) |
| **RAG retrieval** | One org-wide or scoped embedding index queried at agent runtime |
| **Agents** | Reference knowledge files by **stable file ID**, not by re-uploading blobs |

Embeddings are **not the same thing** as file storage. A file can exist in S3 without ever being embedded. An embedding is a derived artifact: chunked text + vector(s) used for semantic search.

---

## Option A — Embed during Knowledge Base upload

### Flow

```text
User uploads file
  → Save to S3
  → Insert row in `files`
  → Parse/chunk document
  → Generate embeddings
  → Store vectors (Supabase or provider)
  → Mark file `processing_status = completed`
```

### Pros

| Benefit | Why it matters |
|---------|----------------|
| **Fast agent attach** | Attaching a file to an agent is instant — vectors already exist |
| **Reusable across agents** | One embedding job per file; many agents can reference the same `file_id` |
| **Unified search** | Knowledge Base semantic search works immediately without waiting on agent setup |
| **Predictable pipeline** | Upload → queue → embed is a single async workflow (`embedding_queue` pattern) |
| **Better UX for “search my files”** | Users can find content inside documents before any agent exists |

### Cons

| Drawback | Why it matters |
|----------|----------------|
| **Wasted cost** | Many uploaded files are never used in agents; you still pay parse + embed + storage |
| **Stale vectors** | File replaced/overwritten in S3 requires re-embedding; easy to forget if upload path is decoupled from agents |
| **Higher baseline load** | Bulk uploads (20 files, folders, migrations) spike embedding queue immediately |
| **Model lock-in earlier** | If embeddings are stored in OpenAI Vector Stores at upload time, switching models/providers is harder |
| **Privacy surface** | Content is sent to an embedding provider even when user only wanted archival storage |

### Best when

- Most uploaded files are expected to be searched or used in RAG soon
- Org-wide knowledge search is a first-class product feature
- Upload volume is moderate and cost is acceptable
- You want the simplest agent-attach UX

---

## Option B — Embed when files are attached to an agent

### Flow

```text
User uploads file
  → Save to S3
  → Insert row in `files` (processing_status = pending or skipped)

User creates/edits agent and attaches file IDs
  → Resolve files from `files` by ID
  → Download from S3 (or stream)
  → Parse/chunk only attached files
  → Generate embeddings
  → Store vectors scoped to agent (or shared index with agent/file metadata)
  → Save agent ↔ file references (e.g. knowledgeConfig.file_ids)
```

### Pros

| Benefit | Why it matters |
|----------|----------------|
| **No unnecessary embeddings** | Only files actually used in agents incur parse/embed cost |
| **Clear intent** | Embedding happens when user explicitly opts into RAG |
| **Lower storage growth** | Fewer chunks/vectors in Supabase or provider stores |
| **Fits S3-first storage** | S3 remains source of truth; embeddings are a derived cache |
| **Easier cost attribution** | Per-agent or per-user embedding cost is traceable |
| **Provider vector stores align naturally** | OpenAI “upload to vector store for this assistant” maps well to agent attach time |

### Cons

| Drawback | Why it matters |
|----------|----------------|
| **Slower agent setup** | User waits (or sees “indexing…”) when attaching files |
| **Duplicate work without dedup** | Same file attached to 3 agents may embed 3 times unless you deduplicate by `file_id` |
| **No global file search until embedded** | Knowledge Base search over document content requires a separate path or manual “index for search” action |
| **More orchestration** | Agent save must trigger async jobs, handle failures, and block/partial-enable RAG |
| **Re-attach complexity** | Detach/reattach, agent clone, and file version changes need explicit re-index rules |

### Best when

- Upload volume is high but only a small fraction goes to agents
- Cost control is important
- Agents are the primary (or only) RAG entry point
- You are fine with async “indexing” states in the agent UI

---

## Where to store embeddings

This choice is **orthogonal** to upload-time vs agent-time, but it changes cost, portability, and multi-agent reuse.

### Supabase (pgvector) — recommended for a single shared RAG system

```text
files (S3 metadata)  →  embeddings table
  file_id, chunk_index, content, embedding vector(1536), metadata JSONB
```

| Pros | Cons |
|------|------|
| One index for agents, admin tools, and global search | You operate chunking, dimension upgrades, and index tuning |
| Query with metadata: `file_id`, `agent_id`, `owner_id`, `source_type` | Large corpora need IVFFLAT/HNSW tuning and retention policies |
| No vendor lock-in for retrieval SQL | Re-embedding on model change is your migration |
| Same stack as existing `embeddings` + `embedding_queue` | |

**Multi-agent reuse pattern:** embed once per `file_id` (at upload or first attach), store `file_id` on each chunk row; agents filter `WHERE file_id IN (...)` or via a join table `agent_knowledge_files(agent_id, file_id)`.

### Provider storage (OpenAI Vector Stores / similar)

```text
S3 file  →  upload to provider  →  vector_store_id linked on agent
```

| Pros | Cons |
|------|------|
| Less ingestion code; provider handles chunking/indexing | Harder to share one file across agents without duplicate uploads |
| Native integration with Assistants / Responses API | Retrieval logic split between Supabase (metadata) and provider (vectors) |
| Good fit for **Option B** (embed at agent attach) | Switching provider or model often means re-upload + re-index |
| | Cross-agent analytics and unified search are weaker |

**When to use:** agent-specific corpora, rapid MVP, or when you standardize on one provider’s agent runtime end-to-end.

---

## Side-by-side summary

| Criteria | Option A — upload-time | Option B — agent attach-time |
|----------|------------------------|------------------------------|
| Embedding cost | Higher (all uploads) | Lower (only attached files) |
| Agent attach speed | Fast | Slower (indexing step) |
| Knowledge Base semantic search | Ready immediately | Needs separate indexing action or agent scope only |
| Multi-agent reuse | Natural with shared `file_id` index | Needs dedup by `file_id` |
| S3 as source of truth | Yes, but vectors can drift if file updated | Yes, clear: embed from S3 on demand |
| Operational complexity | Simpler agent path | Simpler upload path, harder agent save path |
| OpenAI Vector Store fit | Weaker (early provider coupling) | Stronger |
| Supabase pgvector fit | Strong | Strong **if** you deduplicate by `file_id` |

---

## Recommendation for this project

Use a **hybrid lazy model** that behaves like **Option B by default**, with optional eager indexing:

### Default: embed on first use (agent attach or explicit “Index for search”)

1. **Upload** → S3 + `files` row only (`processing_status = pending`).
2. **Agent attach** → enqueue `embedding_queue` for those `file_id`s only.
3. **Dedup** → before embedding, check if chunks already exist for `file_id` + `embedding_model`; skip if fresh.
4. **Agent runtime** → query Supabase `embeddings` filtered by attached `file_id`s (and permissions).

This avoids unnecessary embeddings for files that are only stored or shared, while still allowing one embed per file to be reused across multiple agents.

### Optional: eager embed on upload (feature flag or user toggle)

- “Index immediately for search” on upload dialog
- Or auto-index for certain folders / file types (e.g. PDF policy docs)

### Storage recommendation

| Component | Store in |
|-----------|----------|
| Raw files | **AWS S3** |
| Metadata, sharing, agent links | **Supabase** (`files`, `agent_knowledge_files`) |
| Embeddings for unified RAG | **Supabase pgvector** (`embeddings` or `knowledge_embeddings`) |
| Provider file IDs (if used) | `files.openai` JSONB — cache only, not primary index |

Keep OpenAI (or other providers) for **generation**, not as the primary long-term vector store, unless a specific agent is locked to that provider’s Assistants API.

---

## Implementation sketch (recommended path)

### Tables

```sql
-- Agent ↔ knowledge file attachment (many-to-many)
agent_knowledge_files (
  agent_id uuid references ai_agents(id),
  file_id uuid references files(id),
  added_at timestamptz default now(),
  primary key (agent_id, file_id)
);

-- Embeddings keyed by stable file_id (reusable across agents)
embeddings (
  id uuid,
  file_id uuid references files(id),
  chunk_index int,
  content text,
  embedding vector(1536),
  embedding_model text,
  metadata jsonb,
  created_at timestamptz
);
```

### Triggers

| Event | Action |
|-------|--------|
| File uploaded | S3 put + `files` insert; **no** embed by default |
| File attached to agent | Insert `agent_knowledge_files`; enqueue embed if not indexed |
| File detached from all agents | **Do not** delete embeddings immediately (optional TTL job) |
| File deleted from KB | Delete S3 object + embeddings for `file_id` |
| File overwritten | Bump version; invalidate embeddings; re-queue on next attach |

### API shape (aligns with existing guide)

```text
POST /api/rag/agents/:agentId/upload-knowledge-files
body: { fileIds: string[], useDoclingParse?: boolean }
```

Resolve `fileIds` → S3 paths → chunk → embed → store in Supabase → link on agent.

---

## Decision guide

Choose **Option A (upload-time)** if:

- Semantic search across all uploads is a core feature from day one
- Upload-to-agent ratio is high (>50% of files end up in RAG)
- You accept higher embedding spend for simpler agent UX

Choose **Option B (agent attach-time)** if:

- Knowledge Base is primarily file management + selective RAG
- Cost and storage growth matter
- Files in S3 often never touch an agent

Choose **hybrid (recommended)** if:

- You want both: cheap storage for everyone, embeddings only when needed
- Multiple agents may share the same files (dedup by `file_id`)
- You want one Supabase-backed RAG layer with S3 as the blob store

---

## Related docs

- [KNOWLEDGEBASE_IMPLEMENTATION.md](../../../KNOWLEDGEBASE_IMPLEMENTATION.md) — file/folder model and agent file ID flow
- [KNOWLEDGE-GAP-ANALYSIS.md](./KNOWLEDGE-GAP-ANALYSIS.md) — current `embeddings`, `embedding_queue`, and edge functions
