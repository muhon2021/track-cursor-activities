# CollabAi Product Backlog

![Built with Lovable](https://img.shields.io/badge/Built%20with-Lovable-ff69b4?style=flat-square)
![Backend: Supabase](https://img.shields.io/badge/Backend-Supabase-3ECF8E?style=flat-square)

> **Version:** 1.1.0  
> **Last Updated:** 2026-01-28  
> **Status:** Active Development

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Development Platform** | [Lovable.dev](https://lovable.dev) | AI-powered IDE, instant preview, one-click publish |
| **Backend Platform** | [Supabase](https://supabase.com) | PostgreSQL, Auth, Storage, Edge Functions |
| **Frontend Framework** | React 18 + Vite + TypeScript | Modern web application |
| **Styling** | Tailwind CSS + shadcn/ui | UI components and styling |

**All development happens in [Lovable.dev](https://lovable.dev) - no local setup required.**

---

## 1. Product Vision & Strategy

### Vision
Transform CollabAi into a **rapidly deployable, configurable multi-tenant SaaS platform** for internal company use. The goal is to minimize code changes per client by adopting a configuration-first approach.

### Strategic Goals
- **Configuration-first:** All client-specific settings managed via Admin Panel
- **Master Supabase Template:** Standardized database schema for rapid deployment
- **Target Deployment Time:** < 4 hours per new client
- **Modular Architecture:** Enable/disable features per client needs

---

## 2. Current State Analysis

### ✅ Completed Features

| Module | Status | Description |
|--------|--------|-------------|
| **Authentication** | ✅ Complete | Email/password login with role-based access (via Supabase Auth) |
| **Dashboard** | ✅ Complete | Real-time analytics with live stats, recent activity feed, and task overview charts |
| **Clients** | ✅ Complete | CRUD operations for client management |
| **Meetings** | ✅ Complete | Meeting scheduling with Zoom integration fields |
| **Microsoft Teams Integration** | ✅ Complete | Teams meetings, calendar sync, and OneDrive access |
| **Tasks** | ✅ Complete | Task management with assignments, priorities, and status tracking |
| **Knowledge Base** | ✅ Complete | Searchable knowledge entries with categories |
| **AI Chat** | ✅ Complete | AI assistant interface (placeholder) |
| **AI Agents** | ✅ Complete | Full CRUD + agent execution with history tracking and status monitoring |
| **MCP Integration** | ✅ Complete | Managed connectivity for AI tool chains and providers |
| **Notifications** | ✅ Complete | Real-time notifications with Supabase subscriptions, unread count, mark as read/delete |
| **Admin Panel** | ✅ Complete | User management, role management, activity logs, system settings, deployment status |
| **System Settings** | ✅ Complete | Platform branding, feature flags, email settings, system configuration |
| **Role Management** | ✅ Complete | Complete role CRUD with 23 permissions across all resources |
| **User Preferences** | ✅ Complete | Database-backed user settings (notifications, appearance, privacy, AI) |
| **Profile Page** | ✅ Complete | Full profile editing with password change and role display |
| **UI/UX** | ✅ Complete | Premium SaaS design with CollabAi branding |

### 📊 Database Schema (47+ Tables in Supabase)

| Table | Purpose | RLS |
|-------|---------|-----|
| `profiles` | User profile information | ✅ |
| `user_roles` | Role assignments (admin, moderator, user) | ✅ |
| `roles` | Role definitions | ✅ |
| `clients` | Client/customer data | ✅ |
| `meetings` | Meeting records with Zoom fields | ✅ |
| `tasks` | Task tracking with assignments and priorities | ✅ |
| `knowledge_entries` | Knowledge base articles | ✅ |
| `knowledge_categories` | Article categorization | ✅ |
| `ai_agents` | AI agent configurations | ✅ |
| `ai_agent_runs` | AI execution logs | ✅ |
| `ai_chat_history` | Chat message history | ✅ |
| `embeddings` | Vector embeddings for RAG | ✅ |
| `feedback` | User feedback collection | ✅ |
| `notifications` | User notifications | ✅ |
| `zoom_files` | Zoom recording files | ✅ |

Manage database in **Supabase Dashboard** → Table Editor.

### ⚡ Edge Functions (39+ Functions in Supabase)

Edge functions handle integrations, AI workflows, and background processing across the platform.

### 🔧 Demo Accounts

| Email | Role | Password |
|-------|------|----------|
| `demo@collabai.software` | user | (set during creation) |
| `admin@collabai.software` | admin | (set during creation) |

### ⚠️ Known Issues (Fixed in Sprint 1)

1. ~~AI routes accessible to non-admin users~~ ✅ Fixed
2. ~~Sidebar shows admin-only items to all users~~ ✅ Fixed
3. ~~AdminRoute checks for `super_admin` not in enum~~ ✅ Fixed

---

## 3. Product Backlog (Prioritized)

### Sprint 1: Access Control Fixes ✅ COMPLETED

| ID | Story | Priority | Effort | Status |
|----|-------|----------|--------|--------|
| PB-001 | Wrap AI routes with AdminRoute | Critical | 0.5h | ✅ Done |
| PB-002 | Dynamic sidebar with role-based visibility | Critical | 1h | ✅ Done |
| PB-003 | Fix AdminRoute role check | Critical | 0.5h | ✅ Done |

---

### Sprint 2: App Configuration System ✅ COMPLETED

*Development in [Lovable.dev](https://lovable.dev)*

| ID | Story | Priority | Effort | Status |
|----|-------|----------|--------|--------|
| PB-004 | Create `app_config` database table | High | 0.5h | ✅ Done |
| PB-005 | Create `useAppConfig()` hook with caching | High | 1h | ✅ Done |
| PB-006 | Admin branding settings page (logo, colors, name) | High | 2h | ✅ Done |
| PB-007 | Admin feature toggles page | High | 2h | ✅ Done |

**Database Migration (via Lovable → Supabase):**
```sql
-- App configuration table for multi-tenant settings
CREATE TABLE public.app_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  category text NOT NULL DEFAULT 'general',
  description text,
  is_sensitive boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Only admins can read/write config
CREATE POLICY "Admins can manage config"
  ON public.app_config
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_app_config_updated_at
  BEFORE UPDATE ON public.app_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
```

---

### Sprint 3: User Management ✅ COMPLETED

*Development in [Lovable.dev](https://lovable.dev)*

| ID | Story | Priority | Effort | Status |
|----|-------|----------|--------|--------|
| PB-008 | Admin user management page (list, view, edit) | Medium | 3h | ✅ Done |
| PB-009 | User invite system with email | Medium | 2h | ✅ Done |
| PB-010 | Role assignment dropdown UI | Medium | 1h | ✅ Done |
| PB-011 | User deactivation toggle | Medium | 1h | ✅ Done |

**Database Migration:**
```sql
-- User invitations table
CREATE TABLE public.user_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  role text DEFAULT 'user',
  invited_by uuid REFERENCES public.profiles(id),
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  used_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_invites ENABLE ROW LEVEL SECURITY;

-- Only admins can manage invites
CREATE POLICY "Admins can manage invites"
  ON public.user_invites
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
```

---

### Sprint 4: Integration Management ✅ COMPLETED

| ID | Story | Priority | Effort | Status |
|----|-------|----------|--------|--------|
| PB-012 | Admin integration settings page | Medium | 2h | ✅ Done |
| PB-013 | Secure API key storage (via Supabase Edge Function Secrets) | Medium | 1h | ✅ Done |
| PB-014 | Connection test buttons (Zoom, OpenAI, etc.) | Medium | 2h | ✅ Done |
| PB-015 | Integration status indicators | Medium | 1h | ✅ Done |

---

### Sprint 5: Edge Functions Deployment ✅ COMPLETED

*Deploy via Lovable → auto-deployed to Supabase*

| ID | Story | Priority | Effort | Status |
|----|-------|----------|--------|--------|
| PB-016 | Deploy `ai-chat` edge function | Medium | 2h | ✅ Done |
| PB-017 | Deploy `meeting-processor` edge function | Medium | 2h | ✅ Done |
| PB-018 | Deploy `knowledge-search` edge function | Medium | 2h | ✅ Done |
| PB-019 | Deploy `email-sender` edge function | Low | 1h | ✅ Done |
| PB-020 | Deploy `webhook-handler` edge function | Low | 1h | ✅ Done |

---

### Sprint 6: Onboarding & Automation ✅ COMPLETED

| ID | Story | Priority | Effort | Status |
|----|-------|----------|--------|--------|
| PB-021 | Client onboarding wizard component | Low | 4h | ✅ Done |
| PB-022 | Deployment checklist dashboard | Low | 2h | ✅ Done |
| PB-023 | Template data seeding (agents, categories) | Low | 1h | ✅ Done |
| PB-024 | Environment configuration validator | Low | 1h | ✅ Done |

---

### Sprint 7: Enterprise SSO & Authentication ✅ COMPLETED

> **Epic:** Enable enterprise-grade authentication with configurable SSO providers (Google Workspace, Microsoft Azure AD, SAML 2.0) for seamless Active Directory integration.

#### Business Value
- **Enterprise Adoption:** Companies require SSO for compliance and user management
- **Reduced Friction:** Users authenticate with existing corporate credentials
- **Security:** Centralized access control via corporate identity providers
- **Compliance:** Meet SOC2, HIPAA requirements for enterprise clients

#### User Stories

| ID | Story | Priority | Effort | Status |
|----|-------|----------|--------|--------|
| PB-025 | Create `sso_configurations` table for SSO provider settings | Critical | 1h | ✅ Done |
| PB-026 | Create `sso_domain_allowlist` table for domain restrictions | Critical | 0.5h | ✅ Done |
| PB-027 | Add auth configuration entries to `app_config` | Critical | 0.5h | ✅ Done |
| PB-028 | Create Admin SSO Settings page (`/admin/sso-settings`) | High | 4h | ✅ Done |
| PB-029 | Implement Google Workspace OAuth configuration UI | High | 2h | ✅ Done |
| PB-030 | Implement Microsoft Azure AD OAuth configuration UI | High | 3h | ✅ Done |
| PB-031 | Create `useAuthConfig()` hook for dynamic auth methods | High | 2h | ✅ Done |
| PB-032 | Update Login page with dynamic SSO buttons | High | 2h | ✅ Done |
| PB-033 | Add `signInWithMicrosoft()` to AuthContext | Medium | 1h | ✅ Done |
| PB-034 | Create `validate-sso-domain` edge function | Medium | 2h | ✅ Done |
| PB-035 | Implement domain allowlist validation on login | Medium | 1h | ✅ Done |
| PB-036 | Auto-provision user profiles from SSO claims | Medium | 2h | ✅ Done |
| PB-037 | SAML 2.0 provider support (requires Supabase Pro) | Low | 4h | ✅ Done |
| PB-038 | SSO audit logging for compliance | Low | 1h | ✅ Done |

#### Database Migration

```sql
-- SSO Configuration table for enterprise identity providers
CREATE TABLE public.sso_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_type text NOT NULL CHECK (provider_type IN ('google_workspace', 'azure_ad', 'saml', 'oidc')),
  display_name text NOT NULL,
  is_enabled boolean DEFAULT false,
  is_primary boolean DEFAULT false,
  client_id text,
  tenant_id text, -- For Azure AD
  domain_restrictions text[] DEFAULT '{}',
  auto_provision_role text DEFAULT 'user' CHECK (auto_provision_role IN ('admin', 'moderator', 'user')),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(provider_type)
);

-- Enable RLS
ALTER TABLE public.sso_configurations ENABLE ROW LEVEL SECURITY;

-- Only admins can manage SSO configurations
CREATE POLICY "Admins can manage SSO configs"
  ON public.sso_configurations
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Public read for login page (non-sensitive fields only via edge function)
CREATE POLICY "Public can view enabled SSO providers"
  ON public.sso_configurations
  FOR SELECT
  TO anon
  USING (is_enabled = true);

-- SSO Domain Allowlist
CREATE TABLE public.sso_domain_allowlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL,
  sso_config_id uuid REFERENCES public.sso_configurations(id) ON DELETE CASCADE,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(domain, sso_config_id)
);

-- Enable RLS
ALTER TABLE public.sso_domain_allowlist ENABLE ROW LEVEL SECURITY;

-- Only admins can manage domain allowlist
CREATE POLICY "Admins can manage domain allowlist"
  ON public.sso_domain_allowlist
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_sso_configurations_updated_at
  BEFORE UPDATE ON public.sso_configurations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
```

#### App Config Entries

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `auth.allow_email_password` | boolean | true | Enable traditional email/password login |
| `auth.allow_public_signup` | boolean | true | Allow self-registration |
| `auth.require_sso` | boolean | false | Force SSO for all users (disable other methods) |
| `auth.default_sso_provider` | string | null | UUID of primary SSO provider |
| `auth.session_timeout_hours` | number | 24 | Session timeout duration |

#### Authentication Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Login Page Flow                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Fetch enabled auth methods from app_config + sso_configs    │
│                          ↓                                       │
│  2. Render available login options:                              │
│     ┌─────────────────────────────────┐                         │
│     │ 🏢 Sign in with Company SSO     │ ← Primary (if set)      │
│     └─────────────────────────────────┘                         │
│     ┌─────────────────────────────────┐                         │
│     │ 🔵 Continue with Google         │ ← OAuth providers       │
│     └─────────────────────────────────┘                         │
│     ┌─────────────────────────────────┐                         │
│     │ 🔷 Continue with Microsoft      │                         │
│     └─────────────────────────────────┘                         │
│     ┌─────────────────────────────────┐                         │
│     │ Email/Password Form             │ ← If enabled            │
│     └─────────────────────────────────┘                         │
│                          ↓                                       │
│  3. User selects provider                                        │
│                          ↓                                       │
│  4. Validate domain (if restrictions configured)                 │
│                          ↓                                       │
│  5. Redirect to IdP or submit credentials                        │
│                          ↓                                       │
│  6. On success: auto-provision profile with SSO claims           │
│                          ↓                                       │
│  7. Assign role from sso_configurations.auto_provision_role      │
│                          ↓                                       │
│  8. Redirect to dashboard                                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/pages/admin/SSOSettings.tsx` | Create | Admin SSO configuration page |
| `src/hooks/useAuthConfig.ts` | Create | Hook for fetching enabled auth methods |
| `src/components/auth/SSOProviderCard.tsx` | Create | Reusable SSO provider config card |
| `src/components/auth/SSOLoginButton.tsx` | Create | Dynamic SSO login button |
| `src/contexts/AuthContext.tsx` | Modify | Add Microsoft OAuth, SAML support |
| `src/pages/Login.tsx` | Modify | Dynamic auth method rendering |
| `supabase/functions/validate-sso-domain/index.ts` | Create | Domain validation edge function |
| `supabase/functions/get-sso-providers/index.ts` | Create | Public endpoint for enabled providers |

#### Supabase Dashboard Configuration (Manual Steps)

1. **Enable Microsoft Azure AD Provider**
   - Go to Authentication → Providers → Microsoft
   - Add Azure AD App Registration credentials
   - Configure tenant restriction (optional)

2. **Configure Google OAuth for Workspace**
   - Go to Authentication → Providers → Google
   - Ensure "Restrict to hosted domain" is set (optional)

3. **Add Redirect URLs**
   - Add all deployment URLs to allowed redirects
   - Include localhost for development

#### Acceptance Criteria

- [x] Admin can enable/disable email/password authentication
- [x] Admin can configure Google Workspace SSO with domain restrictions
- [x] Admin can configure Microsoft Azure AD SSO with tenant restrictions
- [x] Login page dynamically shows only enabled authentication methods
- [x] Users from restricted domains cannot authenticate
- [x] New SSO users are auto-provisioned with correct role
- [x] All SSO login attempts are logged for audit
- [x] System gracefully handles IdP downtime

#### Security Considerations

| Risk | Mitigation |
|------|------------|
| OAuth credentials exposure | Store client secrets in Supabase vault, never in database |
| Domain spoofing | Validate email domain server-side in edge function |
| Session hijacking | Use Supabase session management with proper timeouts |
| Privilege escalation | Validate role assignment against `auto_provision_role` |

#### Phased Rollout

| Phase | Scope | Timeline |
|-------|-------|----------|
| **Phase 1 (MVP)** | Azure AD + Google via Supabase native, admin toggles | 1 sprint |
| **Phase 2** | Domain restrictions, auto-provisioning | 1 sprint |
| **Phase 3** | SAML 2.0 support, advanced audit | Future |
| **Phase 4** | SCIM user provisioning | Future |

---

### Sprint 8: Meetings Enhancement ✅ COMPLETED

> **Epic:** Enhance meeting functionality with AI-powered features, multi-provider support, and improved user experience.

#### User Stories

| ID | Story | Priority | Effort | Status |
|----|-------|----------|--------|--------|
| PB-039 | Create meeting transcript viewer component | High | 3h | ✅ Done |
| PB-040 | Implement AI meeting summarization | High | 4h | ✅ Done |
| PB-041 | Add meeting action items extraction | High | 3h | ✅ Done |
| PB-042 | Create meeting search functionality | Medium | 2h | ✅ Done |
| PB-043 | Add meeting categories/tags | Medium | 2h | ✅ Done |
| PB-044 | Implement meeting sharing | Medium | 2h | ✅ Done |
| PB-045 | Add meeting analytics dashboard | Low | 3h | ✅ Done |
| PB-046 | Support multiple meeting providers (Zoom, Google Meet, Teams) | Low | 4h | ✅ Done |
| PB-047 | Add meeting recording playback | Low | 3h | ✅ Done |

**Sprint Total: ~26 hours**

---

### Sprint 9: AI-Powered Features ✅ COMPLETED

> **Epic:** Leverage AI capabilities across the platform for intelligent automation and insights.

#### User Stories

| ID | Story | Priority | Effort | Status |
|----|-------|----------|--------|--------|
| PB-048 | Implement RAG-powered knowledge search | High | 4h | ✅ Done |
| PB-049 | Add AI task suggestions based on context | High | 3h | ✅ Done |
| PB-050 | Create AI-powered client insights | Medium | 3h | ✅ Done |
| PB-051 | Implement conversation memory across sessions | Medium | 3h | ✅ Done |
| PB-052 | Add AI agent templates for common use cases | Medium | 2h | ✅ Done |
| PB-053 | Create AI usage analytics dashboard | Low | 2h | ✅ Done |
| PB-054 | Implement AI rate limiting per user/org | Low | 2h | ✅ Done |

**Sprint Total: ~19 hours**

---

### Sprint 10: User Integration Connections ✅ COMPLETED

> **Epic:** Enable individual users to connect their personal accounts (Google, Zoom, Microsoft) for personalized data sync and access.

#### Business Value
- **Self-Service**: Users connect their own accounts without admin intervention
- **Personalization**: Access personal calendars, files, and meeting data
- **Compliance**: Clear OAuth consent flow with user control
- **Scalability**: Admins enable once, all users connect themselves

#### User Journey
```
Admin enables Google → User sees "Connect Google" in Settings →
User authorizes → User's Drive/Calendar syncs automatically
```

#### Database Migration

```sql
-- User OAuth Tokens table for individual connections
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

  UNIQUE(user_id, provider_slug)
);

-- Enable RLS
ALTER TABLE public.user_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only access their own tokens
CREATE POLICY "Users manage own OAuth tokens"
  ON public.user_oauth_tokens
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Index for efficient lookups
CREATE INDEX idx_user_oauth_tokens_user_provider
  ON public.user_oauth_tokens(user_id, provider_slug);

-- Trigger for updated_at
CREATE TRIGGER update_user_oauth_tokens_updated_at
  BEFORE UPDATE ON public.user_oauth_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
```

#### User Stories

| ID | Story | Priority | Effort | Status |
|----|-------|----------|--------|--------|
| PB-055 | Create `user_oauth_tokens` table with RLS | Critical | 1h | ✅ Done |
| PB-056 | Create "Connected Services" section in Settings page | High | 2h | ✅ Done |
| PB-057 | Create `IntegrationConnectionCard` component | High | 1.5h | ✅ Done |
| PB-058 | Implement Google OAuth flow for individual users | High | 3h | ✅ Done |
| PB-059 | Implement Zoom OAuth flow for individual users | High | 3h | ✅ Done |
| PB-060 | Implement Microsoft OAuth flow for individual users | High | 3h | ✅ Done |
| PB-061 | Create `user-oauth-connect` edge function | High | 2h | ✅ Done |
| PB-062 | Create `user-oauth-callback` edge function | High | 2h | ✅ Done |
| PB-063 | Create `user-oauth-refresh` edge function | Medium | 1.5h | ✅ Done |
| PB-064 | Add token encryption/decryption utilities | Medium | 1h | ✅ Done |
| PB-065 | Show connection status in Settings page | Medium | 1h | ✅ Done |
| PB-066 | Add "Disconnect" functionality with token revocation | Medium | 1.5h | ✅ Done |
| PB-067 | Filter available providers based on admin settings | Low | 0.5h | ✅ Done |

**Sprint Total: ~23 hours**

#### UI Design: My Integrations Section

**Location:** Settings Page (`/settings`)

```
┌─────────────────────────────────────────────────────────┐
│ Connected Services                                       │
│ Connect your personal accounts to enable syncing        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ┌─────────────────────┐ ┌─────────────────────┐        │
│ │ 🔴 Google           │ │ 🔵 Zoom             │        │
│ │ ✅ Connected        │ │ Not Connected       │        │
│ │ john@gmail.com      │ │ Connect to sync     │        │
│ │ Drive, Calendar     │ │ your meetings       │        │
│ │ [Disconnect]        │ │ [Connect Account]   │        │
│ └─────────────────────┘ └─────────────────────┘        │
│                                                         │
│ ┌─────────────────────┐ ┌─────────────────────┐        │
│ │ 🔷 Microsoft 365    │ │ ⚫ Slack            │        │
│ │ Not Connected       │ │ Not Available       │        │
│ │ Connect calendar &  │ │ Contact admin to    │        │
│ │ OneDrive            │ │ enable              │        │
│ │ [Connect Account]   │ │                     │        │
│ └─────────────────────┘ └─────────────────────┘        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Connection States:**
1. **Connected** - Green check, shows connected email, disconnect button
2. **Not Connected** - Provider enabled by admin, user can connect
3. **Not Available** - Provider not enabled by admin, greyed out

#### Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/20260105_user_oauth_tokens.sql` | Create | Database migration |
| `src/pages/Settings.tsx` | Modify | Add "Connected Services" section |
| `src/components/settings/ConnectedServices.tsx` | Create | Container for connection cards |
| `src/components/settings/IntegrationConnectionCard.tsx` | Create | Reusable connection card |
| `src/hooks/useUserIntegrations.ts` | Create | Hooks for user OAuth tokens |
| `src/pages/settings/OAuthCallback.tsx` | Create | User OAuth callback handler |
| `supabase/functions/user-oauth-connect/index.ts` | Create | Initiate user OAuth |
| `supabase/functions/user-oauth-callback/index.ts` | Create | Handle OAuth callback |
| `supabase/functions/user-oauth-refresh/index.ts` | Create | Refresh tokens |
| `supabase/functions/user-oauth-disconnect/index.ts` | Create | Revoke and delete tokens |

#### Acceptance Criteria

- [x] User can see "Connected Services" section in Settings
- [x] User can connect Google account if admin has enabled Google
- [x] User can connect Zoom account if admin has enabled Zoom
- [x] User can connect Microsoft account if admin has enabled Microsoft
- [x] Connected status shows account email and last sync time
- [x] User can disconnect at any time
- [x] Tokens are encrypted at rest
- [x] Tokens auto-refresh before expiration
- [x] Providers not enabled by admin show "Not Available"

#### Dependency Chain

```
Sprint 4 (Admin Integration Settings)
         ↓
Sprint 10 (User Integration Connections)
         ↓
Sprint 8 (Meetings Enhancement with multi-provider)
```

**Note**: Sprint 10 depends on Sprint 4 being complete, as users can only connect to providers that admins have enabled.

---

## 4. Configuration Keys Reference

### Branding Configuration

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `branding.company_name` | string | "CollabAi" | Displayed in sidebar and headers |
| `branding.logo_url` | string | null | Logo image URL (Supabase Storage) |
| `branding.primary_color` | string | "#1e293b" | Primary theme color (HSL) |
| `branding.accent_color` | string | "#3b82f6" | Accent/highlight color (HSL) |
| `branding.favicon_url` | string | null | Favicon URL |

### Feature Toggles

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `features.clients_enabled` | boolean | true | Show Clients module |
| `features.meetings_enabled` | boolean | true | Show Meetings module |
| `features.knowledge_enabled` | boolean | true | Show Knowledge Base module |
| `features.ai_enabled` | boolean | true | Show AI Agents (admin only) |
| `features.feedback_enabled` | boolean | true | Enable feedback collection |

### Integration Settings

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `integrations.zoom_enabled` | boolean | false | Zoom integration active |
| `integrations.google_enabled` | boolean | false | Google Drive integration active |
| `integrations.sendgrid_enabled` | boolean | false | SendGrid email integration active |
| `integrations.openai_enabled` | boolean | true | OpenAI integration active |

### AI Configuration

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `ai.default_model` | string | "gpt-4o-mini" | Default AI model for agents |
| `ai.max_tokens` | number | 2000 | Max tokens per response |
| `ai.temperature` | number | 0.7 | AI response temperature |

---

## 5. File Structure (New/Modified)

### New Files to Create (in Lovable.dev)

```
src/
├── hooks/
│   └── useAppConfig.ts          # Configuration hook with caching
├── pages/
│   └── admin/
│       ├── Branding.tsx         # Branding settings page
│       ├── Features.tsx         # Feature toggles page
│       ├── Users.tsx            # User management page
│       ├── Integrations.tsx     # Integration settings page
│       └── AIConfig.tsx         # AI agent management page
├── components/
│   └── admin/
│       ├── OnboardingWizard.tsx # Setup wizard for new deployments
│       ├── DeploymentChecklist.tsx
│       └── UserInviteForm.tsx
supabase/
└── functions/                   # Edge functions (auto-deployed by Lovable)
    ├── ai-chat/
    │   └── index.ts             # AI conversation handler
    ├── meeting-processor/
    │   └── index.ts             # Zoom integration handler
    ├── knowledge-search/
    │   └── index.ts             # Vector search handler
    └── email-sender/
        └── index.ts             # SendGrid email handler
```

### Modified Files

| File | Changes |
|------|---------|
| `src/App.tsx` | AI routes wrapped with AdminRoute |
| `src/components/layout/AppSidebar.tsx` | Role-based item filtering |
| `src/pages/Admin.tsx` | Navigation to admin sub-pages |
| `src/contexts/AuthContext.tsx` | Debug logging for role fetching |

---

## 6. Client Deployment Checklist

Use this checklist when deploying CollabAi to a new client:

### Pre-Deployment (Lovable + Supabase)
- [ ] Fork/remix project in [Lovable.dev](https://lovable.dev)
- [ ] Supabase project auto-provisioned or connected
- [ ] Configure Site URL and Redirect URLs in Supabase Auth

### Admin Setup (Supabase Dashboard)
- [ ] Create admin account via Supabase Auth
- [ ] Assign admin role in `user_roles` table
- [ ] Verify admin can access `/admin` route

### Branding Configuration (via Lovable.dev)
- [ ] Set company name
- [ ] Upload company logo
- [ ] Configure primary/accent colors
- [ ] Update favicon

### Feature Configuration (via Admin Panel / Code)
- [ ] Enable/disable Clients module
- [ ] Enable/disable Meetings module
- [ ] Enable/disable Knowledge Base
- [ ] Enable/disable AI Agents

### Integration Setup (Supabase Edge Function Secrets)
- [ ] Configure Zoom credentials (if meetings used)
- [ ] Set OpenAI API key (if AI used)
- [ ] Configure SendGrid (if email notifications needed)

### User Onboarding
- [ ] Invite initial admin users
- [ ] Invite regular users
- [ ] Verify user roles assigned correctly

### Final Verification
- [ ] Test login flow (email/password)
- [ ] Verify dashboard loads correctly
- [ ] Test all enabled modules
- [ ] Confirm AI chat works (if enabled)
- [ ] Test on mobile viewport

### Go Live (via Lovable)
- [ ] Click **Publish** in Lovable.dev
- [ ] Configure custom domain (if applicable)
- [ ] Update Supabase Site URL to production URL
- [ ] Document client-specific configurations

---

## 7. Estimated Timeline

| Sprint | Focus | Estimated Hours | Cumulative |
|--------|-------|-----------------|------------|
| Sprint 1 | Access Control Fixes | 2h | 2h |
| Sprint 2 | App Configuration | 5.5h | 7.5h |
| Sprint 3 | User Management | 7h | 14.5h |
| Sprint 4 | Integration Management | 6h | 20.5h |
| Sprint 5 | Edge Functions | 8h | 28.5h |
| Sprint 6 | Onboarding | 8h | 36.5h |
| Sprint 7 | Enterprise SSO & Authentication | 25.5h | 62h |
| Sprint 8 | Meetings Enhancement | 26h | 88h |
| Sprint 9 | AI-Powered Features | 19h | 107h |
| Sprint 10 | User Integration Connections | 23h | 130h |

**Total Estimated Development Time:** ~130 hours

### Sprint Dependency Diagram

```
Sprint 1 (Access Control) ✅
         ↓
Sprint 2-3 (Config + Users)
         ↓
Sprint 4 (Admin Integration Settings) ← Required for user connections
         ↓
    ┌────┴────┐
    ↓         ↓
Sprint 7   Sprint 10
(SSO)      (User Connections)
    ↓         ↓
    └────┬────┘
         ↓
Sprint 8 (Meetings - uses user connections)
         ↓
Sprint 9 (AI Features)
```

---

## 8. Technical Decisions

### Why Separate `user_roles` Table?
- **Security:** Prevents privilege escalation attacks
- **Flexibility:** Users can have multiple roles
- **RLS Safety:** Uses `SECURITY DEFINER` function to avoid recursion

### Why `app_config` as Key-Value Store?
- **Flexibility:** Add new settings without schema changes
- **Multi-tenant Ready:** Each deployment has its own config
- **Type Safety:** JSONB with TypeScript interfaces

### Why Edge Functions for Backend Logic?
- **Serverless:** Auto-scaling with traffic (managed by Supabase)
- **Security:** Server-side API key handling
- **Integration:** Direct Supabase access with service role
- **Auto-deploy:** Lovable automatically deploys edge functions

---

## 9. Risk Mitigation

| Risk | Mitigation |
|------|------------|
| RLS policy misconfiguration | Use `has_role()` function consistently |
| API key exposure | Store in Supabase Edge Function Secrets |
| Slow deployments | Use this checklist and template database |
| Feature conflicts | Use feature flags, test modules independently |

---

## 10. Success Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Deployment time per client | < 4 hours | TBD |
| Code changes per client | 0 (config only) | TBD |
| Admin panel configuration coverage | 90% | ~10% |
| Edge function deployment success | 100% | 0% |

---

## 🔗 Quick Links

| Resource | Link |
|----------|------|
| **Lovable.dev** | [lovable.dev](https://lovable.dev) |
| **Lovable Docs** | [docs.lovable.dev](https://docs.lovable.dev) |
| **Supabase Dashboard** | [supabase.com/dashboard](https://supabase.com/dashboard) |
| **Supabase Docs** | [supabase.com/docs](https://supabase.com/docs) |

---

**Development Platform:** [Lovable.dev](https://lovable.dev)  
**Backend Platform:** [Supabase](https://supabase.com)

*Document maintained by: CollabAi Development Team*
