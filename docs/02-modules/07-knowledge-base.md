# Knowledge Base — Module Blueprint

## Overview

The Knowledge Base module provides organization-wide and personal knowledge management. It includes document storage and categorization, file uploads with AI-generated summaries, semantic search via vector embeddings, personal knowledge management, Google Drive integration, and the RAG query pipeline.

## Module Name

`Knowledge` (in `app_modules` and navigation, slug: `knowledge`)

## Routes Owned

From `src/modules/knowledge/routes.tsx`:

```
/knowledge                     → Knowledge listing
/knowledge/upload              → Upload knowledge files
/knowledge/personal            → Personal knowledge
/knowledge/search              → Semantic search
/knowledge/category/:slug      → Knowledge by category
/knowledge/new                 → Create knowledge entry
/knowledge/:id                 → Knowledge detail
/knowledge/:id/edit            → Edit knowledge entry
```

Admin routes (from `src/modules/admin/routes.tsx`):

```
/admin/knowledge/dashboard     → Unified knowledge command center (Health tab)
/admin/knowledge/source-config → Per-source chunking & reranker config
/admin/knowledge/playground    → RAG evaluation playground
/admin/knowledge/permissions   → Source permissions matrix
/admin/knowledge/categories    → Category management
/admin/knowledge/files         → Knowledge file management
/admin/knowledge/embeddings    → Embeddings explorer
/admin/memory/admin            → GDPR memory administration
```

---

## File Inventory

### Pages (7 files in `src/modules/knowledge/pages/`)

| File | Purpose | Route |
|------|---------|-------|
| `Knowledge.tsx` | Knowledge entry listing | `/knowledge` |
| `KnowledgeForm.tsx` | Create/edit entry with AI summary | `/knowledge/new`, `/knowledge/:id/edit` |
| `KnowledgeDetail.tsx` | Entry detail with related articles | `/knowledge/:id` |
| `KnowledgeUpload.tsx` | File upload for knowledge base | `/knowledge/upload` |
| `KnowledgeByCategory.tsx` | Entries filtered by category | `/knowledge/category/:slug` |
| `PersonalKnowledge.tsx` | Personal knowledge management | `/knowledge/personal`, `/personal-knowledge` |
| `SemanticSearch.tsx` | Semantic search with vector/text toggle | `/knowledge/search` |

### Components (2 files in `src/modules/knowledge/components/`)

| File | Purpose |
|------|---------|
| `GoogleDriveFilePicker.tsx` | Google Drive file selection for sync |
| `RelatedArticles.tsx` | Related articles section for knowledge detail |

### Hooks (6 files in `src/modules/knowledge/hooks/`)

| Hook | Purpose | Tables Queried |
|------|---------|----------------|
| `useKnowledge.ts` | Knowledge entry CRUD, categories, embedding triggers | `knowledge_entries`, `knowledge_categories` |
| `useKnowledgeBase.ts` | Knowledge base queries (planned, partially used) | `knowledge_files` |
| `useKnowledgeAdmin.ts` | Admin analytics and management (planned, partially used) | `knowledge_files`, `knowledge_embeddings` |
| `useUserKnowledge.ts` | Personal knowledge CRUD + file processing | `user_knowledge_files`, `user_knowledge_sources`, `unified_documents` |
| `useSemanticMemorySearch.ts` | Semantic memory search via edge function | — |
| `useAgentPersonalizations.ts` | Agent personalization preferences | `agent_personalizations` |

### Edge Functions (5 invoked from frontend)

| Function | Purpose | Called From |
|----------|---------|-------------|
| `semantic-search` | Vector + text search | `SemanticSearch.tsx`, `useSemanticMemorySearch` |
| `user-knowledge-upload` | Upload knowledge files | `KnowledgeUpload.tsx` |
| `user-knowledge-process` | Process uploaded files | `useUserKnowledge` |
| `ai-chat` | AI summary generation for entries | `KnowledgeForm.tsx` |
| `google-drive-sync` | Sync Google Drive files | `GoogleDriveFilePicker.tsx` |

Additional knowledge-related edge functions (`gemini-rag-query`, `auto-embed-knowledge-entry`, `auto-embed-knowledge-files`, `unified-knowledge-search`, `generate-embeddings`) exist but are called from platform-level hooks.

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `knowledge_entries` | Knowledge articles/entries |
| `knowledge_categories` | Entry categories |
| `knowledge_files` | Uploaded knowledge files |
| `knowledge_embeddings` | Vector embeddings for semantic search |
| `user_knowledge_files` | Personal knowledge files |
| `user_knowledge_sources` | Personal knowledge sources (Drive folders, etc.) |
| `unified_documents` | Cross-module document registry |
| `embedding_queue` | Embedding processing queue |

## Cross-Module Dependencies

**Depends on:** Platform Core (auth, layouts, UI)
**Used by:**
- Projects (ProjectKnowledgePage queries `unified_documents` with `owner_type=project`)
- AI Agents (agent personalization uses knowledge context)
- Admin (3 knowledge admin pages)

## Implementation Status

| Component | Status |
|-----------|--------|
| Knowledge listing + CRUD | Done |
| KnowledgeForm with AI summary | Done |
| KnowledgeDetail with related articles | Done |
| KnowledgeUpload | Done |
| Category browsing | Done |
| PersonalKnowledge | Done |
| SemanticSearch (vector + text) | Done |
| GoogleDriveFilePicker | Done |
| Admin: KnowledgeAnalytics | Done |
| Admin: KnowledgeCategories | Done |
| Admin: EmbeddingsExplorer | Done |
| Edge functions (5 frontend-invoked) | Done |
| Embedding pipeline (auto-embed) | Done |
| RAG query (gemini-rag-query) | Done |

### Known Issues

- 19 instances of `(supabase as any)` casts for tables not in generated types
- 3 hooks (`useKnowledgeBase`, `useKnowledgeAdmin`, `useSemanticMemorySearch`) are partially used / planned scaffolding
- Google Drive file picker integration needs production testing
