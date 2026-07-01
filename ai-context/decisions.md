# Technical Decisions

## AI Streaming Architecture

Decision:
Use SSE (Server-Sent Events) instead of WebSockets for AI streaming responses.

Reason:
- simpler implementation
- easier scaling
- works well for one-way AI token streaming
- lower infrastructure complexity

Status:
Active architecture pattern

## Four Spaces Information Architecture

Decision:
Reorganize navigation into four workspaces (Sales, Knowledge, Operations, EOS) with space-prefixed routes, unified `SpaceLayout`, and legacy redirects. Rollout gated by `features.enableFourSpaces` in `app_config`.

Reason:
- Reduce sidebar complexity and admin/app duplication
- Role-focused discoverability
- Backward-compatible migration via redirects

Status:
Implemented (feature flag off by default). See `docs/specs/four-spaces-ia.md`.

## Graphify Knowledge Graph (Postgres Adjacency)

Decision:
Implement Graphify as a Postgres adjacency-list graph layer (`graph_entities`, `graph_relationships`) with hybrid graph+vector retrieval via `performGraphAwareRetrieval`, gated by `features.enableGraphify` and per-agent `graphify_enabled`.

Reason:
- Reuses existing Supabase/RLS/multi-tenant patterns without Neo4j dependency for MVP
- Non-breaking opt-in extension of `semantic-search` and agent RAG
- Future-ready store adapter in `_shared/graphify-store.ts` for external graph engines

Status:
MVP implemented 2026-06-29. See `docs/06-ai-features/GRAPHIFY-SPEC.md`.