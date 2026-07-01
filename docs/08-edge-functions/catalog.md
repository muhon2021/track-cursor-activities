# Edge Functions Catalog (Current Baseline)

_Last updated: 2026-04-16_

## Snapshot

- **Total edge functions:** 151
- **Source of truth:** `supabase/functions/*/index.ts`

This repository has evolved from a smaller function set into a broad serverless backend for AI, integrations, and automation.

## Capability Categories

### 1) Agent + AI Runtime
Examples:
- `run-ai-agent`
- `agent-chat-stream`
- `agent-conversation-chat`
- `orchestrate-agent-team`
- `ai-chat-assistant`
- `generate-business-doc`

### 2) Memory + Retrieval
Examples:
- `extract-agent-memories`
- `consolidate-agent-memories`
- `retrieve-agent-memories`
- `semantic-search`
- `unified-knowledge-search`
- `generate-embeddings`

### 3) Meeting Intelligence
Examples:
- `generate-meeting-summary-v2`
- `meeting-summary-and-extract`
- `extract-meeting-action-items`
- `extract-meeting-issues`
- `classify-zoom-meetings`
- `apply-meeting-rules`

### 4) Integrations + Sync
Examples:
- Zoom (`sync-zoom-files`, `zoom-cron-sync`, `create-zoom-meeting`)
- Google (`sync-google-meet`, `google-drive-sync`, `user-drive-list`)
- Microsoft (`microsoft-graph-subscribe`)
- Work systems (`sync-projects-jira`, `sync-clickup`, `sync-workamajig`, `sync-projects-activecollab`)
- CRM (`zoho-crm-sync` + enrichment/sync pipeline functions)

### 5) OAuth + Access APIs
Examples:
- `oauth-authorize`, `oauth-token`, `oauth-userinfo`
- `oauth-exchange-token`, `oauth-refresh-token`, `oauth-revoke-token`
- `user-oauth-connect`, `user-oauth-callback`, `user-oauth-refresh`
- `api-auth`, `validate-api-key`

### 6) Notifications + Ops Utilities
Examples:
- `send-email`, `send-notification`, `send-feedback-notification`
- `check-environment`, `audit-log-writer`, `run-seed`
- `promote-first-admin`, `validate-sso-domain`

## Documentation Note

A prior version of this file listed 64 functions; that is no longer accurate. Keep this file synchronized with deployed function directories whenever a function is added or removed.
