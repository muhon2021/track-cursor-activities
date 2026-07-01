# Feature: Integration Preferences

> Centralized admin configuration for Primary Integrations and Primary Knowledge Sources used across AI, Search, Knowledge Base, Memory, and Analytics.

**Status**: Approved  
**Module**: admin (Integrations)  
**Author**: SJ Control Tower  
**Date**: 2026-06-16

## Overview

Administrators configure organization-level integration preferences from the Integrations hub. Primary Integrations designate which connected business systems (CRM, PM, communication, storage) are defaults for platform intelligence features. Primary Knowledge Sources designate which connected or internal sources feed AI and knowledge workflows.

Knowledge source **configuration and sync** remain on Integrations provider pages (`ProviderDetail`, dedicated pages). The Knowledge admin dashboard sources tab is read-only and links here.

## User Stories

- As an **admin**, I want to select multiple primary integrations so the platform knows which business systems to prioritize.
- As an **admin**, I want to select multiple primary knowledge sources so AI and search can prefer the right corpora.
- As a **moderator**, I want to view current preferences without editing them.
- As a **future module developer**, I want `getPrimaryIntegrations()` and `getPrimaryKnowledgeSources()` helpers without reimplementing validation.

## Database Design

### New Table: `integration_settings`

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | No | gen_random_uuid() | Primary key |
| organization_id | UUID | Yes | NULL | Future multi-tenant FK |
| primary_integrations | JSONB | No | `[]` | Provider slugs array |
| primary_knowledge_sources | JSONB | No | `[]` | Discriminated union refs |
| updated_by | UUID | Yes | — | Last editor (audit) |
| created_at | TIMESTAMPTZ | No | now() | Created |
| updated_at | TIMESTAMPTZ | No | now() | Updated |

**Singleton:** One global row (`organization_id IS NULL`) via partial unique index.

### RLS Policies

- **SELECT:** `has_role(admin)` OR `has_role(moderator)`
- **INSERT/UPDATE/DELETE:** `has_role(admin)` only

### Reused Tables

- `integration_providers`, `integration_categories` — eligibility
- `organization_integrations` — connection health
- `knowledge_sources` — internal source types

## Stored Data Format

```json
{
  "primary_integrations": ["zoho-crm", "jira", "microsoft-teams"],
  "primary_knowledge_sources": [
    { "kind": "integration", "slug": "confluence" },
    { "kind": "integration", "slug": "sharepoint" },
    { "kind": "internal", "source_type": "upload" },
    { "kind": "internal", "source_type": "meeting" }
  ]
}
```

## API Design

### Edge Function: `integration-settings`

| Method | Auth | Behavior |
|--------|------|----------|
| GET | Admin or moderator | Return settings row or defaults |
| PUT / POST | Admin only | Validate, sanitize, upsert |

**Response (save):**

```json
{
  "settings": { "...": "..." },
  "warnings": ["Selected integration is no longer connected."]
}
```

### Validation Rules

**Primary integrations** — slug must:

1. Exist in `integration_providers` with `is_available = true`
2. Belong to category in `PRIMARY_INTEGRATION_CATEGORY_SLUGS`
3. Have ≥1 `organization_integrations` row with `connection_status = 'connected'` and `enabled = true`

**Primary knowledge sources:**

- **integration:** slug in `KNOWLEDGE_CAPABLE_PROVIDER_SLUGS`, connected as above
- **internal:** `source_type` exists in active `knowledge_sources`

Invalid entries are stripped on save with warnings.

## UI Wireframe

```
Integration Hub
├── Integration Preferences (#preferences)
│   ├── Primary Integrations [searchable multi-select]
│   ├── Primary Knowledge Sources [searchable multi-select]
│   └── [Save Settings] (admin only)
└── Provider catalog (existing)
```

## Knowledge Source Ownership Migration

| Former location | Current owner |
|-----------------|---------------|
| `/admin/knowledge/sources` CRUD | Removed — redirect to dashboard tab |
| OAuth / credentials / sync | Integrations (`ProviderDetail`, dedicated pages) |
| Primary source selection | Integrations preferences (this feature) |
| Read-only monitoring | Knowledge dashboard Sources tab |

Sync triggers stay on provider detail pages; preferences only declare priority.

## Future Consumers

- AI Hub, Memory, Semantic Search, Analytics, Agents — call `getPrimaryIntegrations()` / `getPrimaryKnowledgeSources()` from `src/lib/integration-preferences.ts`
