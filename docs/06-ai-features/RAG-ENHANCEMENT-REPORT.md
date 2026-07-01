# RAG Enhancement — Implementation Report

**Date:** 2026-06-17  
**Status:** Complete

## 1. Architecture Audit

See [RAG-ENHANCEMENT-SPEC.md](./RAG-ENHANCEMENT-SPEC.md) and plan Phase 1. Key findings: fixed 800-char chunking, no reranking, non-idempotent embeddings, broken embedding queue, simulated analytics.

## 2. Chunking Configuration

- **DB:** `kb_source_config` with strategies: fixed, sentence-window, heading-aware, parent-child
- **Backend:** `supabase/functions/_shared/chunking/` module
- **UI:** `/admin/knowledge/source-config` with preview via `kb-chunk-preview`
- **Ingestion:** `generate-embeddings` loads per-source config, idempotent delete-before-insert

## 3. Reranker Implementation

- **Providers:** Cohere, Voyage, BGE, Custom (`_shared/reranker.ts`)
- **Global defaults:** `system_settings` category `rag`
- **Per-source override:** `kb_source_config.reranker_override_global`
- **Pipeline:** `_shared/rag-retrieval.ts` integrated into `semantic-search`, `gemini-rag-query`

## 4. Playground Implementation

- **Route:** `/admin/knowledge/playground`
- **Edge function:** `kb-rag-playground` — retrieval, rerank, generation, metrics, eval save
- **Tables:** `kb_eval_runs`, `kb_eval_results`, `kb_eval_test_cases`

## 5. Re-embedding Implementation

- **Edge function:** `kb-bulk-reembed` — start/pause/resume/cancel/process
- **Tables:** `kb_reembed_jobs`, `kb_reembed_job_items`
- **UI:** Re-Embed All on Source Config page with progress controls

## 6. Sync Management

- **Edge function:** `kb-sync-action` — per-doc and bulk retry/requeue
- **UI:** Enhanced `SyncStatusSection` with document table and actions
- **Column:** `knowledge_files.last_sync_attempt_at`

## 7. Permissions Matrix

- **Table:** `kb_source_permissions` (app_role × source × permissions JSONB)
- **RPC:** `check_kb_source_permission`
- **UI:** `/admin/knowledge/permissions`

## 8. Memory Administration

- **Route:** `/admin/memory/admin`
- **RPCs:** `admin_list_user_memories`, `admin_export_user_memories`
- **Edge function:** `admin-memory-actions`
- **Soft delete:** `agent_memories.deleted_at`, `deleted_by`

## 9. Database Changes

Migration: `supabase/migrations/20260617120000_kb_rag_enhancement.sql`

## 10. New APIs / Edge Functions

| Function | Purpose |
|----------|---------|
| `kb-chunk-preview` | Chunk preview + cost estimate |
| `kb-rag-playground` | Full RAG inspection + eval |
| `kb-bulk-reembed` | Bulk re-embed job control |
| `kb-sync-action` | Sync retry/requeue |
| `admin-memory-actions` | Memory GDPR admin |

## 11. Security Improvements

- RLS on all new tables (admin write)
- Tightened `knowledge_sources` and `embedding_queue` to admin-only write
- Admin auth on all new edge functions via `requireAdmin`
- Activity logging for sync actions and memory admin

## 12. Performance Improvements

- Wider candidate pool (match_count × 3) before reranking
- Idempotent re-embed prevents duplicate vectors
- Real `vector_search_logs` instrumentation (no simulated metrics)
- Knowledge Health dashboard with live metrics

## 13. Migration Notes

```bash
npm run migrations:run
```

Deploy edge functions and set secrets: `COHERE_API_KEY`, `VOYAGE_API_KEY`, `RERANKER_CUSTOM_URL` (optional).

Re-embed sources after changing chunk config via Source Config → Re-Embed All.

## 14. Breaking Changes

| Change | Mitigation |
|--------|------------|
| `generate-embeddings` deletes existing chunks | Use bulk re-embed UI |
| `semantic-search` uses model registry | Ensure default embedding model is 1536d |
| Source permissions filter when rows exist | Default permissive when no permission rows |
| Reranker disabled by default | Enable in global or per-source settings |
