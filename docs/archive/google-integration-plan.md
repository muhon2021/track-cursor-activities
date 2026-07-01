# Google Integration Implementation Plan

> **Version:** 1.0.0
> **Created:** January 5, 2026
> **Status:** Planning Phase

---

## Executive Summary

This document outlines the comprehensive implementation plan for Google integrations in Control Tower, covering both **admin-level** (organization configuration) and **user-level** (individual account connections) integration flows.

---

## Table of Contents

1. [Two-Tier Integration Model](#two-tier-integration-model)
2. [Google Providers Overview](#google-providers-overview)
3. [Current Implementation Status](#current-implementation-status)
4. [Implementation Phases](#implementation-phases)
5. [Database Schema Changes](#database-schema-changes)
6. [Frontend Integration Points](#frontend-integration-points)
7. [Edge Functions Required](#edge-functions-required)
8. [Sprint Planning](#sprint-planning)
9. [Testing Checklist](#testing-checklist)

---

## Two-Tier Integration Model

### Overview

Control Tower requires a **two-tier integration architecture** to support enterprise deployments:

```
┌─────────────────────────────────────────────────────────────────────┐
│                     TWO-TIER INTEGRATION MODEL                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  TIER 1: ADMIN/ORGANIZATION LEVEL                                   │
│  ─────────────────────────────────                                  │
│  • Admin enables integrations for the company                        │
│  • Stored in: integration_providers, organization_integrations       │
│  • Questions answered:                                               │
│    - "Does our company use Google?"                                  │
│    - "What Google services are available?"                           │
│    - "What are the company OAuth credentials?"                       │
│                                                                      │
│                         ↓                                            │
│                                                                      │
│  TIER 2: USER/INDIVIDUAL LEVEL                                      │
│  ─────────────────────────────                                       │
│  • User connects their personal account                              │
│  • Stored in: user_oauth_tokens (NEW)                               │
│  • Questions answered:                                               │
│    - "Can I access MY Google Drive?"                                 │
│    - "Can I sync MY Google Calendar?"                                │
│    - "Are MY credentials valid?"                                     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Why Two Tiers?

| Scenario | Admin-Level Only | User-Level Required |
|----------|------------------|---------------------|
| Company uses Zoom for all meetings | Yes | Yes - user needs to connect THEIR Zoom |
| AI chat uses Google Gemini | Yes | No - uses company API key |
| User wants to import from Google Drive | Yes | Yes - user needs to authorize THEIR Drive |
| Admin wants to see integration analytics | Yes | No |
| User wants to sync calendar | Yes | Yes - user needs to connect THEIR calendar |

---

## Google Providers Overview

### Available Google Integrations

| Provider | Slug | Category | Tier 1 (Admin) | Tier 2 (User) | Status |
|----------|------|----------|----------------|---------------|--------|
| Google Login | `google-login` | Authentication | Configure OAuth credentials | User signs in | Available |
| Google Gemini | `google-gemini` | AI Providers | Configure API key | N/A (uses company key) | Available |
| Google Workspace | `google-workspace` | Productivity | Configure OAuth credentials | User connects Drive/Calendar | Coming Soon |
| Google Meet | `google-meet` | Meeting Providers | Configure OAuth credentials | User connects for meetings | Coming Soon |
| Google Drive | `google-drive` | Storage | Part of Workspace | User authorizes folder access | Partial |
| Google Calendar | `google-calendar` | Productivity | Part of Workspace | User authorizes calendar sync | Planned |

### Authentication Flows by Provider

```
GOOGLE LOGIN (Tier 1 → Tier 2 automatic)
─────────────────────────────────────────
Admin configures → User clicks "Sign in with Google" → User authenticated

GOOGLE GEMINI (Tier 1 only)
─────────────────────────────────────────
Admin configures API key → All users can use AI features

GOOGLE WORKSPACE (Tier 1 + Tier 2)
─────────────────────────────────────────
Admin enables Workspace → User goes to Settings → User clicks "Connect Google" →
User authorizes → User's Drive/Calendar syncs
```

---

## Current Implementation Status

### Completed (Tier 1 - Admin Level)

| Component | Status | Location |
|-----------|--------|----------|
| Database schema for providers | Done | `supabase/migrations/20260103_integration_hub_schema.sql` |
| Integration Hub UI | Done | `src/pages/admin/Integrations.tsx` |
| Provider Detail page | Done | `src/pages/admin/ProviderDetail.tsx` |
| OAuth callback handler | Done | `src/pages/admin/OAuthCallback.tsx` |
| validate-api-key edge function | Done | `supabase/functions/validate-api-key/` |
| oauth-exchange-token edge function | Done | `supabase/functions/oauth-exchange-token/` |
| Google Login provider | Done | Migration `20260105_add_google_login_provider.sql` |
| Google Gemini provider | Done | Seed data |
| Google Workspace provider | Done | Seed data (Coming Soon status) |
| Google Meet provider | Done | Seed data (Coming Soon status) |

### Not Started (Tier 2 - User Level)

| Component | Status | Sprint |
|-----------|--------|--------|
| `user_oauth_tokens` table | Not Started | Sprint 10 |
| "My Integrations" settings UI | Not Started | Sprint 10 |
| User OAuth connection flow | Not Started | Sprint 10 |
| Token refresh for users | Not Started | Sprint 10 |
| Google Drive user sync | Not Started | Sprint 10 |
| Google Calendar user sync | Not Started | Sprint 10 |

---

## Implementation Phases

### Phase 1: Admin-Level Foundations (Sprint 4) - MOSTLY DONE

**Goal:** Admins can configure which integrations are available

| Task | Status | Notes |
|------|--------|-------|
| Integration Hub database schema | Done | |
| Integration Hub admin UI | Done | |
| Provider configuration forms | Done | Dynamic form fields |
| Connection testing | Done | validate-api-key function |
| Google Login setup | Done | OAuth credentials storage |
| Google Gemini setup | Done | API key validation |

### Phase 2: Enterprise SSO (Sprint 7) - NOT STARTED

**Goal:** Users can sign in with Google/Microsoft

| Task | Status | Notes |
|------|--------|-------|
| SSO configurations table | Not Started | PB-025 |
| Login page dynamic buttons | Not Started | PB-032 |
| Google Workspace SSO UI | Not Started | PB-029 |
| Domain restrictions | Not Started | PB-035 |

### Phase 3: User Integration Connections (Sprint 10) - NOT STARTED

**Goal:** Users can connect their personal accounts

| Task | Status | Notes |
|------|--------|-------|
| user_oauth_tokens table | Not Started | PB-055 |
| "My Integrations" UI | Not Started | PB-056 |
| User OAuth flow | Not Started | PB-058-060 |
| Token refresh | Not Started | PB-062 |
| Google Drive user sync | Not Started | |
| Google Calendar user sync | Not Started | |

### Phase 4: Deep Integration Features (Future)

**Goal:** Full feature parity with native apps

- Meeting bot for Google Meet
- Real-time calendar sync
- Google Drive file picker
- Google Docs collaboration

---

## Database Schema Changes

### Existing Tables (Tier 1)

```sql
-- Already exists
integration_categories      -- AI, Meeting, Storage, etc.
integration_providers       -- Google Login, Google Gemini, etc.
integration_fields          -- Form fields for configuration
organization_integrations   -- Admin-level configurations
integration_services        -- Sub-services within providers
integration_usage_logs      -- Usage tracking
```

### New Table Required (Tier 2)

```sql
-- NEW: User OAuth Tokens
CREATE TABLE public.user_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_slug TEXT NOT NULL,  -- 'google', 'microsoft', 'zoom'

  -- OAuth Credentials (encrypted)
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type TEXT DEFAULT 'Bearer',
  expires_at TIMESTAMPTZ,
  scopes TEXT[],

  -- Account Info
  account_email TEXT,           -- Connected account email
  account_name TEXT,            -- Display name from provider
  account_id TEXT,              -- Provider's user ID

  -- Status
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  last_refreshed_at TIMESTAMPTZ,
  error_message TEXT,           -- Last error if any

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- One token per provider per user
  UNIQUE(user_id, provider_slug)
);

-- RLS: Users can only access their own tokens
CREATE POLICY "Users manage own OAuth tokens"
  ON public.user_oauth_tokens
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Index for efficient lookups
CREATE INDEX idx_user_oauth_tokens_user_provider
  ON public.user_oauth_tokens(user_id, provider_slug);
```

---

## Frontend Integration Points

### Admin Integration Hub (Tier 1)

**Location:** `/admin/integrations`

```
Already implemented:
├── Integration Hub page (category view)
├── Provider cards with status
├── Provider detail/configuration page
├── Dynamic form fields
├── Test connection functionality
└── OAuth callback handler
```

### User Settings - My Integrations (Tier 2)

**Location:** `/settings` (new section)

```
To be implemented:
├── "Connected Services" section
├── IntegrationConnectionCard component
│   ├── Provider logo and name
│   ├── Connection status (Connected/Not Connected/Error)
│   ├── Connected account email
│   ├── Last sync time
│   ├── Connect/Disconnect buttons
│   └── "Not Available" state if admin hasn't enabled
├── OAuth popup/redirect flow
└── Connection success/error handling
```

### User Settings UI Wireframe

```
┌─────────────────────────────────────────────────────────────────┐
│ Settings                                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Profile                                                          │
│ ─────────                                                        │
│ [Avatar] John Doe                                                │
│ john@company.com                                                 │
│ [Edit Profile]                                                   │
│                                                                  │
│ ─────────────────────────────────────────────────────────────── │
│                                                                  │
│ Connected Services                                               │
│ ─────────────────                                                │
│ Connect your personal accounts to sync data automatically        │
│                                                                  │
│ ┌─────────────────────────┐  ┌─────────────────────────┐       │
│ │ 🔴 Google               │  │ 🔵 Zoom                 │       │
│ │ ✅ Connected            │  │ Not Connected           │       │
│ │ john@gmail.com          │  │ Connect to sync         │       │
│ │ Drive, Calendar         │  │ meetings                │       │
│ │ Last sync: 5 min ago    │  │                         │       │
│ │ [Manage] [Disconnect]   │  │ [Connect Account]       │       │
│ └─────────────────────────┘  └─────────────────────────┘       │
│                                                                  │
│ ┌─────────────────────────┐  ┌─────────────────────────┐       │
│ │ 🔷 Microsoft            │  │ ⚫ Slack                │       │
│ │ Not Connected           │  │ Not Available           │       │
│ │ Connect to sync         │  │ Contact admin to        │       │
│ │ calendar & OneDrive     │  │ enable this service     │       │
│ │                         │  │                         │       │
│ │ [Connect Account]       │  │ [Request Access]        │       │
│ └─────────────────────────┘  └─────────────────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Edge Functions Required

### Existing Functions (Working)

| Function | Purpose | Tier |
|----------|---------|------|
| `validate-api-key` | Test API key credentials | Admin |
| `oauth-exchange-token` | Exchange auth code for admin tokens | Admin |
| `oauth-refresh-token` | Refresh admin OAuth tokens | Admin |
| `google-drive-sync` | Sync Google Drive files | Both |
| `google-drive-upload` | Upload to Google Drive | Both |

### New Functions Required

| Function | Purpose | Tier | Sprint |
|----------|---------|------|--------|
| `user-oauth-connect` | Initiate user OAuth flow | User | 10 |
| `user-oauth-callback` | Handle user OAuth callback | User | 10 |
| `user-oauth-refresh` | Refresh user tokens | User | 10 |
| `user-oauth-disconnect` | Revoke and delete user tokens | User | 10 |
| `user-google-drive-list` | List user's Drive files | User | 10 |
| `user-google-calendar-sync` | Sync user's calendar | User | 10 |

### User OAuth Flow Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                    USER OAUTH CONNECTION FLOW                         │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  1. User clicks "Connect Google" in Settings                          │
│                         ↓                                             │
│  2. Frontend calls `user-oauth-connect` edge function                 │
│     - Validates: Is Google enabled at org level?                      │
│     - Generates: State token for CSRF protection                      │
│     - Returns: Authorization URL                                      │
│                         ↓                                             │
│  3. Frontend redirects to Google OAuth consent screen                 │
│                         ↓                                             │
│  4. User grants permissions                                           │
│                         ↓                                             │
│  5. Google redirects to `/settings/oauth/callback?code=xxx&state=yyy` │
│                         ↓                                             │
│  6. Frontend calls `user-oauth-callback` edge function                │
│     - Validates: State token                                          │
│     - Exchanges: Code for tokens                                      │
│     - Fetches: User info from Google                                  │
│     - Stores: Encrypted tokens in user_oauth_tokens                   │
│     - Returns: Success with account info                              │
│                         ↓                                             │
│  7. Frontend shows "Connected" status with account email              │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Sprint Planning

### Sprint 8: Meetings Enhancement

| ID | Story | Priority | Effort |
|----|-------|----------|--------|
| PB-039 | Create meeting transcript viewer component | High | 3h |
| PB-040 | Implement AI meeting summarization | High | 4h |
| PB-041 | Add meeting action items extraction | High | 3h |
| PB-042 | Create meeting search functionality | Medium | 2h |
| PB-043 | Add meeting categories/tags | Medium | 2h |
| PB-044 | Implement meeting sharing | Medium | 2h |
| PB-045 | Add meeting analytics dashboard | Low | 3h |
| PB-046 | Support multiple meeting providers | Low | 4h |
| PB-047 | Add meeting recording playback | Low | 3h |

**Sprint Total: ~26 hours**

### Sprint 9: AI-Powered Features

| ID | Story | Priority | Effort |
|----|-------|----------|--------|
| PB-048 | Implement RAG-powered knowledge search | High | 4h |
| PB-049 | Add AI task suggestions | High | 3h |
| PB-050 | Create AI-powered client insights | Medium | 3h |
| PB-051 | Implement conversation memory | Medium | 3h |
| PB-052 | Add AI agent templates | Medium | 2h |
| PB-053 | Create AI usage analytics | Low | 2h |
| PB-054 | Implement AI rate limiting | Low | 2h |

**Sprint Total: ~19 hours**

### Sprint 10: User Integration Connections

| ID | Story | Priority | Effort |
|----|-------|----------|--------|
| PB-055 | Create `user_oauth_tokens` table with RLS | Critical | 1h |
| PB-056 | Create "My Integrations" section in Settings page | High | 2h |
| PB-057 | Create `IntegrationConnectionCard` component | High | 1.5h |
| PB-058 | Implement Google OAuth flow for individual users | High | 3h |
| PB-059 | Implement Zoom OAuth flow for individual users | High | 3h |
| PB-060 | Implement Microsoft OAuth flow for individual users | High | 3h |
| PB-061 | Create `user-oauth-connect` edge function | High | 2h |
| PB-062 | Create `user-oauth-callback` edge function | High | 2h |
| PB-063 | Create `user-oauth-refresh` edge function | Medium | 1.5h |
| PB-064 | Add token encryption/decryption utilities | Medium | 1h |
| PB-065 | Show connection status in Settings page | Medium | 1h |
| PB-066 | Add "Disconnect" functionality with token revocation | Medium | 1.5h |
| PB-067 | Filter available providers based on admin settings | Low | 0.5h |

**Sprint Total: ~23 hours**

---

## Testing Checklist

### Tier 1 (Admin) Tests

- [ ] Admin can view Integration Hub at `/admin/integrations`
- [ ] All Google providers display correctly
- [ ] Google Login can be configured with Client ID/Secret
- [ ] Google Gemini can be configured with API Key
- [ ] Test connection validates credentials
- [ ] OAuth callback handles tokens correctly
- [ ] Provider status updates after configuration

### Tier 2 (User) Tests

- [ ] User sees "Connected Services" in Settings
- [ ] Google shows "Connect" if admin has enabled
- [ ] Google shows "Not Available" if admin hasn't enabled
- [ ] User can initiate OAuth flow
- [ ] OAuth consent screen shows correct permissions
- [ ] Callback successfully stores tokens
- [ ] User sees connected account email
- [ ] User can disconnect account
- [ ] Token refresh works before expiration
- [ ] Error states display correctly

### Integration Tests

- [ ] Admin enables Google → User can connect
- [ ] Admin disables Google → User sees "Not Available"
- [ ] User connects Google → Can access Drive files
- [ ] User disconnects → Access revoked
- [ ] Token expires → Auto-refresh works

---

## Files to Create/Modify

### New Files

| File | Sprint | Description |
|------|--------|-------------|
| `supabase/migrations/20260105_user_oauth_tokens.sql` | 10 | User tokens table |
| `src/components/settings/ConnectedServices.tsx` | 10 | Settings section |
| `src/components/settings/IntegrationConnectionCard.tsx` | 10 | Connection card |
| `src/hooks/useUserIntegrations.ts` | 10 | User token hooks |
| `src/pages/settings/OAuthCallback.tsx` | 10 | User OAuth callback |
| `supabase/functions/user-oauth-connect/index.ts` | 10 | Initiate OAuth |
| `supabase/functions/user-oauth-callback/index.ts` | 10 | Handle callback |
| `supabase/functions/user-oauth-refresh/index.ts` | 10 | Refresh tokens |
| `supabase/functions/user-oauth-disconnect/index.ts` | 10 | Revoke tokens |

### Modified Files

| File | Sprint | Changes |
|------|--------|---------|
| `src/pages/Settings.tsx` | 10 | Add Connected Services section |
| `src/App.tsx` | 10 | Add user OAuth callback route |
| `docs/product-backlog.md` | Now | Add Sprint 8-10 |

---

## Success Criteria

### Phase 1 Complete When:
- [x] Admin can configure all Google providers
- [x] OAuth flow works for admin-level configuration
- [x] Documentation is complete

### Phase 2 Complete When:
- [ ] Users can sign in with Google
- [ ] Domain restrictions work
- [ ] User profiles auto-provision from SSO

### Phase 3 Complete When:
- [ ] Users can connect personal Google accounts
- [ ] Token storage is secure and encrypted
- [ ] Token refresh works automatically
- [ ] Users can disconnect at any time
- [ ] Only admin-enabled providers show to users

---

## Dependencies

```
Sprint 4 (Admin Integration Settings) ← MOSTLY DONE
         ↓
Sprint 7 (Enterprise SSO) ← NOT STARTED
         ↓
Sprint 10 (User Integration Connections) ← NOT STARTED
         ↓
Sprint 8 (Meetings Enhancement) ← DEPENDS ON USER INTEGRATIONS
```

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Token storage security | High | Use Supabase vault for encryption |
| OAuth scope changes by Google | Medium | Abstract scopes in config table |
| Token refresh failures | Medium | Implement retry with exponential backoff |
| User confusion between tiers | Low | Clear UI labeling and documentation |

---

**Document Owner:** Development Team
**Last Updated:** January 5, 2026
