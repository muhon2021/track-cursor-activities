# Feature: RAG Enhancement & Knowledge Platform Simplification

> Enterprise-grade RAG operations: per-source chunking, reranking, evaluation playground, bulk re-embedding, sync management, permissions, and memory administration.

**Status**: In Progress  
**Module**: knowledge, admin  
**Date**: 2026-06-17

## Overview

Upgrades the Knowledge Base retrieval pipeline from fixed character chunking and single-stage vector search to a configuration-driven, reranked, observable RAG stack. Administrators configure chunking and reranking per knowledge source, evaluate retrieval quality in a playground, bulk re-embed documents, manage sync retries, enforce source-level permissions, and administer user memories for GDPR compliance.

## User Stories

- As an admin, I want per-source chunking settings so that Confluence and Notion documents are split optimally.
- As an admin, I want reranking so that the most relevant chunks surface above vector similarity alone.
- As an admin, I want a RAG playground to inspect retrieval quality and save evaluation test cases.
- As an admin, I want bulk re-embed with progress controls so I never run manual SQL.
- As an admin, I want per-document sync retry/requeue without leaving the dashboard.
- As an admin, I want a permissions matrix (role × team × source) for fine-grained access.
- As an admin, I want memory search/delete/export for GDPR compliance.

## Database Design

### New Tables

| Table | Purpose |
|-------|---------|
| `kb_source_config` | Per-source chunking + reranker settings |
| `kb_eval_runs` | RAG playground evaluation runs |
| `kb_eval_results` | Per-chunk scores for each eval run |
| `kb_eval_test_cases` | Saved test cases |
| `kb_reembed_jobs` | Bulk re-embed job tracking |
| `kb_reembed_job_items` | Per-document re-embed status |
| `kb_source_permissions` | Role/team/department × source permissions |

### Schema Changes

- `agent_memories`: add `deleted_at`, `deleted_by` (soft delete)
- `knowledge_files`: add `last_sync_attempt_at`
- `system_settings`: seed RAG reranker global defaults (category `rag`)

### RPCs

- `check_kb_source_permission(source_id, permission)` — permission check
- `admin_list_user_memories(p_user_id)` — admin memory listing
- `admin_export_user_memories(p_user_id)` — GDPR export JSON

## API Design

| Edge Function | Method | Auth | Purpose |
|---------------|--------|------|---------|
| `kb-chunk-preview` | POST | Admin | Preview chunks + cost estimate |
| `kb-rag-playground` | POST | Admin | Full RAG pipeline inspection |
| `kb-bulk-reembed` | POST | Admin | Start/pause/resume/cancel re-embed jobs |
| `kb-sync-action` | POST | Admin | Retry/requeue documents |
| `admin-memory-actions` | POST | Admin | View/delete/export user memories |

Refactored: `generate-embeddings`, `semantic-search`, `gemini-rag-query`, `process-embedding-queue`

## Frontend Routes

| Route | Page |
|-------|------|
| `/admin/knowledge/source-config` | KnowledgeSourceConfig |
| `/admin/knowledge/playground` | KnowledgePlayground |
| `/admin/knowledge/permissions` | KnowledgePermissions |
| `/admin/memory/admin` | MemoryAdministration |

## Chunking Strategies

1. `fixed` — character size + overlap
2. `sentence-window` — N sentences before/after anchor
3. `heading-aware` — split on H1/H2/H3 markdown
4. `parent-child` — parent document ref + child chunks

## Reranker Providers

Cohere, Voyage, BGE, Custom — global defaults in `system_settings`, per-source override in `kb_source_config`.

## Security

- RLS on all new tables (admin write, authenticated read where permitted)
- Admin-only edge functions via `validateAuth` + `has_role(admin)`
- Audit logging for config changes, memory delete/export, re-embed jobs

## Breaking Changes

- `generate-embeddings` deletes existing chunks before insert (idempotent)
- `semantic-search` response may include `rerank_score` fields (backward compatible)
