# Feature: Graphify – Enterprise Knowledge Graph & Context Intelligence

> Graph-aware retrieval layer that connects entities, documents, memories, and domain objects for relationship-based context and hybrid RAG.

**Status**: Complete (Phases 0–6)  
**Module**: graphify, knowledge, admin  
**Date**: 2026-06-29

## Overview

Graphify extends the existing vector RAG stack with a Postgres adjacency-list knowledge graph. It syncs entities and relationships from CRM, meetings, tasks, EOS, knowledge base, and agent memories; supports graph traversal queries; and merges graph context with vector search for AI agents. All features are configuration-driven and gated behind `features.enableGraphify` (default off).

## User Stories

- As a user, I want to search the knowledge graph by topic or entity name so I can discover related meetings, tasks, and documents.
- As an admin, I want to backfill graph nodes from existing FK relationships so the graph reflects current data without manual entry.
- As an admin, I want to configure traversal depth and node limits to prevent graph explosion.
- As an AI agent operator, I want agents with Graphify enabled to receive graph-expanded context alongside vector chunks.
- As an admin, I want graph queries to respect RBAC and KB source permissions so unauthorized entities are never exposed.

## Database Design

### New Tables

| Table | Purpose |
|-------|---------|
| `graph_entities` | Canonical graph nodes with tenant isolation |
| `graph_entity_aliases` | Alias merge / deduplication |
| `graph_relationships` | Directed edges with type, weight, confidence |
| `graph_memory_links` | Bridge `agent_memories` to graph entities |
| `graph_query_logs` | Query audit and latency metrics |
| `graphify_config` | Per-tenant Graphify settings |
| `graphify_sync_jobs` | Backfill job tracking |

### Schema Changes

- `ai_agents`: add `graphify_enabled BOOLEAN DEFAULT false`

### Entity Types

`User`, `Department`, `Meeting`, `Task`, `Issue`, `Rock`, `Document`, `Chunk`, `Source`, `Agent`, `Memory`, `Integration`, `Customer`, `Deal`, `Account`, `Team`, `EosTeam`, `Topic`

### Relationship Types

`OWNS`, `WORKS_WITH`, `BELONGS_TO`, `REFERENCES`, `MENTIONS`, `ASSIGNED_TO`, `DEPENDS_ON`, `LINKED_TO`, `RELATED_TO`, `GENERATED_BY`

### RPCs

- `graphify_match_entities(tenant_id, query, entity_types[], limit)` — name/alias search (dedupes by type+name)
- `graphify_traverse(tenant_id, seed_ids[], depth, rel_types[], max_nodes)` — BFS traversal
- `graphify_entity_neighbors(entity_id, direction, rel_types[], limit)` — 1-hop neighbors
- `graphify_can_access_entity(user_id, entity_id)` — permission check for RLS
- `graphify_count_orphans` / `graphify_list_orphans` / `graphify_topic_mention_stats` — coverage RPCs
- `graphify_invalidate_traversal_cache(tenant_id)` — purge traverse cache after sync

## API Design

| Edge Function | Auth | Purpose |
|---------------|------|---------|
| `graphify-query` | JWT | Entity search, traversal, neighbors, summary |
| `graphify-backfill` | Admin/service | Batch entity + relationship sync |
| `graphify-sync-relationships` | Admin/service | FK relationship sync |
| `graphify-extract-entities` | Service | Optional LLM entity extraction |
| `graphify-analytics` | Admin | Entity growth, query volume, token savings |
| `graphify-coverage` | Admin | Health score, orphans, sparse topics, suggestions |

Refactored (optional graph path): `semantic-search`, `agent-conversation-chat`, `performRetrieval`

## Frontend Routes

| Route | Page |
|-------|------|
| `/graphify/search` | GraphSearch |
| `/graphify/explorer` | GraphExplorer |
| `/graphify/entity/:id` | EntityDetail |
| `/admin/graphify/coverage` | GraphifyCoverage |
| `/admin/graphify/config` | GraphifyConfig |
| `/admin/graphify/sync` | GraphifySyncStatus |

## Security

- RLS on all graph tables with `tenant_id = get_user_tenant_id()`
- `graphify_can_access_entity()` for entity-level access
- KB-linked entities respect `check_kb_source_permission`
- User-scoped entities (memories, personal knowledge) require ownership
- Admin sync jobs require `has_role(admin)` or `graphify.manage` permission
- Query logs: users see own; admins see all

## Breaking Changes

None. Graphify is opt-in via feature flag and per-agent `graphify_enabled`.
