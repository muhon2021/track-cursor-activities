# Graphify Module

Graph intelligence layer for relationship-based retrieval and hybrid RAG context.

## Routes

- `/graphify/search` — entity and context search
- `/graphify/explorer` — interactive graph visualization (pan, zoom, expand)
- `/graphify/entity/:id` — entity detail with neighbors
- `/admin/graphify` — dashboard (counts, health)
- `/admin/graphify/analytics` — charts and token savings metrics
- `/admin/graphify/coverage` — health score, orphans, sparse topics, sync suggestions
- `/admin/graphify/config` — traversal and extraction settings
- `/admin/graphify/sync` — backfill job status

## Feature Flags

- Build-time: `VITE_MODULE_GRAPHIFY=true`
- Runtime: `features.enableGraphify` in `app_config` (default `false`)
- Per-agent: `ai_agents.graphify_enabled`

## Edge Functions

- `graphify-query` — search, traverse, neighbors, summary
- `graphify-backfill` — batch sync entities and relationships
- `graphify-sync-relationships` — FK edge sync
- `graphify-analytics` — admin analytics (growth, queries, token savings)
- `graphify-coverage` — health score and remediation suggestions

## Hooks

- `useGraphSearch` — entity/context search
- `useGraphNeighbors` — 1-hop expansion
- `useGraphExplorer` — visual explorer state (traverse, expand)
- `useGraphEntitySummary` — entity detail + stats
- `useGraphifyStats` — entity/relationship counts
- `useGraphifyAnalytics` — admin charts data
- `useGraphifyCoverage` — health score and gap analysis

## Integration

When enabled, `agent-conversation-chat` uses `performGraphAwareRetrieval` instead of plain vector search for agents with `graphify_enabled`.

## Phase 6 — Performance & tests

- **Traversal cache**: in-memory (60s) + `graphify_traversal_cache` table (5 min, per user); invalidated on backfill/sync
- **Indexes**: tenant-scoped relationship indexes for BFS walks
- **Search dedupe**: `graphify_match_entities` returns one row per `(entity_type, canonical_name)`, preferring `source_id` links
- **Client**: `dedupeSearchEntities`, React Query `staleTime` on graph hooks
- **Tests**: `npm run test:run` — Vitest unit tests for layout utils and graph contracts

Apply migration: `supabase/migrations/20260629170000_graphify_phase6_perf.sql` (or tail of `RUN_IF_graphify_MISSING.sql`).
