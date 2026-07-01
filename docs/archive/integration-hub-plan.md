# Integration Hub - Comprehensive Implementation Plan

## Table of Contents
1. [Overview](#overview)
2. [Database Schema](#database-schema)
3. [Provider API Research Summary](#provider-api-research-summary)
4. [Implementation Phases](#implementation-phases)
5. [Module Details](#module-details)
6. [File Structure](#file-structure)
7. [Testing & Validation](#testing--validation)

---

## Overview

This plan creates a comprehensive Integration Hub that unifies all third-party service integrations under a single, scalable architecture. The design incorporates patterns from the existing AI Model Management page and extends them to support multiple integration categories.

### Key Features (from AI Model Management)
- ✅ Provider-level enable/disable toggles
- ✅ Individual item enable/disable (models → services)
- ✅ Default selection per category
- ✅ Cost tracking and calculators (where applicable)
- ✅ Feature badges for capabilities
- ✅ Real-time status indicators
- ✅ Test connection functionality
- ✅ Usage analytics and logging

### Integration Categories
1. **AI Providers** (existing - enhance)
2. **Meeting Providers** (new)
3. **CRM Systems** (new)
4. **Project Management** (new)
5. **Email Providers** (enhance existing)
6. **Storage & Productivity** (new)
7. **Authentication/SSO** (future)

---

## Database Schema

### Phase 1: Core Integration Tables

#### Table 1: `integration_categories`
Purpose: Define high-level categories for organizing integrations

```sql
CREATE TABLE public.integration_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT, -- Lucide icon name
  display_order INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger for updated_at
CREATE TRIGGER set_integration_categories_updated_at
  BEFORE UPDATE ON public.integration_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Index
CREATE INDEX idx_integration_categories_slug ON public.integration_categories(slug);
CREATE INDEX idx_integration_categories_display_order ON public.integration_categories(display_order);
```

**Seed Data:**
```sql
INSERT INTO public.integration_categories (name, slug, description, icon, display_order) VALUES
  ('AI Providers', 'ai-providers', 'AI models for chat, embeddings, and analysis', 'Brain', 10),
  ('Meeting Providers', 'meeting-providers', 'Video conferencing and meeting platforms', 'Video', 20),
  ('Email Providers', 'email-providers', 'Transactional and marketing email services', 'Mail', 30),
  ('CRM Systems', 'crm-systems', 'Customer relationship management platforms', 'Users', 40),
  ('Project Management', 'project-management', 'Task and project tracking tools', 'Kanban', 50),
  ('Storage & Productivity', 'storage-productivity', 'Cloud storage and productivity suites', 'Cloud', 60),
  ('Authentication', 'authentication', 'SSO and identity providers', 'Shield', 70);
```

---

#### Table 2: `integration_providers`
Purpose: Define individual service providers within categories

```sql
CREATE TABLE public.integration_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.integration_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  logo_url TEXT,
  docs_url TEXT,

  -- Authentication configuration
  auth_type TEXT NOT NULL CHECK (auth_type IN ('api_key', 'oauth2', 'basic', 'service_account')),
  oauth_config JSONB, -- { authorize_url, token_url, scopes[] }

  -- Status
  is_available BOOLEAN DEFAULT true, -- Ready to use
  is_coming_soon BOOLEAN DEFAULT false, -- Planned but not implemented
  is_beta BOOLEAN DEFAULT false,

  -- Display
  display_order INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger for updated_at
CREATE TRIGGER set_integration_providers_updated_at
  BEFORE UPDATE ON public.integration_providers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Indexes
CREATE INDEX idx_integration_providers_category ON public.integration_providers(category_id);
CREATE INDEX idx_integration_providers_slug ON public.integration_providers(slug);
CREATE INDEX idx_integration_providers_display_order ON public.integration_providers(display_order);
```

---

#### Table 3: `integration_fields`
Purpose: Define dynamic form fields for each provider (like AI models have fields)

```sql
CREATE TABLE public.integration_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.integration_providers(id) ON DELETE CASCADE,

  -- Field definition
  field_key TEXT NOT NULL, -- e.g., 'api_key', 'client_id', 'domain'
  label TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('text', 'password', 'url', 'email', 'select', 'textarea')),

  -- Validation
  placeholder TEXT,
  default_value TEXT,
  is_required BOOLEAN DEFAULT false,
  is_sensitive BOOLEAN DEFAULT false, -- Should be encrypted

  -- Help & documentation
  help_text TEXT,
  validation_regex TEXT,

  -- Select options (if field_type = 'select')
  select_options JSONB, -- [{ value: 'option1', label: 'Option 1' }]

  -- Display
  display_order INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_integration_fields_provider ON public.integration_fields(provider_id);
CREATE INDEX idx_integration_fields_display_order ON public.integration_fields(display_order);
```

---

#### Table 4: `organization_integrations`
Purpose: Store organization-specific integration configurations (equivalent to app_config but scoped)

```sql
CREATE TABLE public.organization_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID, -- Future: multi-tenancy support (nullable for now, defaults to single org)
  provider_id UUID NOT NULL REFERENCES public.integration_providers(id) ON DELETE CASCADE,

  -- Configuration
  enabled BOOLEAN DEFAULT false,
  config JSONB NOT NULL DEFAULT '{}'::jsonb, -- Encrypted credentials and settings

  -- Connection status
  connection_status TEXT CHECK (connection_status IN ('connected', 'disconnected', 'error', 'testing')) DEFAULT 'disconnected',
  connection_message TEXT,
  last_tested_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,

  -- OAuth tokens (encrypted)
  oauth_tokens JSONB, -- { access_token, refresh_token, expires_at }

  -- Metadata
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraint: one integration per provider per organization
  UNIQUE(organization_id, provider_id)
);

-- Trigger for updated_at
CREATE TRIGGER set_organization_integrations_updated_at
  BEFORE UPDATE ON public.organization_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Indexes
CREATE INDEX idx_organization_integrations_provider ON public.organization_integrations(provider_id);
CREATE INDEX idx_organization_integrations_org ON public.organization_integrations(organization_id);
CREATE INDEX idx_organization_integrations_enabled ON public.organization_integrations(enabled);
```

---

#### Table 5: `integration_services`
Purpose: Individual services within a provider (like AI models within a provider)

```sql
CREATE TABLE public.integration_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.integration_providers(id) ON DELETE CASCADE,

  -- Service identification
  name TEXT NOT NULL, -- e.g., "Basic Meetings", "Webinar", "Recording API"
  service_key TEXT NOT NULL, -- e.g., 'zoom_meetings', 'zoom_recordings'
  description TEXT,

  -- Features & capabilities
  features JSONB, -- { recording: true, transcription: true, breakout_rooms: false }

  -- Pricing (optional, for cost tracking)
  has_cost BOOLEAN DEFAULT false,
  cost_model JSONB, -- { type: 'per_api_call', rate: 0.001 } or { type: 'flat', rate: 10 }

  -- Status
  enabled BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false, -- Like default AI model
  requires_config BOOLEAN DEFAULT false, -- Needs additional setup

  -- Display
  display_order INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(provider_id, service_key)
);

-- Trigger for updated_at
CREATE TRIGGER set_integration_services_updated_at
  BEFORE UPDATE ON public.integration_services
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Indexes
CREATE INDEX idx_integration_services_provider ON public.integration_services(provider_id);
CREATE INDEX idx_integration_services_enabled ON public.integration_services(enabled);
```

---

#### Table 6: `integration_usage_logs`
Purpose: Track API usage for analytics (like ai_usage_logs)

```sql
CREATE TABLE public.integration_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID, -- Future: multi-tenancy
  provider_id UUID REFERENCES public.integration_providers(id) ON DELETE SET NULL,
  service_id UUID REFERENCES public.integration_services(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Usage details
  action TEXT NOT NULL, -- e.g., 'send_email', 'create_meeting', 'upload_file'
  status TEXT CHECK (status IN ('success', 'error', 'partial')) DEFAULT 'success',

  -- Metadata
  request_metadata JSONB, -- Request details
  response_metadata JSONB, -- Response details
  error_message TEXT,

  -- Cost tracking
  estimated_cost DECIMAL(10, 8) DEFAULT 0,

  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for analytics
CREATE INDEX idx_integration_usage_logs_provider ON public.integration_usage_logs(provider_id);
CREATE INDEX idx_integration_usage_logs_service ON public.integration_usage_logs(service_id);
CREATE INDEX idx_integration_usage_logs_user ON public.integration_usage_logs(user_id);
CREATE INDEX idx_integration_usage_logs_created_at ON public.integration_usage_logs(created_at);
CREATE INDEX idx_integration_usage_logs_org ON public.integration_usage_logs(organization_id);
```

---

### RLS Policies

```sql
-- Enable RLS
ALTER TABLE public.integration_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_usage_logs ENABLE ROW LEVEL SECURITY;

-- Categories: Read-only for all authenticated users
CREATE POLICY "Categories are viewable by authenticated users"
  ON public.integration_categories FOR SELECT
  TO authenticated
  USING (true);

-- Providers: Read-only for all authenticated users
CREATE POLICY "Providers are viewable by authenticated users"
  ON public.integration_providers FOR SELECT
  TO authenticated
  USING (true);

-- Fields: Read-only for all authenticated users
CREATE POLICY "Fields are viewable by authenticated users"
  ON public.integration_fields FOR SELECT
  TO authenticated
  USING (true);

-- Services: Read-only for all authenticated users
CREATE POLICY "Services are viewable by authenticated users"
  ON public.integration_services FOR SELECT
  TO authenticated
  USING (true);

-- Organization Integrations: Admins only
CREATE POLICY "Admins can manage organization integrations"
  ON public.organization_integrations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Usage Logs: Admins can view all, users can view their own
CREATE POLICY "Admins can view all usage logs"
  ON public.integration_usage_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Users can view their own usage logs"
  ON public.integration_usage_logs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
```

---

## Provider API Research Summary

### Meeting Providers

#### 1. **Zoom** (Already Integrated - Enhance)
- **Auth**: OAuth 2.0 (Account Credentials Grant)
- **Current Implementation**: `validate-api-key` supports Zoom
- **Enhancement Needed**:
  - Add to integration_providers table
  - Migrate existing Zoom config from app_config
  - Add services: recordings, transcriptions, webhooks
- **Key Endpoints**:
  - Token: `https://zoom.us/oauth/token`
  - Meetings: `/v2/users/{userId}/meetings`
  - Recordings: `/v2/meetings/{meetingId}/recordings`

#### 2. **Microsoft Teams** (New)
- **Auth**: OAuth 2.0 via Microsoft Graph API
- **Documentation**: [Microsoft Graph Teams API](https://learn.microsoft.com/en-us/graph/api/resources/teams-api-overview)
- **Key Features**:
  - User-delegated auth for user actions
  - App-only auth for background services
  - Webhooks via Graph subscriptions
- **Required Scopes**:
  - `OnlineMeetings.ReadWrite`
  - `CallRecords.Read.All`
  - `CallRecording.Read.All`
- **Key Endpoints**:
  - Authorize: `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize`
  - Token: `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token`
  - Meetings: `https://graph.microsoft.com/v1.0/me/onlineMeetings`

#### 3. **Google Meet** (New)
- **Auth**: OAuth 2.0 (Google Workspace)
- **Documentation**: [Google Meet API](https://developers.google.com/workspace/meet/api/guides/overview)
- **Integration**: Via Google Calendar API + Meet API
- **Required Scopes**:
  - `https://www.googleapis.com/auth/calendar`
  - `https://www.googleapis.com/auth/meetings.space.created`
- **Key Endpoints**:
  - Calendar Events: `/calendar/v3/calendars/{calendarId}/events`
  - Meet Spaces: `/meet/v2/spaces`
- **Recent Update**: Workspace Events API (Dec 2025) - webhooks for meeting start/end, participants

#### 4. **Webex (Cisco)** (New)
- **Auth**: OAuth 2.0 or Personal Access Token
- **Documentation**: [Webex API](https://developer.webex.com/docs/api/guides/integrations-and-authorization)
- **Note**: XML APIs deprecated (Mar 2024), use REST API only
- **Required Scopes**:
  - `meeting:recordings_read`
  - `meeting:recordings_write`
  - `spark:all` (for meetings)
- **Key Endpoints**:
  - Authorize: `https://api.webex.com/v1/oauth2/authorize`
  - Token: `https://api.webex.com/v1/oauth2/token`
  - Meetings: `https://api.webex.com/v1/meetings`
  - Recordings: `https://api.webex.com/v1/recordings`

#### 5. **GoToMeeting** (New)
- **Auth**: OAuth 2.0
- **Documentation**: [GoTo Developer Portal](https://developer.goto.com/)
- **Key Endpoints**:
  - Authorize: `https://api.getgo.com/oauth/v2/authorize`
  - Token: `https://api.getgo.com/oauth/v2/token`
  - Meetings: `https://api.getgo.com/admin/rest/v1/meetings`

---

### CRM Systems

#### 1. **Salesforce** (New)
- **Auth**: OAuth 2.0 (Recommended: JWT Bearer Flow for server-to-server)
- **Documentation**: [Salesforce REST API](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/)
- **Best Practice (2026)**: Use Integration User with API-only license
- **Required Setup**:
  - Create Connected App
  - Generate certificate for JWT flow
  - Assign Permission Sets
- **Key Endpoints**:
  - Authorize: `https://login.salesforce.com/services/oauth2/authorize`
  - Token: `https://login.salesforce.com/services/oauth2/token`
  - REST API Base: `https://yourInstance.salesforce.com/services/data/v60.0/`
- **Validation Endpoint**: `/services/data/` (list available API versions)

#### 2. **HubSpot** (New)
- **Auth**: OAuth 2.0 (Private Apps deprecated API keys in 2024)
- **Documentation**: [HubSpot API](https://developers.hubspot.com/docs/api-reference/overview)
- **Note**: Must use OAuth for customer-facing integrations
- **Private Apps**: For internal use, generate access tokens (no refresh needed)
- **Required Scopes**:
  - `crm.objects.contacts.read`
  - `crm.objects.contacts.write`
  - `crm.objects.companies.read`
- **Key Endpoints**:
  - Authorize: `https://app.hubspot.com/oauth/authorize`
  - Token: `https://api.hubapi.com/oauth/v1/token`
  - Contacts: `https://api.hubapi.com/crm/v3/objects/contacts`
- **Validation Endpoint**: `/crm/v3/objects/contacts?limit=1`

#### 3. **Pipedrive** (New)
- **Auth**: API Token or OAuth 2.0
- **Documentation**: [Pipedrive API](https://developers.pipedrive.com/docs/api/v1)
- **Simple Auth**: Single API token for internal tools
- **OAuth for Public Apps**: Standard OAuth 2.0 flow
- **Key Endpoints**:
  - OAuth Authorize: `https://oauth.pipedrive.com/oauth/authorize`
  - OAuth Token: `https://oauth.pipedrive.com/oauth/token`
  - API Base: `https://api.pipedrive.com/v1/`
- **Validation Endpoint**: `/v1/users/me` (get current user)
- **Token Refresh**: Access tokens expire, use refresh_token

#### 4. **Zoho CRM** (New)
- **Auth**: OAuth 2.0 (Bearer tokens)
- **Documentation**: [Zoho CRM API V8](https://www.zoho.com/crm/developer/docs/api/v8/)
- **Token Lifetime**: Access tokens valid for 1 hour
- **Required Steps**:
  1. Register app in Zoho API Console
  2. Get Client ID & Secret
  3. Generate authorization code
  4. Exchange for access token
  5. Use refresh token for renewals (60-minute expiry)
- **Key Endpoints**:
  - Authorize: `https://accounts.zoho.com/oauth/v2/auth`
  - Token: `https://accounts.zoho.com/oauth/v2/token`
  - API Base: `https://www.zohoapis.com/crm/v8/`
- **Validation Endpoint**: `/crm/v8/users?type=CurrentUser`
- **Header Format**: `Authorization: Zoho-oauthtoken {access_token}`

---

### Project Management Tools

#### 1. **Jira (Atlassian Cloud)** (New)
- **Auth**: OAuth 2.0 (3LO - Three-Legged OAuth) or API Tokens
- **Documentation**: [Jira Cloud REST API](https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/)
- **Recommended**: OAuth 2.0 for integrations, API tokens only for scripts
- **Important 2026 Update**: API tokens expire between Mar 14 - May 12, 2026
- **Deprecated**: OAuth 1.0a (do not use)
- **API Token Auth**: Use email + API token with Basic Auth
- **Key Endpoints**:
  - Authorize: `https://auth.atlassian.com/authorize`
  - Token: `https://auth.atlassian.com/oauth/token`
  - API Base: `https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3/`
- **Validation Endpoint**: `/rest/api/3/myself`

#### 2. **Asana** (New)
- **Auth**: Personal Access Token or OAuth 2.0
- **Documentation**: [Asana API](https://developers.asana.com/docs/authentication)
- **Auth Options**:
  - **PAT**: Quick, simple, long-lived (for personal/internal use)
  - **OAuth**: For customer-facing apps, hourly token refresh
  - **Service Accounts**: Enterprise-only, complete org access
- **Required Scopes**: Define during OAuth setup
- **Key Endpoints**:
  - Authorize: `https://app.asana.com/-/oauth_authorize`
  - Token: `https://app.asana.com/-/oauth_token`
  - API Base: `https://app.asana.com/api/1.0/`
- **Validation Endpoint**: `/users/me`
- **Token Lifetime**: Access tokens expire after 1 hour

#### 3. **Monday.com** (New)
- **Auth**: API Token or OAuth 2.0
- **Documentation**: [Monday.com API](https://developer.monday.com/api-reference/)
- **Auth Methods**:
  - **Seamless Auth**: Short-lived tokens (5 minutes) from Monday server
  - **OAuth 2.0**: For background operations and file uploads
  - **API Token**: Simple token-based auth
- **Important 2026 Update**: JWT subscription enrichment deprecated after Feb 8, 2026
- **API Type**: GraphQL (not REST)
- **Key Endpoints**:
  - Authorize: `https://auth.monday.com/oauth2/authorize`
  - Token: `https://auth.monday.com/oauth2/token`
  - API: `https://api.monday.com/v2`
- **Headers**: `Authorization: Bearer {token}`

#### 4. **Trello (Atlassian)** (New)
- **Auth**: API Key + Token or OAuth 1.0
- **Documentation**: [Trello API](https://developer.atlassian.com/cloud/trello/guides/rest-api/authorization/)
- **Getting Started**:
  1. Create Trello Power-Up
  2. Generate API Key
  3. Generate User Token (via authorization URL)
- **Security**: API key can be public, token must be secret
- **Rate Limits**:
  - 300 requests/10 seconds per API key
  - 100 requests/10 seconds per token
- **Key Endpoints**:
  - Authorize: `https://trello.com/1/authorize`
  - API Base: `https://api.trello.com/1/`
- **Validation Endpoint**: `/1/members/me`

---

### Email Providers

#### 1. **SendGrid (Twilio)** (Already Integrated - Enhance)
- **Auth**: API Key (HTTP Basic Auth)
- **Current Implementation**: Exists in `validate-api-key` and `send-email` edge function
- **Enhancement**: Migrate to integration_providers table
- **Key Endpoints**:
  - Send: `https://api.sendgrid.com/v3/mail/send`
  - Validation: `https://api.sendgrid.com/v3/user/account`

#### 2. **Mailgun (Sinch)** (New)
- **Auth**: API Key (HTTP Basic Auth)
- **Documentation**: [Mailgun API](https://documentation.mailgun.com/docs/mailgun/api-reference/mg-auth/)
- **Auth Format**: `Authorization: Basic base64(api:{api_key})`
- **2FA Support**: For account security
- **Integration Methods**:
  - RESTful API
  - SMTP Relay
- **Security**: SPF, DKIM, DMARC support
- **Free Tier**: 100 emails/day
- **Key Endpoints**:
  - API Base: `https://api.mailgun.net/v3/`
  - Send: `/v3/{domain}/messages`
  - Validation: `/v3/domains` (list domains)

#### 3. **Postmark** (New)
- **Auth**: X-Postmark-Server-Token header
- **Documentation**: [Postmark API](https://postmarkapp.com/developer/api/overview)
- **Auth Headers**:
  - Server-level: `X-Postmark-Server-Token`
  - Account-level: `X-Postmark-Account-Token`
- **Performance (2026 Review)**: 98.7% inbox placement, 1.2s delivery
- **Batch Support**: Up to 500 messages per API call, 50 MB payload
- **Key Endpoints**:
  - API Base: `https://api.postmarkapp.com/`
  - Send: `/email`
  - Send Batch: `/email/batch`
  - Validation: `/servers` (list servers)

#### 4. **Amazon SES** (New)
- **Auth**: AWS IAM (Access Key + Secret Key)
- **Documentation**: [Amazon SES API](https://docs.aws.amazon.com/ses/latest/dg/send-email-api.html)
- **Auth Method**: AWS Signature Version 4 (handled by AWS SDK)
- **Setup Required**:
  1. Create IAM user
  2. Assign permissions: `ses:SendEmail`, `ses:SendRawEmail`
  3. Create Access Key
- **Email Verification**: Must verify sender addresses/domains
- **Integration Options**:
  - AWS SDK (recommended)
  - SMTP
  - Direct API calls
- **Security**: DKIM, SPF support
- **Key Actions**:
  - `SendEmail`
  - `SendRawEmail`
  - `CreateEmailIdentity`
  - `VerifyEmailIdentity`

---

### Storage & Productivity Suites

#### 1. **Google Workspace** (Enhance Existing)
- **Auth**: OAuth 2.0
- **Current Status**: Google Drive partially implemented
- **Components to Integrate**:
  - **Google Drive**: File storage and sync
  - **Google Calendar**: Event management (for Meet integration)
  - **Google Meet**: Meeting platform
- **Required Scopes**:
  - Drive: `https://www.googleapis.com/auth/drive.file`
  - Calendar: `https://www.googleapis.com/auth/calendar`
  - Meet: `https://www.googleapis.com/auth/meetings.space.created`
- **Service Account Option**: For backend operations
- **Key Endpoints**:
  - Authorize: `https://accounts.google.com/o/oauth2/v2/auth`
  - Token: `https://oauth2.googleapis.com/token`
  - Drive API: `https://www.googleapis.com/drive/v3/`
  - Calendar API: `https://www.googleapis.com/calendar/v3/`

#### 2. **Microsoft 365** (New)
- **Auth**: OAuth 2.0 via Microsoft Graph
- **Components to Integrate**:
  - **OneDrive**: File storage
  - **Outlook**: Email and calendar
  - **Teams**: Already covered in Meeting Providers
- **Required Scopes**:
  - OneDrive: `Files.ReadWrite.All`
  - Outlook: `Mail.ReadWrite`, `Calendars.ReadWrite`
- **Key Endpoints**:
  - Authorize: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize`
  - Token: `https://login.microsoftonline.com/common/oauth2/v2.0/token`
  - Graph API: `https://graph.microsoft.com/v1.0/`
  - OneDrive: `/me/drive/`
  - Outlook: `/me/messages`

---

## Implementation Phases

### **Phase 1: Database Foundation & Migration** (Week 1)
**Priority**: CRITICAL
**Goal**: Establish core database schema and migrate existing integrations

#### Tasks:
1. Create migration: `20260103_integration_hub_schema.sql`
   - All 6 core tables
   - RLS policies
   - Seed categories and providers
2. Seed initial provider data
3. Migrate existing integrations:
   - AI Providers → `integration_providers`
   - AI Models → `integration_services`
   - OpenAI, Anthropic, Google, Perplexity configs
   - SendGrid config
   - Zoom config
   - Google Drive config
4. Create helper functions:
   - `get_integration_config(provider_slug)`: Retrieve decrypted config
   - `set_integration_config(provider_slug, config_json)`: Store encrypted config
   - `test_integration_connection(provider_id)`: Test connection

**Deliverables**:
- ✅ Migration file
- ✅ Seed data for 20+ providers
- ✅ Data migration script
- ✅ Helper functions

**Files Created**:
- `supabase/migrations/20260103_integration_hub_schema.sql`
- `supabase/migrations/20260103_seed_integration_providers.sql`
- `supabase/migrations/20260103_migrate_existing_integrations.sql`

---

### **Phase 2: Integration Hub UI (Category Overview)** (Week 1-2)
**Priority**: HIGH
**Goal**: Create the main integration hub page with category-based organization

#### Tasks:
1. **Rewrite**: `src/pages/admin/Integrations.tsx`
   - Display categories as expandable sections
   - Show providers as cards (similar to AI Provider cards in AIModelManagement)
   - Status badges: Connected, Not Connected, Coming Soon
   - Search/filter functionality
   - Click card → navigate to `/admin/integrations/:providerSlug`

2. **Create Hook**: `src/hooks/useIntegrations.ts`
   ```typescript
   - useIntegrationCategories(): Fetch all categories
   - useIntegrationProviders(categoryId?): Fetch providers
   - useIntegrationServices(providerId): Fetch services
   - useOrganizationIntegration(providerId): Get org-specific config
   - useUpdateIntegration(): Mutation for updating config
   - useTestConnection(): Mutation for testing connection
   ```

3. **Create Utility**: `src/lib/integration-utils.ts`
   ```typescript
   - getProviderIcon(slug): Map provider to Lucide icon
   - getAuthTypeLabel(authType): Human-readable auth type
   - encryptConfig(config): Encrypt sensitive data
   - decryptConfig(config): Decrypt sensitive data
   - formatConnectionStatus(status): Status badge props
   ```

4. **UI Layout Pattern** (from AI Model Management):
   ```
   Integration Hub
   [Search integrations...]

   ▼ AI Providers (4 providers, 2 connected)
     ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
     │ OpenAI  │ │ Claude  │ │ Gemini  │ │Perplexity│
     │   ✓     │ │   ✓     │ │   ○     │ │    ○    │
     │ Connected│ │Connected│ │Configure│ │Configure│
     └─────────┘ └─────────┘ └─────────┘ └─────────┘

   ▼ Meeting Providers (5 providers, 1 connected)
     ...
   ```

**Deliverables**:
- ✅ Redesigned Integrations.tsx
- ✅ useIntegrations.ts hook
- ✅ integration-utils.ts
- ✅ Responsive card-based layout
- ✅ Category filtering

**Files**:
- `src/pages/admin/Integrations.tsx` (rewrite)
- `src/hooks/useIntegrations.ts` (new)
- `src/lib/integration-utils.ts` (new)

---

### **Phase 3: Generic Provider Detail Page** (Week 2)
**Priority**: HIGH
**Goal**: Dynamic provider configuration page that adapts to any provider

#### Tasks:
1. **Create**: `src/pages/admin/IntegrationDetail.tsx`
   - Dynamic routing: `/admin/integrations/:providerSlug`
   - Load provider from database
   - Render fields dynamically from `integration_fields`
   - Support multiple auth types:
     - **API Key**: Simple text/password inputs
     - **OAuth2**: "Connect with {Provider}" button → OAuth flow
     - **Basic Auth**: Username + password
     - **Service Account**: JSON file upload

2. **Components**:
   ```
   ┌─────────────────────────────────────┐
   │ [Provider Logo] Provider Name       │
   │ Description                         │
   │ [Documentation →] [Test Connection] │
   ├─────────────────────────────────────┤
   │ Configuration                       │
   │ ┌─────────────────────────────────┐ │
   │ │ API Key: [___________] [Show]   │ │
   │ │ Organization ID: [___________]  │ │
   │ │                                 │ │
   │ │          [Save Configuration]   │ │
   │ └─────────────────────────────────┘ │
   ├─────────────────────────────────────┤
   │ Connection Status                   │
   │ ● Connected | Last tested: 2 min ago│
   ├─────────────────────────────────────┤
   │ Available Services (like AI models) │
   │ ☑ Chat API                          │
   │ ☑ Embeddings API                    │
   │ ☐ Vision API (requires upgrade)    │
   └─────────────────────────────────────┘
   ```

3. **Features to Incorporate** (from AI Model Management):
   - Toggle switches for enable/disable
   - Service-level enable/disable (like model enable/disable)
   - Default service selection (like default model)
   - Feature badges (like model features)
   - Real-time validation
   - Cost information (where applicable)

4. **OAuth Flow Handling**:
   - OAuth button → Open popup or redirect
   - Handle callback
   - Store tokens securely
   - Auto-refresh tokens

**Deliverables**:
- ✅ IntegrationDetail.tsx page
- ✅ Dynamic field rendering
- ✅ OAuth flow UI
- ✅ Test connection functionality
- ✅ Service management (toggle on/off)

**Files**:
- `src/pages/admin/IntegrationDetail.tsx` (new)
- `src/components/integrations/ProviderConfigForm.tsx` (new)
- `src/components/integrations/OAuthButton.tsx` (new)
- `src/components/integrations/ServiceToggle.tsx` (new)

---

### **Phase 4: OAuth Callback Handler** (Week 2)
**Priority**: HIGH
**Goal**: Universal OAuth callback handler for all OAuth-based integrations

#### Tasks:
1. **Create**: `supabase/functions/oauth-callback/index.ts`
   - Generic OAuth handler
   - Support multiple providers (Google, Microsoft, Salesforce, HubSpot, etc.)
   - Exchange authorization code for tokens
   - Store tokens in `organization_integrations.oauth_tokens` (encrypted)
   - Redirect back to integration detail page

2. **OAuth Provider Configs**:
   ```typescript
   const OAUTH_CONFIGS = {
     google: {
       authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
       tokenUrl: 'https://oauth2.googleapis.com/token',
       scopes: ['drive.file', 'calendar', 'meetings.space.created']
     },
     microsoft: {
       authorizeUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
       tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
       scopes: ['Files.ReadWrite.All', 'Mail.ReadWrite']
     },
     // ... more providers
   };
   ```

3. **Create**: `src/hooks/useOAuth.ts`
   ```typescript
   - initiateOAuthFlow(providerId): Open OAuth window
   - handleOAuthCallback(code, state): Process callback
   - refreshOAuthToken(providerId): Refresh expired token
   ```

4. **Security**:
   - PKCE (Proof Key for Code Exchange) for public clients
   - State parameter for CSRF protection
   - Secure token storage with encryption

**Deliverables**:
- ✅ OAuth callback edge function
- ✅ useOAuth hook
- ✅ Token refresh mechanism
- ✅ PKCE implementation

**Files**:
- `supabase/functions/oauth-callback/index.ts` (new)
- `src/hooks/useOAuth.ts` (new)

---

### **Phase 5: API Validation Updates** (Week 2-3)
**Priority**: HIGH
**Goal**: Extend validate-api-key edge function to support all new providers

#### Tasks:
1. **Modify**: `supabase/functions/validate-api-key/index.ts`
   - Add validation logic for each new provider
   - Test actual API connection
   - Return meaningful error messages

2. **Validation Endpoints**:

   | Provider | Validation Method | Endpoint |
   |----------|-------------------|----------|
   | **Meeting** | | |
   | Zoom | GET with Bearer token | `/v2/users/me` |
   | MS Teams | GET with Bearer token | `graph.microsoft.com/v1.0/me` |
   | Google Meet | GET with Bearer token | `googleapis.com/calendar/v3/users/me/calendarList` |
   | Webex | GET with Bearer token | `/v1/people/me` |
   | GoTo | GET with Bearer token | `/admin/rest/v1/me` |
   | **CRM** | | |
   | Salesforce | GET with OAuth token | `/services/data/` |
   | HubSpot | GET with API key | `/crm/v3/objects/contacts?limit=1` |
   | Pipedrive | GET with API token | `/v1/users/me` |
   | Zoho | GET with OAuth token | `/crm/v8/users?type=CurrentUser` |
   | **Project Mgmt** | | |
   | Jira | GET with Basic/OAuth | `/rest/api/3/myself` |
   | Asana | GET with PAT/OAuth | `/users/me` |
   | Monday | POST GraphQL with token | `/v2` (query: `{ me { id } }`) |
   | Trello | GET with key+token | `/1/members/me` |
   | **Email** | | |
   | Mailgun | GET with API key | `/v3/domains` |
   | Postmark | GET with server token | `/servers` |
   | Amazon SES | AWS SDK verification | `VerifyEmailIdentity` |

3. **Error Handling**:
   - Network errors
   - Invalid credentials
   - Insufficient permissions
   - Rate limiting
   - Return detailed error messages to UI

**Deliverables**:
- ✅ Extended validate-api-key function
- ✅ Validation for 15+ new providers
- ✅ Comprehensive error messages

**Files**:
- `supabase/functions/validate-api-key/index.ts` (modify)

---

### **Phase 6: Enhanced Provider Pages** (Week 3-4)
**Priority**: MEDIUM
**Goal**: Create specialized pages for complex integrations (optional but recommended)

#### 6A. AI Models Integration Page
**Enhance Existing**: `src/pages/admin/AIModelManagement.tsx`

**Tasks**:
1. Migrate to use new `integration_providers` and `integration_services` tables
2. Keep all existing features:
   - Provider-level toggles
   - Model-level toggles
   - Default model selection
   - Cost calculator
   - Feature badges
   - Usage analytics integration
3. Add new features:
   - Connection status per provider
   - Test connection button
   - API key management
   - Model discovery (auto-detect new models from provider APIs)

**Pattern**: This becomes the reference implementation for other category pages

---

#### 6B. Google Workspace Integration Page
**Create**: `src/pages/admin/integrations/GoogleWorkspaceIntegration.tsx`

**Features**:
1. **Single OAuth for All Services**:
   - Connect once, enable Drive + Calendar + Meet
   - Request all scopes upfront
   - Show per-service enable/disable toggles

2. **Google Drive Settings**:
   - Select sync folder
   - Auto-upload settings
   - File type filters
   - Storage quota display

3. **Google Calendar Settings**:
   - Calendar selection for sync
   - Event sync preferences
   - Meeting auto-creation

4. **Google Meet Settings**:
   - Auto-add Meet to calendar events
   - Recording preferences
   - Webhook configuration

**UI Pattern** (from AI Model Management):
```
Google Workspace Integration
[Test Connection] [Disconnect]

OAuth Status: ● Connected
Last sync: 2 minutes ago

┌─ Available Services ─────────────────┐
│ ☑ Google Drive                       │
│   └─ Sync folder: /Control Tower    │
│   └─ Auto-upload: Enabled           │
│                                      │
│ ☑ Google Calendar                    │
│   └─ Synced calendars: 2            │
│                                      │
│ ☑ Google Meet                        │
│   └─ Auto-add to events: Enabled    │
└──────────────────────────────────────┘
```

**Deliverables**:
- ✅ Google Workspace integration page
- ✅ Multi-service management
- ✅ Service-specific settings

**Files**:
- `src/pages/admin/integrations/GoogleWorkspaceIntegration.tsx` (new)

---

#### 6C. Microsoft 365 Integration Page
**Create**: `src/pages/admin/integrations/Microsoft365Integration.tsx`

**Features**:
1. **Single OAuth for Microsoft Graph**:
   - OneDrive
   - Outlook (email + calendar)
   - Teams (meetings)

2. **OneDrive Settings**:
   - Similar to Google Drive
   - Folder selection
   - Sync preferences

3. **Outlook Settings**:
   - Email integration
   - Calendar sync
   - Contact sync

4. **Teams Settings**:
   - Meeting creation
   - Channel integration
   - Webhook subscriptions

**Deliverables**:
- ✅ Microsoft 365 integration page
- ✅ Graph API integration
- ✅ Multi-service toggles

**Files**:
- `src/pages/admin/integrations/Microsoft365Integration.tsx` (new)

---

#### 6D. Zoom Enhanced Integration Page
**Create**: `src/pages/admin/integrations/ZoomIntegration.tsx`

**Features**:
1. **OAuth Configuration** (upgrade from current implementation)
2. **Webhook Setup**:
   - Meeting started
   - Meeting ended
   - Recording completed
   - Participant joined/left

3. **Recording Settings**:
   - Auto-download recordings
   - Storage location (local DB, S3, Drive)
   - Retention policy

4. **Transcript Settings**:
   - Auto-process transcripts
   - AI summarization
   - Speaker identification

5. **Meeting Filters**:
   - Sync only specific meeting types
   - User filters
   - Date range

**Deliverables**:
- ✅ Enhanced Zoom integration page
- ✅ Webhook configuration UI
- ✅ Advanced filtering

**Files**:
- `src/pages/admin/integrations/ZoomIntegration.tsx` (new)

---

### **Phase 7: CRM Integration Pages** (Week 4)
**Priority**: MEDIUM
**Goal**: Specialized pages for major CRM systems

#### 7A. Salesforce Integration
**Create**: `src/pages/admin/integrations/SalesforceIntegration.tsx`

**Features**:
- OAuth 2.0 setup
- Object sync configuration (Contacts, Accounts, Opportunities)
- Field mapping
- Sync frequency
- Webhook listeners

#### 7B. HubSpot Integration
**Create**: `src/pages/admin/integrations/HubSpotIntegration.tsx`

**Features**:
- Private app or OAuth
- CRM object sync
- Deal pipeline mapping
- Contact properties

**Deliverables**:
- ✅ Salesforce integration page
- ✅ HubSpot integration page
- ✅ Field mapping UI
- ✅ Sync configuration

**Files**:
- `src/pages/admin/integrations/SalesforceIntegration.tsx` (new)
- `src/pages/admin/integrations/HubSpotIntegration.tsx` (new)

---

### **Phase 8: Analytics & Usage Tracking** (Week 4-5)
**Priority**: MEDIUM
**Goal**: Integration usage analytics (like AI Usage Analytics)

#### Tasks:
1. **Create**: `src/pages/admin/IntegrationUsageAnalytics.tsx`
   - Pattern based on `AIUsageAnalytics.tsx`
   - Charts for API usage by provider
   - Cost breakdown
   - Error rate tracking
   - Top users

2. **Create Utility Functions**:
   ```typescript
   // In edge functions
   logIntegrationUsage({
     providerId,
     serviceId,
     action,
     userId,
     status,
     cost,
     metadata
   })
   ```

3. **Integration into existing edge functions**:
   - Modify `send-email` to log usage
   - Modify `sync-zoom-files` to log usage
   - Create pattern for all future integrations

4. **Analytics Dashboard**:
   - Usage by category
   - Usage by provider
   - Cost trends
   - Error analytics
   - Daily/weekly/monthly views

**Deliverables**:
- ✅ Usage analytics page
- ✅ Logging utilities
- ✅ Charts and visualizations
- ✅ Cost tracking

**Files**:
- `src/pages/admin/IntegrationUsageAnalytics.tsx` (new)
- `supabase/functions/_shared/integration-logger.ts` (new)

---

### **Phase 9: Router & Navigation Updates** (Week 5)
**Priority**: HIGH
**Goal**: Wire up all new routes and update navigation

#### Tasks:
1. **Modify**: `src/App.tsx`
   ```tsx
   // Admin Routes
   <Route path="/admin/integrations" element={<Integrations />} />
   <Route path="/admin/integrations/:providerSlug" element={<IntegrationDetail />} />
   <Route path="/admin/integration-analytics" element={<IntegrationUsageAnalytics />} />

   // Specialized integration pages (optional)
   <Route path="/admin/integrations/google-workspace" element={<GoogleWorkspaceIntegration />} />
   <Route path="/admin/integrations/microsoft-365" element={<Microsoft365Integration />} />
   <Route path="/admin/integrations/zoom" element={<ZoomIntegration />} />
   <Route path="/admin/integrations/salesforce" element={<SalesforceIntegration />} />
   <Route path="/admin/integrations/hubspot" element={<HubSpotIntegration />} />
   ```

2. **Modify**: `src/components/layout/AdminSidebar.tsx`
   - Update "Integrations" link
   - Add "Integration Analytics" link (if separate from AI Usage)
   - Or merge into single "Analytics" section

3. **Navigation Structure**:
   ```
   Admin Panel
   ├─ Dashboard
   ├─ Users
   ├─ Roles
   ├─ Settings
   ├─ Integrations (new structure)
   ├─ Analytics
   │  ├─ AI Usage
   │  └─ Integration Usage
   ├─ Logs
   └─ Environment
   ```

**Deliverables**:
- ✅ All routes configured
- ✅ Navigation updated
- ✅ Breadcrumbs working

**Files**:
- `src/App.tsx` (modify)
- `src/components/layout/AdminSidebar.tsx` (modify)

---

### **Phase 10: Testing & Documentation** (Week 5)
**Priority**: HIGH
**Goal**: Comprehensive testing and user documentation

#### Tasks:
1. **Integration Testing**:
   - Test OAuth flows for each provider
   - Test API key validation
   - Test connection status updates
   - Test service enable/disable
   - Test cost tracking
   - Test usage logging

2. **User Documentation**:
   - Create setup guide for each provider
   - Document OAuth setup steps
   - Document API key generation
   - Create troubleshooting guide

3. **Admin Documentation**:
   - How to add new providers
   - How to add new services
   - Database schema documentation
   - Edge function documentation

4. **Migration Guide**:
   - How to migrate from old integration system
   - Data backup recommendations
   - Rollback procedures

**Deliverables**:
- ✅ Test results for all integrations
- ✅ User setup guides
- ✅ Admin documentation
- ✅ Migration guide

**Files**:
- `docs/integrations/SETUP_GUIDE.md` (new)
- `docs/integrations/ADMIN_GUIDE.md` (new)
- `docs/integrations/providers/` (directory with per-provider docs)

---

## Module Details

### Module 1: Database Schema
**Location**: `supabase/migrations/`

**Tables Summary**:
1. `integration_categories`: 7 categories (AI, Meeting, Email, CRM, PM, Storage, Auth)
2. `integration_providers`: 20+ providers
3. `integration_fields`: Dynamic form fields per provider
4. `organization_integrations`: Org-specific configs
5. `integration_services`: Individual services per provider
6. `integration_usage_logs`: Usage tracking

**Key Features**:
- JSONB for flexible configuration
- RLS for security
- Encrypted sensitive data
- Audit timestamps
- Foreign key relationships

---

### Module 2: Integration Hub UI
**Location**: `src/pages/admin/Integrations.tsx`

**Features**:
- Category-based organization
- Provider cards with status
- Search and filter
- Connection status badges
- Quick actions (Configure, Test, Disconnect)

**UI Components**:
- Card-based layout (from AI Model Management)
- Badge for status (Connected, Not Connected, Coming Soon, Beta)
- Switch for enable/disable
- Icons from Lucide React

---

### Module 3: Provider Detail Page
**Location**: `src/pages/admin/IntegrationDetail.tsx`

**Dynamic Features**:
- Load provider from database
- Render fields from `integration_fields`
- Support multiple auth types
- Service management (like model management)
- Test connection
- Connection status display

**Sections**:
1. Header (logo, name, docs link)
2. Configuration form
3. Connection status
4. Available services
5. Usage statistics (optional)

---

### Module 4: OAuth Handler
**Location**: `supabase/functions/oauth-callback/`

**Providers Supported**:
- Google Workspace
- Microsoft 365
- Salesforce
- HubSpot
- Zoom (enhanced)
- Others as needed

**Flow**:
1. User clicks "Connect with {Provider}"
2. Redirect to provider OAuth page
3. User authorizes
4. Callback to edge function
5. Exchange code for tokens
6. Store encrypted tokens
7. Redirect back to integration page
8. Show success message

---

### Module 5: API Validation
**Location**: `supabase/functions/validate-api-key/`

**Extended Providers**:
- All 20+ providers
- Each with specific validation endpoint
- Meaningful error messages
- Rate limit handling

**Validation Response**:
```json
{
  "valid": true,
  "message": "Connection successful",
  "details": {
    "provider": "hubspot",
    "account": "Test Company",
    "permissions": ["contacts.read", "contacts.write"]
  }
}
```

---

### Module 6: Hooks & Utilities
**Location**: `src/hooks/`, `src/lib/`

**Hooks**:
- `useIntegrations.ts`: Main integration data hook
- `useOAuth.ts`: OAuth flow management
- `useIntegrationConfig.ts`: Config CRUD operations

**Utilities**:
- `integration-utils.ts`: Helper functions
- `integration-icons.ts`: Icon mapping
- `integration-encryption.ts`: Encryption helpers

---

## File Structure

```
sj-control-tower-framework/
├── supabase/
│   ├── migrations/
│   │   ├── 20260103_integration_hub_schema.sql (new)
│   │   ├── 20260103_seed_integration_providers.sql (new)
│   │   └── 20260103_migrate_existing_integrations.sql (new)
│   └── functions/
│       ├── oauth-callback/ (new)
│       │   └── index.ts
│       ├── validate-api-key/ (modify)
│       │   └── index.ts
│       └── _shared/
│           ├── integration-logger.ts (new)
│           └── oauth-configs.ts (new)
├── src/
│   ├── pages/
│   │   └── admin/
│   │       ├── Integrations.tsx (rewrite)
│   │       ├── IntegrationDetail.tsx (new)
│   │       ├── IntegrationUsageAnalytics.tsx (new)
│   │       ├── AIModelManagement.tsx (enhance)
│   │       └── integrations/ (new directory)
│   │           ├── GoogleWorkspaceIntegration.tsx
│   │           ├── Microsoft365Integration.tsx
│   │           ├── ZoomIntegration.tsx
│   │           ├── SalesforceIntegration.tsx
│   │           └── HubSpotIntegration.tsx
│   ├── components/
│   │   └── integrations/ (new directory)
│   │       ├── ProviderCard.tsx
│   │       ├── ProviderConfigForm.tsx
│   │       ├── OAuthButton.tsx
│   │       ├── ServiceToggle.tsx
│   │       ├── ConnectionStatus.tsx
│   │       └── TestConnectionButton.tsx
│   ├── hooks/
│   │   ├── useIntegrations.ts (new)
│   │   ├── useOAuth.ts (new)
│   │   └── useIntegrationConfig.ts (new)
│   ├── lib/
│   │   ├── integration-utils.ts (new)
│   │   ├── integration-icons.ts (new)
│   │   └── integration-encryption.ts (new)
│   └── App.tsx (modify)
└── docs/
    └── integrations/
        ├── SETUP_GUIDE.md (new)
        ├── ADMIN_GUIDE.md (new)
        └── providers/ (new directory)
            ├── zoom.md
            ├── google-workspace.md
            ├── microsoft-365.md
            └── ... (one per provider)
```

---

## Testing & Validation

### Connection Testing Matrix

| Provider | Auth Type | Test Endpoint | Expected Result |
|----------|-----------|---------------|-----------------|
| OpenAI | API Key | `/v1/models` | 200 OK, models list |
| Anthropic | API Key | `/v1/messages` (test) | 200 OK |
| Google Gemini | API Key | `/v1/models` | 200 OK |
| Perplexity | API Key | `/chat/completions` (test) | 200 OK |
| Zoom | OAuth | `/v2/users/me` | 200 OK, user info |
| MS Teams | OAuth | `/v1.0/me` | 200 OK, user info |
| Google Meet | OAuth | `/calendar/v3/users/me/calendarList` | 200 OK |
| Webex | OAuth | `/v1/people/me` | 200 OK |
| GoTo | OAuth | `/admin/rest/v1/me` | 200 OK |
| Salesforce | OAuth | `/services/data/` | 200 OK, API versions |
| HubSpot | OAuth | `/crm/v3/objects/contacts?limit=1` | 200 OK |
| Pipedrive | API Token | `/v1/users/me` | 200 OK |
| Zoho | OAuth | `/crm/v8/users?type=CurrentUser` | 200 OK |
| Jira | OAuth/Token | `/rest/api/3/myself` | 200 OK |
| Asana | PAT/OAuth | `/users/me` | 200 OK |
| Monday | Token | GraphQL `/v2` | 200 OK |
| Trello | Key+Token | `/1/members/me` | 200 OK |
| SendGrid | API Key | `/v3/user/account` | 200 OK |
| Mailgun | API Key | `/v3/domains` | 200 OK |
| Postmark | Server Token | `/servers` | 200 OK |
| Amazon SES | IAM | `VerifyEmailIdentity` | Success response |

---

### Feature Validation Checklist

**Integration Hub Page**:
- [ ] Categories display correctly
- [ ] Providers load within categories
- [ ] Search filters providers
- [ ] Status badges show correct state
- [ ] Navigation to detail page works
- [ ] Coming Soon badge displays
- [ ] Provider count per category accurate

**Provider Detail Page**:
- [ ] Provider info loads
- [ ] Fields render dynamically
- [ ] API Key auth works
- [ ] OAuth button appears for OAuth providers
- [ ] Test connection works
- [ ] Configuration saves
- [ ] Services toggle on/off
- [ ] Default service selection works
- [ ] Feature badges display

**OAuth Flow**:
- [ ] OAuth popup/redirect works
- [ ] Authorization succeeds
- [ ] Tokens stored securely
- [ ] Callback redirects correctly
- [ ] Token refresh works
- [ ] Error handling functional

**API Validation**:
- [ ] Valid credentials accepted
- [ ] Invalid credentials rejected
- [ ] Error messages clear
- [ ] Rate limits handled
- [ ] Network errors caught
- [ ] Timeout handling works

**Analytics**:
- [ ] Usage logs created
- [ ] Charts display data
- [ ] Cost tracking accurate
- [ ] Filters work (date, provider)
- [ ] Export functionality

---

## Migration Strategy

### From Old System to New System

**Step 1: Database Migration**
1. Run schema migration
2. Seed categories and providers
3. Run data migration script to move:
   - AI providers → integration_providers
   - AI models → integration_services
   - app_config integrations → organization_integrations

**Step 2: Parallel Operation**
1. Deploy new integration pages
2. Keep old AI Model Management temporarily
3. Redirect old /admin/integrations to new hub
4. Test thoroughly

**Step 3: Cutover**
1. Update all references to old tables
2. Deprecate old AI-specific tables (or keep for backward compatibility)
3. Update edge functions to use new tables
4. Remove old integration UI

**Step 4: Cleanup**
1. Remove deprecated code
2. Update documentation
3. Train admins on new system

---

## Security Considerations

### Data Encryption
- Use Supabase's built-in encryption for sensitive columns
- Consider pgcrypto for additional field-level encryption
- Never log sensitive data (API keys, tokens)

### OAuth Security
- Implement PKCE for OAuth flows
- Use state parameter for CSRF protection
- Validate redirect URIs
- Secure token storage
- Implement token rotation

### API Key Security
- Mark sensitive fields in `integration_fields.is_sensitive`
- Use password-type inputs
- Never expose keys in frontend
- Store in backend only
- Implement key rotation recommendations

### RLS Policies
- Strict admin-only access to integrations
- Users can only view their own usage logs
- Admins can view all logs
- Service accounts for background jobs

---

## Cost Tracking

### Cost Model Structure

**In `integration_services.cost_model` JSONB**:

```json
{
  "type": "per_api_call",
  "rate": 0.001,
  "currency": "USD"
}
```

Or:

```json
{
  "type": "tiered",
  "tiers": [
    { "up_to": 1000, "rate": 0.001 },
    { "up_to": 10000, "rate": 0.0008 },
    { "above": 10000, "rate": 0.0005 }
  ]
}
```

### Cost Tracking Features
- Real-time cost estimation
- Monthly cost reports
- Cost alerts (exceed threshold)
- Cost breakdown by provider
- Cost breakdown by user
- Budget management

---

## Performance Optimization

### Caching Strategy
- Cache provider and category lists (10-minute TTL)
- Cache integration configs (5-minute TTL)
- Invalidate cache on config updates
- Use React Query for client-side caching

### Database Optimization
- Index frequently queried columns
- Use JSONB indexes for config queries
- Implement pagination for usage logs
- Archive old logs (>90 days)

### API Optimization
- Batch API validation requests
- Implement retry logic with exponential backoff
- Rate limit protection
- Connection pooling

---

## Future Enhancements

### Phase 11: Additional Providers (Future)
- **Payment Gateways**: Stripe, PayPal, Square
- **Analytics**: Google Analytics, Mixpanel, Segment
- **Communication**: Twilio, Slack, Discord
- **Storage**: AWS S3, Azure Blob, Cloudflare R2
- **Database**: MongoDB Atlas, PlanetScale, Neon

### Phase 12: Advanced Features (Future)
- **Integration Marketplace**: Browse and install integrations
- **Custom Integrations**: User-defined integrations with webhooks
- **Integration Templates**: Pre-built workflows
- **Integration Testing**: Sandbox mode for testing
- **Integration Monitoring**: Health checks, uptime monitoring
- **Integration Versioning**: Support multiple API versions

### Phase 13: Automation (Future)
- **Auto-sync**: Background sync jobs
- **Webhooks**: Real-time event processing
- **Workflows**: Connect multiple integrations (Zapier-like)
- **Triggers**: Event-based automation

---

## Summary

This comprehensive plan creates a scalable, enterprise-ready integration hub that:

✅ **Unifies all integrations** under a single architecture
✅ **Supports 20+ providers** across 6 categories
✅ **Incorporates best practices** from AI Model Management
✅ **Provides dynamic configuration** for any provider
✅ **Handles multiple auth types** (API Key, OAuth, Basic, Service Account)
✅ **Tracks usage and costs** for analytics
✅ **Scales for future integrations** with minimal code changes
✅ **Maintains security** with RLS and encryption
✅ **Offers great UX** with intuitive UI patterns

**Implementation Timeline**: 5 weeks for full rollout
**Priority**: Start with Phases 1-4 (Weeks 1-2) for MVP functionality

---

## API Documentation Sources

### Meeting Providers
- [Microsoft Graph Teams API](https://learn.microsoft.com/en-us/graph/api/resources/teams-api-overview)
- [Google Meet API](https://developers.google.com/workspace/meet/api/guides/overview)
- [Cisco Webex API](https://developer.webex.com/docs/api/guides/integrations-and-authorization)
- [GoTo Developer Portal](https://developer.goto.com/)

### CRM Systems
- [Salesforce REST API](https://www.integrate.io/blog/salesforce-rest-api-integration/)
- [HubSpot API](https://developers.hubspot.com/docs/api-reference/overview)
- [Pipedrive API](https://developers.pipedrive.com/docs/api/v1)
- [Zoho CRM API](https://www.zoho.com/crm/developer/docs/api/v8/oauth-overview.html)

### Project Management
- [Jira Cloud REST API](https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/)
- [Asana API](https://developers.asana.com/docs/authentication)
- [Monday.com API](https://developer.monday.com/api-reference/)
- [Trello API](https://developer.atlassian.com/cloud/trello/guides/rest-api/authorization/)

### Email Providers
- [Mailgun API](https://documentation.mailgun.com/docs/mailgun/api-reference/mg-auth)
- [Postmark API](https://postmarkapp.com/developer/api/overview)
- [Amazon SES API](https://docs.aws.amazon.com/ses/latest/dg/send-email-api.html)

---

**End of Implementation Plan**
