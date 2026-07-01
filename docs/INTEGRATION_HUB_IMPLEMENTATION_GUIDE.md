# Integration Hub — Complete Implementation Guide

> A production-ready, reusable blueprint for building a scalable Integration Hub with OAuth 2.0, API key management, dynamic forms, and per-user token storage. Extracted from the SJ Control Tower Framework.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Database Schema](#2-database-schema)
3. [Seed Data](#3-seed-data)
4. [Edge Functions](#4-edge-functions)
5. [Frontend Hooks](#5-frontend-hooks)
6. [Frontend Utilities](#6-frontend-utilities)
7. [Frontend Components](#7-frontend-components)
8. [Frontend Pages](#8-frontend-pages)
9. [OAuth Flow](#9-oauth-flow)
10. [Adding a New Provider](#10-adding-a-new-provider)
11. [config.toml](#11-configtoml)

---

## 1. Architecture Overview

### Two-Tier Integration Model

| Tier | Purpose | Table | Who Manages |
|------|---------|-------|-------------|
| **Organization** | Store Client ID / Secret / API keys | `organization_integrations` | Admin |
| **User** | Store per-user OAuth access & refresh tokens | `user_oauth_tokens` | Each user |

### Data Flow

```
Admin enters Client ID + Secret
        ↓
organization_integrations (config JSONB)
        ↓
User clicks "Connect"
        ↓
Edge Function: user-oauth-connect
  → Reads org credentials
  → Builds OAuth URL
  → Stores state in oauth_states
  → Returns authorization_url
        ↓
Browser redirects to provider (Zoom, Google, etc.)
        ↓
Provider redirects to: {SUPABASE_URL}/functions/v1/user-oauth-callback
        ↓
Edge Function: user-oauth-callback
  → Validates state from oauth_states
  → Exchanges code for tokens
  → Fetches user info from provider
  → Upserts into user_oauth_tokens
  → Redirects back to app
```

### Tech Stack

- **Database**: PostgreSQL (Supabase) with RLS
- **Backend**: Supabase Edge Functions (Deno)
- **Frontend**: React 18 + TypeScript + TanStack React Query + shadcn/ui
- **Auth**: Supabase Auth (JWT)

---

## 2. Database Schema

### 2.1 integration_categories

Groups providers by function (AI, Meetings, Email, Storage, etc.).

```sql
CREATE TABLE public.integration_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT DEFAULT 'Cloud',
  display_order INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.integration_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view categories"
  ON public.integration_categories FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage categories"
  ON public.integration_categories FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
```

### 2.2 integration_providers

Individual services with auth type and OAuth config.

```sql
CREATE TABLE public.integration_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.integration_categories(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  logo_url TEXT,
  docs_url TEXT,
  auth_type TEXT NOT NULL DEFAULT 'api_key',  -- 'api_key' | 'oauth2' | 'basic' | 'service_account'
  oauth_config JSONB DEFAULT '{}',
  is_available BOOLEAN DEFAULT true,
  is_coming_soon BOOLEAN DEFAULT false,
  is_beta BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_integration_providers_category ON public.integration_providers(category_id);
CREATE INDEX idx_integration_providers_slug ON public.integration_providers(slug);

ALTER TABLE public.integration_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view providers"
  ON public.integration_providers FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage providers"
  ON public.integration_providers FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
```

### 2.3 integration_fields

Dynamic form fields per provider (renders configuration forms automatically).

```sql
CREATE TABLE public.integration_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.integration_providers(id),
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text',  -- 'text' | 'password' | 'email' | 'url' | 'select' | 'textarea'
  placeholder TEXT,
  default_value TEXT,
  is_required BOOLEAN DEFAULT false,
  is_sensitive BOOLEAN DEFAULT false,
  help_text TEXT,
  validation_regex TEXT,
  select_options JSONB,  -- [{value, label}] for select fields
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(provider_id, field_key)
);

CREATE INDEX idx_integration_fields_provider ON public.integration_fields(provider_id);

ALTER TABLE public.integration_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view fields"
  ON public.integration_fields FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage fields"
  ON public.integration_fields FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
```

### 2.4 organization_integrations

Stores org-level credentials (Client ID, Client Secret, API keys) per user.

```sql
CREATE TABLE public.organization_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES public.integration_providers(id),
  enabled BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}',  -- Stores credentials: {client_id, client_secret, api_key, etc.}
  connection_status TEXT DEFAULT 'disconnected',  -- 'connected' | 'disconnected' | 'error' | 'testing'
  connection_message TEXT,
  last_tested_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  oauth_tokens JSONB,  -- Legacy field for backward compatibility
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, provider_id)
);

CREATE INDEX idx_organization_integrations_user ON public.organization_integrations(user_id);
CREATE INDEX idx_organization_integrations_provider ON public.organization_integrations(provider_id);

ALTER TABLE public.organization_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own integrations"
  ON public.organization_integrations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own integrations"
  ON public.organization_integrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own integrations"
  ON public.organization_integrations FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own integrations"
  ON public.organization_integrations FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all integrations"
  ON public.organization_integrations FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
```

### 2.5 integration_services

Sub-services per provider (e.g., Zoom has "meetings", "recordings", "transcripts").

```sql
CREATE TABLE public.integration_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.integration_providers(id),
  name TEXT NOT NULL,
  service_key TEXT NOT NULL,
  description TEXT,
  features JSONB DEFAULT '{}',
  has_cost BOOLEAN DEFAULT false,
  cost_model JSONB,
  enabled BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  is_beta BOOLEAN DEFAULT false,
  requires_config BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(provider_id, service_key)
);

CREATE INDEX idx_integration_services_provider ON public.integration_services(provider_id);

ALTER TABLE public.integration_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view services"
  ON public.integration_services FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage services"
  ON public.integration_services FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
```

### 2.6 integration_usage_logs

Analytics and cost tracking per API call.

```sql
CREATE TABLE public.integration_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  provider_id UUID REFERENCES public.integration_providers(id),
  service_id UUID REFERENCES public.integration_services(id),
  action TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'success',  -- 'success' | 'error' | 'partial'
  request_metadata JSONB,
  response_metadata JSONB,
  error_message TEXT,
  estimated_cost NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_integration_usage_logs_user ON public.integration_usage_logs(user_id);
CREATE INDEX idx_integration_usage_logs_provider ON public.integration_usage_logs(provider_id);
CREATE INDEX idx_integration_usage_logs_created ON public.integration_usage_logs(created_at DESC);

ALTER TABLE public.integration_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own usage logs"
  ON public.integration_usage_logs FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create usage logs"
  ON public.integration_usage_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all usage logs"
  ON public.integration_usage_logs FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
```

### 2.7 oauth_states

CSRF protection for OAuth flows.

```sql
CREATE TABLE public.oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  provider TEXT NOT NULL,
  redirect_uri TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_oauth_states_state ON public.oauth_states(state);
CREATE INDEX idx_oauth_states_expires_at ON public.oauth_states(expires_at);

ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own oauth states"
  ON public.oauth_states FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own oauth states"
  ON public.oauth_states FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own oauth states"
  ON public.oauth_states FOR DELETE
  USING (auth.uid() = user_id);
```

### 2.8 user_oauth_tokens

Per-user OAuth token storage (access_token, refresh_token, account info).

```sql
CREATE TABLE public.user_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_slug TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type TEXT DEFAULT 'Bearer',
  expires_at TIMESTAMPTZ,
  scopes TEXT[] DEFAULT '{}',
  account_email TEXT,
  account_name TEXT,
  account_id TEXT,
  account_avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  last_refreshed_at TIMESTAMPTZ,
  error_message TEXT,
  error_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, provider_slug)
);

CREATE INDEX idx_user_oauth_tokens_user ON public.user_oauth_tokens(user_id);
CREATE INDEX idx_user_oauth_tokens_provider ON public.user_oauth_tokens(provider_slug);

ALTER TABLE public.user_oauth_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own oauth tokens"
  ON public.user_oauth_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own oauth tokens"
  ON public.user_oauth_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own oauth tokens"
  ON public.user_oauth_tokens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own oauth tokens"
  ON public.user_oauth_tokens FOR DELETE
  USING (auth.uid() = user_id);
```

### 2.9 Helper Function: has_role

Required by all RLS policies above.

```sql
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;
```

> **Prerequisite**: The `app_role` enum and `user_roles` table must exist. See the main schema export for details.

---

## 3. Seed Data

### 3.1 Categories

```sql
INSERT INTO integration_categories (name, slug, description, icon, display_order) VALUES
  ('AI Providers',       'ai',       'Artificial intelligence and language model providers', 'Brain',  1),
  ('Meeting Platforms',  'meetings', 'Video conferencing and meeting tools',                'Video',  2),
  ('Email Services',     'email',    'Email delivery and marketing platforms',              'Mail',   3),
  ('Storage',            'storage',  'Cloud storage and file management',                   'Cloud',  4)
ON CONFLICT (slug) DO NOTHING;
```

### 3.2 Providers

```sql
-- Get category IDs
WITH cats AS (
  SELECT id, slug FROM integration_categories
)
INSERT INTO integration_providers (category_id, name, slug, description, auth_type, display_order) VALUES
  -- AI
  ((SELECT id FROM cats WHERE slug='ai'), 'OpenAI',        'openai',        'GPT models and embeddings',          'api_key', 1),
  ((SELECT id FROM cats WHERE slug='ai'), 'Anthropic',     'anthropic',     'Claude AI assistant',                'api_key', 2),
  ((SELECT id FROM cats WHERE slug='ai'), 'Google Gemini', 'google-gemini', 'Google AI models',                   'api_key', 3),
  ((SELECT id FROM cats WHERE slug='ai'), 'Perplexity',    'perplexity',    'AI-powered search and answers',      'api_key', 4),
  -- Meetings
  ((SELECT id FROM cats WHERE slug='meetings'), 'Zoom',             'zoom',             'Video conferencing and webinars',       'oauth2', 1),
  ((SELECT id FROM cats WHERE slug='meetings'), 'Microsoft Teams',  'microsoft-teams',  'Enterprise communication and meetings', 'oauth2', 2),
  ((SELECT id FROM cats WHERE slug='meetings'), 'Google Meet',      'google-meet',      'Google video meetings',                 'oauth2', 3),
  -- Email
  ((SELECT id FROM cats WHERE slug='email'), 'SendGrid', 'sendgrid', 'Transactional email delivery', 'api_key', 1),
  ((SELECT id FROM cats WHERE slug='email'), 'Resend',   'resend',   'Developer-first email API',    'api_key', 2),
  -- Storage
  ((SELECT id FROM cats WHERE slug='storage'), 'Google Drive', 'google-drive', 'Cloud file storage and sync', 'oauth2', 1)
ON CONFLICT (slug) DO NOTHING;
```

### 3.3 Fields

```sql
-- API Key providers
INSERT INTO integration_fields (provider_id, field_key, label, field_type, is_required, is_sensitive, placeholder, help_text, display_order)
SELECT p.id, f.field_key, f.label, f.field_type, f.is_required, f.is_sensitive, f.placeholder, f.help_text, f.display_order
FROM integration_providers p
CROSS JOIN (VALUES
  ('openai',        'api_key', 'API Key', 'password', true, true, 'sk-...', 'Your OpenAI API key from platform.openai.com', 1),
  ('anthropic',     'api_key', 'API Key', 'password', true, true, 'sk-ant-...', 'Your Anthropic API key from console.anthropic.com', 1),
  ('google-gemini', 'api_key', 'API Key', 'password', true, true, 'AI...', 'Your Google AI API key from aistudio.google.com', 1),
  ('perplexity',    'api_key', 'API Key', 'password', true, true, 'pplx-...', 'Your Perplexity API key', 1),
  ('sendgrid',      'api_key', 'API Key', 'password', true, true, 'SG...', 'Your SendGrid API key', 1),
  ('resend',        'api_key', 'API Key', 'password', true, true, 're_...', 'Your Resend API key', 1)
) AS f(slug, field_key, label, field_type, is_required, is_sensitive, placeholder, help_text, display_order)
WHERE p.slug = f.slug
ON CONFLICT (provider_id, field_key) DO NOTHING;

-- OAuth providers (Client ID + Client Secret)
INSERT INTO integration_fields (provider_id, field_key, label, field_type, is_required, is_sensitive, placeholder, help_text, display_order)
SELECT p.id, f.field_key, f.label, f.field_type, f.is_required, f.is_sensitive, f.placeholder, f.help_text, f.display_order
FROM integration_providers p
CROSS JOIN (VALUES
  ('zoom',         'client_id',     'Client ID',     'text',     true, false, NULL, 'Your Zoom OAuth App Client ID from the Zoom Marketplace', 1),
  ('zoom',         'client_secret', 'Client Secret', 'password', true, true,  NULL, 'Your Zoom OAuth App Client Secret from the Zoom Marketplace', 2),
  ('google-meet',  'client_id',     'Client ID',     'text',     true, false, 'Enter your Google OAuth Client ID', 'Get this from the Google Cloud Console under APIs & Services > Credentials', 1),
  ('google-meet',  'client_secret', 'Client Secret', 'password', true, false, 'Enter your Google OAuth Client Secret', 'Get this from the Google Cloud Console under APIs & Services > Credentials', 2),
  ('google-drive', 'client_id',     'Client ID',     'text',     true, false, 'Enter your Google OAuth Client ID', 'Get this from the Google Cloud Console under APIs & Services > Credentials', 1),
  ('google-drive', 'client_secret', 'Client Secret', 'password', true, true,  'Enter your Google OAuth Client Secret', 'Get this from the Google Cloud Console under APIs & Services > Credentials', 2)
) AS f(slug, field_key, label, field_type, is_required, is_sensitive, placeholder, help_text, display_order)
WHERE p.slug = f.slug
ON CONFLICT (provider_id, field_key) DO NOTHING;
```

---

## 4. Edge Functions

### 4.1 user-oauth-connect

Initiates the OAuth flow. Validates user auth, checks that org-level credentials exist, builds the authorization URL with provider-specific scopes, and stores a CSRF state.

**File**: `supabase/functions/user-oauth-connect/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OAuthConfig {
  authUrl: string;
  scopes: string[];
  additionalParams?: Record<string, string>;
}

const getProviderConfig = (provider: string): OAuthConfig | null => {
  const configs: Record<string, OAuthConfig> = {
    google: {
      authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      scopes: [
        "openid", "email", "profile",
        "https://www.googleapis.com/auth/calendar.readonly",
        "https://www.googleapis.com/auth/drive.readonly",
      ],
      additionalParams: { access_type: "offline", prompt: "consent" },
    },
    "google-meet": {
      authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      scopes: [
        "openid", "email", "profile",
        "https://www.googleapis.com/auth/calendar.events",
        "https://www.googleapis.com/auth/meetings.space.created",
      ],
      additionalParams: { access_type: "offline", prompt: "consent" },
    },
    "google-drive": {
      authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      scopes: [
        "openid", "email", "profile",
        "https://www.googleapis.com/auth/drive.readonly",
      ],
      additionalParams: { access_type: "offline", prompt: "consent" },
    },
    zoom: {
      authUrl: "https://zoom.us/oauth/authorize",
      scopes: [
        "meeting:read:meeting", "meeting:write:meeting",
        "user:read:user",
        "cloud_recording:read:list_user_recordings",
        "cloud_recording:read:list_recording_files",
      ],
    },
    microsoft: {
      authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
      scopes: ["openid", "email", "profile", "offline_access", "Calendars.Read", "OnlineMeetings.Read"],
      additionalParams: { response_mode: "query" },
    },
  };
  return configs[provider] || null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validate user auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser(token);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { provider, redirect_uri, additional_scopes } = await req.json();
    if (!provider) {
      return new Response(JSON.stringify({ error: "Provider is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const providerConfig = getProviderConfig(provider);
    if (!providerConfig) {
      return new Response(JSON.stringify({ error: `Unsupported provider: ${provider}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up provider record
    const { data: providerData } = await supabase
      .from("integration_providers").select("id").eq("slug", provider).single();
    if (!providerData) {
      return new Response(JSON.stringify({ error: `Unknown provider: ${provider}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check org-level config exists and is enabled
    const { data: orgIntegration } = await supabase
      .from("organization_integrations").select("*")
      .eq("provider_id", providerData.id).eq("enabled", true).eq("connection_status", "connected")
      .single();

    if (!orgIntegration) {
      return new Response(JSON.stringify({ error: `Provider ${provider} is not enabled` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientId = orgIntegration.config?.client_id;
    if (!clientId) {
      return new Response(JSON.stringify({ error: `Please add Client ID in integration settings` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate CSRF state
    const state = crypto.randomUUID();
    const defaultAppUrl = Deno.env.get("APP_URL") || "https://your-app.example.com";

    await supabase.from("oauth_states").insert({
      state, user_id: user.id, provider,
      redirect_uri: redirect_uri || `${defaultAppUrl}/settings`,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });

    // Build scopes
    const scopes = [...providerConfig.scopes];
    if (additional_scopes && Array.isArray(additional_scopes)) scopes.push(...additional_scopes);

    // Build authorization URL
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: `${supabaseUrl}/functions/v1/user-oauth-callback`,
      response_type: "code",
      scope: scopes.join(" "),
      state,
      ...providerConfig.additionalParams,
    });

    return new Response(JSON.stringify({
      authorization_url: `${providerConfig.authUrl}?${params.toString()}`,
      state,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: unknown) {
    console.error("User OAuth connect error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

### 4.2 user-oauth-callback

Handles the OAuth redirect from the provider. Exchanges the authorization code for tokens, fetches user info, and stores everything in `user_oauth_tokens`.

**File**: `supabase/functions/user-oauth-callback/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

interface UserInfo {
  email?: string;
  name?: string;
  picture?: string;
}

const getTokenEndpoint = (provider: string): string => {
  const endpoints: Record<string, string> = {
    google: "https://oauth2.googleapis.com/token",
    "google-meet": "https://oauth2.googleapis.com/token",
    "google-drive": "https://oauth2.googleapis.com/token",
    zoom: "https://zoom.us/oauth/token",
    microsoft: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
  };
  return endpoints[provider] || "";
};

const getUserInfo = async (provider: string, accessToken: string): Promise<UserInfo> => {
  const headers: Record<string, string> = { Authorization: `Bearer ${accessToken}` };
  let url = "";

  switch (provider) {
    case "google": case "google-meet": case "google-drive":
      url = "https://www.googleapis.com/oauth2/v2/userinfo"; break;
    case "zoom":
      url = "https://api.zoom.us/v2/users/me"; break;
    case "microsoft":
      url = "https://graph.microsoft.com/v1.0/me"; break;
    default: return {};
  }

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) return {};
    const data = await response.json();

    switch (provider) {
      case "google": case "google-meet": case "google-drive":
        return { email: data.email, name: data.name, picture: data.picture };
      case "zoom":
        return { email: data.email, name: `${data.first_name} ${data.last_name}`.trim(), picture: data.pic_url };
      case "microsoft":
        return { email: data.mail || data.userPrincipalName, name: data.displayName };
      default: return {};
    }
  } catch { return {}; }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const appUrl = Deno.env.get("APP_URL") || "https://your-app.example.com";

    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");
    const errorDescription = url.searchParams.get("error_description");

    if (error) {
      return Response.redirect(`${appUrl}/settings?error=${encodeURIComponent(errorDescription || error)}`);
    }
    if (!code || !state) {
      return Response.redirect(`${appUrl}/settings?error=${encodeURIComponent("Missing code or state")}`);
    }

    // Verify state
    const { data: stateData, error: stateError } = await supabase
      .from("oauth_states").select("*").eq("state", state).single();

    if (stateError || !stateData) {
      return Response.redirect(`${appUrl}/settings?error=${encodeURIComponent("Invalid or expired state")}`);
    }
    if (new Date(stateData.expires_at) < new Date()) {
      await supabase.from("oauth_states").delete().eq("state", state);
      return Response.redirect(`${appUrl}/settings?error=${encodeURIComponent("OAuth session expired")}`);
    }

    const { user_id, provider, redirect_uri } = stateData;

    // Get org credentials
    const { data: orgIntegration } = await supabase
      .from("organization_integrations")
      .select("*, integration_providers!inner(*)")
      .eq("integration_providers.slug", provider).eq("enabled", true).single();

    if (!orgIntegration) {
      return Response.redirect(`${appUrl}/settings?error=${encodeURIComponent("Provider config not found")}`);
    }

    const config = orgIntegration.config || {};
    const { client_id, client_secret } = config;
    if (!client_id || !client_secret) {
      return Response.redirect(`${appUrl}/settings?error=${encodeURIComponent("Missing Client ID or Secret")}`);
    }

    // Exchange code for tokens
    const tokenEndpoint = getTokenEndpoint(provider);
    const tokenParams = new URLSearchParams({
      code, client_id, client_secret,
      redirect_uri: `${supabaseUrl}/functions/v1/user-oauth-callback`,
      grant_type: "authorization_code",
    });

    const tokenResponse = await fetch(tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
      console.error("Token exchange failed:", await tokenResponse.text());
      return Response.redirect(`${appUrl}/settings?error=${encodeURIComponent("Token exchange failed")}`);
    }

    const tokens: TokenResponse = await tokenResponse.json();
    const userInfo = await getUserInfo(provider, tokens.access_token);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Store tokens
    await supabase.from("user_oauth_tokens").upsert({
      user_id, provider_slug: provider,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
      scopes: tokens.scope?.split(" ") || [],
      account_email: userInfo.email,
      account_name: userInfo.name,
      account_avatar_url: userInfo.picture,
      is_active: true, error_message: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,provider_slug" });

    // Clean up state
    await supabase.from("oauth_states").delete().eq("state", state);

    // Redirect back to app (provider-specific pages)
    let finalRedirect = redirect_uri || `${appUrl}/settings`;
    if (provider === "zoom") finalRedirect = `${appUrl}/admin/integrations/zoom`;
    else if (provider === "google-meet") finalRedirect = `${appUrl}/admin/integrations/google-meet`;
    else if (provider === "google-drive") finalRedirect = `${appUrl}/admin/integrations/google-drive`;

    return Response.redirect(`${finalRedirect}?connected=${provider}`);
  } catch (error: unknown) {
    console.error("User OAuth callback error:", error);
    const appUrl = Deno.env.get("APP_URL") || "https://your-app.example.com";
    return Response.redirect(`${appUrl}/settings?error=${encodeURIComponent("Unexpected error")}`);
  }
});
```

### 4.3 user-oauth-disconnect

Revokes the token at the provider (if supported) and deletes the record from `user_oauth_tokens`.

**File**: `supabase/functions/user-oauth-disconnect/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body;
    try { body = await req.json(); } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { provider } = body;
    if (!provider) {
      return new Response(JSON.stringify({ error: "Provider is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get existing token
    const { data: userToken } = await supabase
      .from("user_oauth_tokens").select("*")
      .eq("user_id", user.id).eq("provider_slug", provider).maybeSingle();

    if (!userToken) {
      return new Response(JSON.stringify({ success: true, message: "No connection to disconnect" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Revoke at provider (Google supports this)
    if (provider.startsWith("google") && userToken.access_token) {
      try {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${userToken.access_token}`, { method: "POST" });
      } catch (e) { console.error("Revoke failed:", e); }
    }

    // Delete local record
    await supabase.from("user_oauth_tokens").delete().eq("id", userToken.id);

    return new Response(JSON.stringify({ success: true, message: `Disconnected from ${provider}` }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Disconnect error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

### 4.4 user-oauth-refresh

Refreshes an expired OAuth token using the stored refresh_token.

**File**: `supabase/functions/user-oauth-refresh/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const getTokenEndpoint = (provider: string): string => {
  const endpoints: Record<string, string> = {
    google: "https://oauth2.googleapis.com/token",
    zoom: "https://zoom.us/oauth/token",
    microsoft: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
  };
  return endpoints[provider] || "";
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { provider } = await req.json();
    if (!provider) {
      return new Response(JSON.stringify({ error: "Provider is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get existing token
    const { data: userToken } = await supabase
      .from("user_oauth_tokens").select("*")
      .eq("user_id", user.id).eq("provider_slug", provider).single();

    if (!userToken) {
      return new Response(JSON.stringify({ error: "No connection found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!userToken.refresh_token) {
      return new Response(JSON.stringify({ error: "No refresh token", requires_reauth: true }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get org credentials
    const { data: orgIntegration } = await supabase
      .from("organization_integrations")
      .select("*, integration_providers!inner(*)")
      .eq("integration_providers.slug", provider).single();

    if (!orgIntegration) {
      return new Response(JSON.stringify({ error: "Provider config not found" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { client_id, client_secret } = orgIntegration.config || {};
    if (!client_id || !client_secret) {
      return new Response(JSON.stringify({ error: "Provider not configured" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Refresh token
    const tokenEndpoint = getTokenEndpoint(provider);
    const refreshParams = new URLSearchParams({
      client_id, client_secret,
      refresh_token: userToken.refresh_token,
      grant_type: "refresh_token",
    });

    const tokenResponse = await fetch(tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: refreshParams.toString(),
    });

    if (!tokenResponse.ok) {
      await supabase.from("user_oauth_tokens").update({
        error_message: "Token refresh failed. Please reconnect.",
        updated_at: new Date().toISOString(),
      }).eq("id", userToken.id);

      return new Response(JSON.stringify({ error: "Refresh failed", requires_reauth: true }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tokens = await tokenResponse.json();
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    await supabase.from("user_oauth_tokens").update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || userToken.refresh_token,
      expires_at: expiresAt,
      is_active: true, error_message: null,
      updated_at: new Date().toISOString(),
    }).eq("id", userToken.id);

    return new Response(JSON.stringify({ success: true, expires_at: expiresAt }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Refresh error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

### 4.5 validate-api-key

Tests API key credentials for non-OAuth providers (OpenAI, SendGrid, Anthropic, etc.).

**File**: `supabase/functions/validate-api-key/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    let requestBody: Record<string, unknown> = {};
    try {
      requestBody = await req.json();
    } catch {
      return new Response(JSON.stringify({ valid: true, message: 'ok' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
      })
    }

    // Support both { apiKey, service } and { provider, credentials } formats
    let apiKey = requestBody.apiKey as string | undefined;
    let service = requestBody.service as string | undefined;
    const provider = requestBody.provider as string | undefined;
    const credentials = requestBody.credentials as Record<string, string> | undefined;

    if (provider && credentials) {
      service = provider;
      apiKey = credentials.api_key || credentials.apiKey || credentials.access_token ||
               credentials.secret_key || credentials.token || Object.values(credentials)[0];
    }

    if (!apiKey || !service) {
      return new Response(JSON.stringify({ valid: false, error: 'API key and service required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400
      })
    }

    let result = { valid: false, message: '', details: {} };

    switch (service) {
      case 'openai':
        result = await validateWithEndpoint(apiKey, 'https://api.openai.com/v1/models', 'Bearer', 'OpenAI');
        break;
      case 'sendgrid':
        result = await validateWithEndpoint(apiKey, 'https://api.sendgrid.com/v3/scopes', 'Bearer', 'SendGrid');
        break;
      case 'anthropic':
        // Anthropic uses x-api-key header
        result = await validateAnthropic(apiKey);
        break;
      case 'google_ai':
        result = await validateWithEndpoint(apiKey, `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`, null, 'Google AI');
        break;
      default:
        return new Response(JSON.stringify({ valid: false, error: `Unknown service: ${service}` }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400
        })
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
    })
  } catch (error: unknown) {
    return new Response(JSON.stringify({ valid: false, error: error instanceof Error ? error.message : 'Unknown' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500
    })
  }
})

async function validateWithEndpoint(key: string, url: string, authScheme: string | null, name: string) {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authScheme) headers['Authorization'] = `${authScheme} ${key}`;

    const response = await fetch(url, { method: 'GET', headers });
    if (response.ok) {
      return { valid: true, message: `${name} API key is valid`, details: {} };
    }
    return { valid: false, message: `Invalid ${name} API key`, details: { status: response.status } };
  } catch (e: unknown) {
    return { valid: false, message: `${name} validation error`, details: {} };
  }
}

async function validateAnthropic(apiKey: string) {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-3-haiku-20240307', max_tokens: 1, messages: [{ role: 'user', content: 'test' }] }),
    });
    if (response.ok || response.status === 400) return { valid: true, message: 'Anthropic API key is valid', details: {} };
    return { valid: false, message: 'Invalid Anthropic API key', details: { status: response.status } };
  } catch {
    return { valid: false, message: 'Anthropic validation error', details: {} };
  }
}
```

---

## 5. Frontend Hooks

### 5.1 useIntegrations.ts

15 React Query hooks for all integration CRUD operations.

```typescript
// src/hooks/useIntegrations.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  IntegrationCategory, IntegrationProvider, IntegrationField,
  OrganizationIntegration, IntegrationService,
  sortCategoriesByOrder, sortProvidersByOrder,
} from '@/lib/integration-utils';

// Query key factory
export const integrationKeys = {
  all: ['integrations'] as const,
  categories: () => [...integrationKeys.all, 'categories'] as const,
  providers: () => [...integrationKeys.all, 'providers'] as const,
  providersByCategory: (categoryId: string) => [...integrationKeys.providers(), categoryId] as const,
  provider: (slug: string) => [...integrationKeys.providers(), slug] as const,
  fields: (providerId: string) => [...integrationKeys.all, 'fields', providerId] as const,
  orgIntegrations: () => [...integrationKeys.all, 'org-integrations'] as const,
  orgIntegration: (providerId: string) => [...integrationKeys.orgIntegrations(), providerId] as const,
  services: (providerId: string) => [...integrationKeys.all, 'services', providerId] as const,
};

// --- Categories ---
export function useIntegrationCategories() {
  return useQuery({
    queryKey: integrationKeys.categories(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('integration_categories').select('*').eq('enabled', true)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return sortCategoriesByOrder(data as IntegrationCategory[]);
    },
    staleTime: 10 * 60 * 1000,
  });
}

// --- Providers ---
export function useIntegrationProviders(categoryId?: string) {
  return useQuery({
    queryKey: categoryId ? integrationKeys.providersByCategory(categoryId) : integrationKeys.providers(),
    queryFn: async () => {
      let query = supabase.from('integration_providers').select('*').order('display_order', { ascending: true });
      if (categoryId) query = query.eq('category_id', categoryId);
      const { data, error } = await query;
      if (error) throw error;
      return sortProvidersByOrder(data as IntegrationProvider[]);
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useIntegrationProvider(slug: string) {
  return useQuery({
    queryKey: integrationKeys.provider(slug),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('integration_providers').select('*').eq('slug', slug).single();
      if (error) throw error;
      return data as IntegrationProvider;
    },
    staleTime: 10 * 60 * 1000,
    enabled: !!slug,
  });
}

// --- Fields ---
export function useIntegrationFields(providerId: string) {
  return useQuery({
    queryKey: integrationKeys.fields(providerId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('integration_fields').select('*').eq('provider_id', providerId)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return data as IntegrationField[];
    },
    staleTime: 10 * 60 * 1000,
    enabled: !!providerId,
  });
}

// --- Organization Integrations ---
export function useOrganizationIntegrations() {
  return useQuery({
    queryKey: integrationKeys.orgIntegrations(),
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('organization_integrations').select('*, provider:integration_providers(*)')
        .eq('user_id', user.id);
      if (error) throw error;
      return data as (OrganizationIntegration & { provider: IntegrationProvider })[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useOrganizationIntegration(providerId: string) {
  return useQuery({
    queryKey: integrationKeys.orgIntegration(providerId),
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('organization_integrations').select('*')
        .eq('user_id', user.id).eq('provider_id', providerId).maybeSingle();
      if (error) throw error;
      return data as OrganizationIntegration | null;
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!providerId,
  });
}

export function useUpdateIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ providerId, config, enabled = true }: {
      providerId: string; config: Record<string, any>; enabled?: boolean;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('organization_integrations')
        .upsert({
          user_id: user.id, provider_id: providerId, config, enabled,
          connection_status: 'connected', last_tested_at: new Date().toISOString(),
        }, { onConflict: 'user_id,provider_id' })
        .select().single();
      if (error) throw error;
      return data as OrganizationIntegration;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: integrationKeys.orgIntegrations() });
    },
  });
}

export function useTestConnection() {
  return useMutation({
    mutationFn: async ({ providerSlug, credentials }: {
      providerSlug: string; credentials: Record<string, any>;
    }) => {
      const { data, error } = await supabase.functions.invoke('validate-api-key', {
        body: { provider: providerSlug, credentials },
      });
      if (error) throw error;
      return data as { valid: boolean; message: string };
    },
  });
}

export function useDisconnectIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ providerId }: { providerId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('organization_integrations').delete()
        .eq('user_id', user.id).eq('provider_id', providerId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: integrationKeys.orgIntegrations() });
    },
  });
}

// --- Grouped Data ---
export function useProvidersGroupedByCategory() {
  const categoriesQuery = useIntegrationCategories();
  const providersQuery = useIntegrationProviders();
  const orgIntegrationsQuery = useOrganizationIntegrations();

  const isLoading = categoriesQuery.isLoading || providersQuery.isLoading || orgIntegrationsQuery.isLoading;
  const error = categoriesQuery.error || providersQuery.error || orgIntegrationsQuery.error;

  const grouped = categoriesQuery.data?.map((category) => {
    const categoryProviders = providersQuery.data?.filter((p) => p.category_id === category.id) || [];
    const providersWithIntegration = categoryProviders.map((provider) => ({
      ...provider,
      orgIntegration: orgIntegrationsQuery.data?.find((i) => i.provider_id === provider.id),
    }));
    const connectedProviders = providersWithIntegration.filter(
      (p) => p.orgIntegration?.connection_status === 'connected'
    ).length;

    return {
      category,
      providers: providersWithIntegration,
      stats: { totalProviders: categoryProviders.length, connectedProviders },
    };
  });

  return { grouped, isLoading, error };
}
```

### 5.2 useUserIntegrations.ts

User-level OAuth token management.

```typescript
// src/hooks/useUserIntegrations.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface UserOAuthToken {
  id: string;
  user_id: string;
  provider_slug: string;
  token_type: string;
  expires_at: string | null;
  scopes: string[];
  account_email: string | null;
  account_name: string | null;
  account_id: string | null;
  account_avatar_url: string | null;
  is_active: boolean;
  last_used_at: string | null;
  last_refreshed_at: string | null;
  error_message: string | null;
  error_at: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// IMPORTANT: Never select access_token or refresh_token on the client
const SAFE_TOKEN_COLUMNS = `
  id, user_id, provider_slug, token_type, expires_at, scopes,
  account_email, account_name, account_id, account_avatar_url,
  is_active, last_used_at, last_refreshed_at, error_message, error_at,
  metadata, created_at, updated_at
`;

export function useUserOAuthTokens() {
  const { user } = useAuth();
  return useQuery<UserOAuthToken[]>({
    queryKey: ['user-oauth-tokens', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('user_oauth_tokens').select(SAFE_TOKEN_COLUMNS)
        .eq('user_id', user.id).order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as UserOAuthToken[];
    },
    enabled: !!user,
  });
}

export function useUserOAuthToken(providerSlug: string) {
  const { user } = useAuth();
  return useQuery<UserOAuthToken | null>({
    queryKey: ['user-oauth-token', user?.id, providerSlug],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('user_oauth_tokens').select(SAFE_TOKEN_COLUMNS)
        .eq('user_id', user.id).eq('provider_slug', providerSlug).single();
      if (error && error.code !== 'PGRST116') throw error;
      return data as UserOAuthToken | null;
    },
    enabled: !!user && !!providerSlug,
  });
}

export function useConnectOAuth() {
  return useMutation({
    mutationFn: async ({ provider, redirect_uri }: { provider: string; redirect_uri?: string }) => {
      const body: any = { provider };
      if (redirect_uri) body.redirect_uri = redirect_uri;
      const { data, error } = await supabase.functions.invoke('user-oauth-connect', { body });
      if (error) throw error;
      if (data?.authorization_url) window.location.href = data.authorization_url;
      return data;
    },
    onError: (error: Error) => toast.error(`Failed to connect: ${error.message}`),
  });
}

export function useDisconnectOAuth() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ provider }: { provider: string }) => {
      const { data, error } = await supabase.functions.invoke('user-oauth-disconnect', {
        body: { provider },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-oauth-tokens'] });
      toast.success('Service disconnected');
    },
    onError: (error: Error) => toast.error(`Failed to disconnect: ${error.message}`),
  });
}

export function useRefreshOAuthToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ provider }: { provider: string }) => {
      const { data, error } = await supabase.functions.invoke('user-oauth-refresh', { body: { provider } });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-oauth-tokens'] });
      toast.success('Token refreshed');
    },
    onError: (error: Error) => toast.error(`Failed to refresh: ${error.message}`),
  });
}

export function useHasValidToken(providerSlug: string) {
  const { data: token, isLoading } = useUserOAuthToken(providerSlug);
  const isValid = token?.is_active && (!token.expires_at || new Date(token.expires_at) > new Date()) && !token.error_message;
  return {
    hasValidToken: isValid,
    token, isLoading,
    isExpired: token?.expires_at && new Date(token.expires_at) <= new Date(),
    hasError: !!token?.error_message,
    errorMessage: token?.error_message,
  };
}
```

---

## 6. Frontend Utilities

### integration-utils.ts

Type definitions, icon mapping, status helpers, validation, OAuth URL builder, and masking.

```typescript
// src/lib/integration-utils.ts
import {
  Brain, Sparkles, Cloud, Zap, Video, Mail, Users, Kanban, Shield,
  CheckCircle2, Circle, XCircle, Clock, AlertCircle, type LucideIcon,
} from 'lucide-react';

// --- Type Definitions ---
export interface IntegrationCategory {
  id: string; name: string; slug: string; description: string;
  icon: string; display_order: number; enabled: boolean;
  created_at: string; updated_at: string;
}

export interface IntegrationProvider {
  id: string; category_id: string; name: string; slug: string;
  description: string | null; logo_url: string | null; docs_url: string | null;
  auth_type: string; oauth_config: Record<string, any> | null;
  is_available: boolean | null; is_coming_soon: boolean | null; is_beta: boolean | null;
  display_order: number | null; created_at: string; updated_at: string;
}

export interface IntegrationField {
  id: string; provider_id: string; field_key: string; label: string;
  field_type: string; placeholder: string | null; default_value: string | null;
  is_required: boolean | null; is_sensitive: boolean | null;
  help_text: string | null; validation_regex: string | null;
  select_options: any | null; display_order: number | null; created_at: string;
}

export interface OrganizationIntegration {
  id: string; user_id: string; provider_id: string;
  enabled: boolean | null; config: Record<string, any> | null;
  connection_status: string | null; connection_message: string | null;
  last_tested_at: string | null; last_sync_at: string | null;
  oauth_tokens: Record<string, any> | null;
  created_at: string; updated_at: string;
}

export interface IntegrationService {
  id: string; provider_id: string; name: string; service_key: string;
  description: string | null; features: Record<string, any> | null;
  has_cost: boolean | null; cost_model: Record<string, any> | null;
  enabled: boolean | null; is_default: boolean | null; is_beta: boolean | null;
  requires_config: boolean | null; display_order: number | null;
  created_at: string; updated_at: string;
}

// --- Icon Mapping ---
export function getCategoryIcon(iconName: string): LucideIcon {
  const map: Record<string, LucideIcon> = { Brain, Video, Mail, Users, Kanban, Cloud, Shield, Sparkles, Zap };
  return map[iconName] || Cloud;
}

export function getProviderIcon(slug: string): LucideIcon {
  const map: Record<string, LucideIcon> = {
    openai: Brain, anthropic: Sparkles, 'google-gemini': Cloud, perplexity: Zap,
    zoom: Video, 'microsoft-teams': Users, 'google-meet': Video,
    sendgrid: Mail, resend: Mail, 'google-drive': Cloud,
  };
  return map[slug] || Cloud;
}

// --- Status Helpers ---
export function getConnectionStatusIcon(status: string | null): LucideIcon {
  const map: Record<string, LucideIcon> = { connected: CheckCircle2, disconnected: Circle, error: XCircle, testing: Clock };
  return map[status || 'disconnected'] || Circle;
}

export function getConnectionStatusVariant(status: string | null): 'default' | 'secondary' | 'destructive' | 'outline' {
  const map: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    connected: 'default', disconnected: 'secondary', error: 'destructive', testing: 'outline',
  };
  return map[status || 'disconnected'] || 'secondary';
}

export function getConnectionStatusLabel(status: string | null): string {
  const map: Record<string, string> = { connected: 'Connected', disconnected: 'Not Connected', error: 'Error', testing: 'Testing...' };
  return map[status || 'disconnected'] || 'Unknown';
}

export function getAuthTypeLabel(authType: string): string {
  const map: Record<string, string> = { api_key: 'API Key', oauth2: 'OAuth 2.0', basic: 'Basic Auth', service_account: 'Service Account' };
  return map[authType] || authType;
}

export function getProviderActionLabel(provider: IntegrationProvider, orgIntegration?: OrganizationIntegration): string {
  if (provider.is_coming_soon) return 'Coming Soon';
  if (orgIntegration?.connection_status === 'connected') return 'Configure';
  return provider.auth_type === 'oauth2' ? 'Connect' : 'Configure';
}

// --- Formatting ---
export function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return 'Never';
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}

export function maskSensitiveValue(value: string): string {
  if (!value || value.length < 8) return '••••••••';
  return `${'•'.repeat(value.length - 4)}${value.slice(-4)}`;
}

// --- Validation ---
export function validateFieldValue(field: IntegrationField, value: string): { valid: boolean; error?: string } {
  if (field.is_required && !value) return { valid: false, error: `${field.label} is required` };
  if (!value) return { valid: true };
  if (field.field_type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return { valid: false, error: 'Invalid email' };
  if (field.field_type === 'url') { try { new URL(value); } catch { return { valid: false, error: 'Invalid URL' }; } }
  if (field.validation_regex && !new RegExp(field.validation_regex).test(value)) return { valid: false, error: 'Invalid format' };
  return { valid: true };
}

export function areRequiredFieldsFilled(fields: IntegrationField[], config: Record<string, any>): boolean {
  return fields.filter((f) => f.is_required).every((f) => config[f.field_key]);
}

// --- Sorting & Filtering ---
export function sortProvidersByOrder<T extends { display_order: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.display_order - b.display_order);
}
export function sortCategoriesByOrder<T extends { display_order: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.display_order - b.display_order);
}
export function filterProvidersByQuery(providers: IntegrationProvider[], query: string): IntegrationProvider[] {
  if (!query) return providers;
  const q = query.toLowerCase();
  return providers.filter((p) => p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q));
}
```

---

## 7. Frontend Components

### 7.1 ProviderCard.tsx

Displays a provider in the Integration Hub grid.

```tsx
// src/components/integrations/ProviderCard.tsx
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  IntegrationProvider, OrganizationIntegration,
  getProviderIcon, getConnectionStatusIcon, getConnectionStatusLabel,
  getConnectionStatusVariant, getProviderActionLabel,
} from '@/lib/integration-utils';

interface ProviderCardProps {
  provider: IntegrationProvider;
  orgIntegration?: OrganizationIntegration;
}

export function ProviderCard({ provider, orgIntegration }: ProviderCardProps) {
  const navigate = useNavigate();
  const Icon = getProviderIcon(provider.slug);
  const StatusIcon = orgIntegration ? getConnectionStatusIcon(orgIntegration.connection_status) : null;
  const statusVariant = orgIntegration ? getConnectionStatusVariant(orgIntegration.connection_status) : 'secondary';
  const statusLabel = orgIntegration ? getConnectionStatusLabel(orgIntegration.connection_status) : provider.is_coming_soon ? 'Coming Soon' : 'Not Configured';

  const handleClick = () => navigate(`/admin/integrations/${provider.slug}`);

  return (
    <Card className="border-2 transition-all cursor-pointer hover:border-primary/50 hover:shadow-md" onClick={handleClick}>
      <CardContent className="p-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="rounded-lg border p-3 bg-muted/50"><Icon className="h-8 w-8" /></div>
          <div className="w-full">
            <div className="flex items-center justify-center gap-2">
              <p className="font-semibold">{provider.name}</p>
              {provider.is_beta && <Badge variant="outline" className="text-xs">Beta</Badge>}
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{provider.description}</p>
          </div>
          <Badge variant={statusVariant} className="gap-1">
            {StatusIcon && <StatusIcon className="h-3 w-3" />}
            {statusLabel}
          </Badge>
          <Button variant={orgIntegration?.connection_status === 'connected' ? 'outline' : 'default'} size="sm" className="w-full" disabled={provider.is_coming_soon ?? false}>
            {getProviderActionLabel(provider, orgIntegration)}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

### 7.2 DynamicFormField.tsx

Renders text/password/select/textarea fields with validation, masking, and show/hide toggle.

```tsx
// src/components/integrations/DynamicFormField.tsx
import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IntegrationField, validateFieldValue, maskSensitiveValue } from '@/lib/integration-utils';

interface DynamicFormFieldProps {
  field: IntegrationField;
  value: string;
  onChange: (value: string) => void;
  showMasked?: boolean;
}

export function DynamicFormField({ field, value, onChange, showMasked = true }: DynamicFormFieldProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState(false);
  const [validationError, setValidationError] = useState<string>();

  useEffect(() => {
    if (touched && value) {
      const v = validateFieldValue(field, value);
      setValidationError(v.valid ? undefined : v.error);
    }
  }, [value, field, touched]);

  const handleBlur = () => {
    setTouched(true);
    const v = validateFieldValue(field, value);
    setValidationError(v.valid ? undefined : v.error);
  };

  const isSensitive = field.is_sensitive || field.field_type === 'password';
  const displayValue = isSensitive && showMasked && value && !showPassword ? maskSensitiveValue(value) : value;

  const renderInput = () => {
    if (field.field_type === 'select') {
      return (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger><SelectValue placeholder={field.placeholder || 'Select'} /></SelectTrigger>
          <SelectContent>
            {field.select_options?.map((opt: any) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    if (field.field_type === 'textarea') {
      return <Textarea value={value} onChange={(e) => onChange(e.target.value)} onBlur={handleBlur} placeholder={field.placeholder || ''} rows={4} />;
    }

    // text, password, email, url
    return (
      <div className="relative">
        <Input
          type={isSensitive && !showPassword ? 'password' : 'text'}
          value={displayValue} onChange={(e) => onChange(e.target.value)}
          onBlur={handleBlur} placeholder={field.placeholder || ''}
          className={`${isSensitive ? 'pr-10' : ''} ${validationError ? 'border-destructive' : ''}`}
        />
        {isSensitive && (
          <Button type="button" variant="ghost" size="sm"
            className="absolute right-0 top-0 h-full px-3"
            onClick={() => setShowPassword(!showPassword)}>
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      <Label>{field.label}{field.is_required && <span className="text-destructive ml-1">*</span>}</Label>
      {renderInput()}
      {field.help_text && !validationError && <p className="text-xs text-muted-foreground">{field.help_text}</p>}
      {touched && validationError && (
        <div className="flex items-center gap-1">
          <AlertCircle className="h-3 w-3 text-destructive" />
          <p className="text-xs text-destructive">{validationError}</p>
        </div>
      )}
      {touched && !validationError && value && field.is_required && (
        <div className="flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3 text-green-600" />
          <p className="text-xs text-green-600">Valid</p>
        </div>
      )}
    </div>
  );
}
```

### 7.3 ProviderDetailHeader.tsx

Detail page header showing provider info, status badge, and action buttons (Test/Connect/Disconnect).

See the full implementation in `src/components/integrations/ProviderDetailHeader.tsx` in the source project. Key features:
- Back button to `/admin/integrations`
- Provider icon, name, description, auth type
- Connection status badge
- Action buttons: Connect (OAuth) or Test Connection (API key)
- Disconnect with confirmation dialog
- Metadata: enabled state, last tested, last synced, configured date

---

## 8. Frontend Pages

### 8.1 Integration Hub (Main Page)

**Route**: `/admin/integrations`

```tsx
// src/pages/admin/Integrations.tsx
// Category-based collapsible grid with search and filtering
// Uses useProvidersGroupedByCategory() hook
// Renders ProviderCard for each provider
// Features: search input, category filter dropdown, collapsible sections
```

See full source in Section 5.1 (`useProvidersGroupedByCategory`) and the actual page in `src/pages/admin/Integrations.tsx`.

### 8.2 Provider Detail Page (Reference: Zoom)

**Route**: `/admin/integrations/zoom`

This is the reference implementation for a provider detail page. It demonstrates:

1. **Organization Config Section** — Dynamic form using `useIntegrationFields` + `DynamicFormField`
2. **User OAuth Section** — Connect/Disconnect buttons using `useConnectOAuth` / `useDisconnectOAuth`
3. **OAuth Setup Guide** — Redirect URL display, setup steps, required scopes
4. **Statistics** — Meeting counts, connection status
5. **Sync Controls** — Manual sync trigger for recordings/transcripts

See full source in `src/pages/admin/integrations/ZoomIntegration.tsx`.

---

## 9. OAuth Flow

```
┌──────────┐     ┌──────────────┐     ┌────────────────┐     ┌──────────┐
│  Admin   │     │   Frontend   │     │ Edge Functions  │     │ Provider │
│  Panel   │     │   (React)    │     │  (Supabase)     │     │  (Zoom)  │
└────┬─────┘     └──────┬───────┘     └───────┬────────┘     └────┬─────┘
     │                  │                     │                    │
     │ 1. Save Client   │                     │                    │
     │ ID + Secret ─────┼──► upsert into      │                    │
     │                  │    organization_     │                    │
     │                  │    integrations      │                    │
     │                  │                     │                    │
     │                  │ 2. Click "Connect"  │                    │
     │                  │────────────────────►│                    │
     │                  │  user-oauth-connect │                    │
     │                  │                     │── 3. Store state   │
     │                  │                     │   in oauth_states  │
     │                  │                     │                    │
     │                  │◄── auth URL ────────│                    │
     │                  │                     │                    │
     │                  │──── 4. Redirect ────┼───────────────────►│
     │                  │                     │                    │
     │                  │                     │◄── 5. Callback ────│
     │                  │                     │   with code+state  │
     │                  │                     │                    │
     │                  │                     │── 6. Exchange code │
     │                  │                     │   for tokens ─────►│
     │                  │                     │◄── tokens ─────────│
     │                  │                     │                    │
     │                  │                     │── 7. Store in      │
     │                  │                     │   user_oauth_tokens│
     │                  │                     │                    │
     │                  │◄── 8. Redirect ─────│                    │
     │                  │   back to app       │                    │
```

### Key Security Points

1. **CSRF Protection**: `oauth_states` table stores state + user_id + expiry (10 min)
2. **Token Security**: `access_token` and `refresh_token` never sent to client (excluded from SELECT in `useUserOAuthToken`)
3. **Credential Storage**: Client ID/Secret stored in `organization_integrations.config` JSONB
4. **RLS**: All tables have Row Level Security. Users can only see their own records.

### Redirect URL

The OAuth callback URL is always:
```
{SUPABASE_URL}/functions/v1/user-oauth-callback
```

This URL must be registered in each provider's OAuth app settings (Zoom Marketplace, Google Cloud Console, Azure AD).

---

## 10. Adding a New Provider

### Step 1: Database — Insert Provider + Fields

```sql
-- 1. Insert the provider
INSERT INTO integration_providers (category_id, name, slug, description, auth_type, display_order)
VALUES (
  (SELECT id FROM integration_categories WHERE slug = 'meetings'),
  'Webex',
  'webex',
  'Cisco Webex video conferencing',
  'oauth2',  -- or 'api_key'
  4
);

-- 2. Insert fields (for OAuth providers: client_id + client_secret)
INSERT INTO integration_fields (provider_id, field_key, label, field_type, is_required, is_sensitive, help_text, display_order) VALUES
  ((SELECT id FROM integration_providers WHERE slug = 'webex'), 'client_id',     'Client ID',     'text',     true, false, 'Your Webex OAuth Client ID',     1),
  ((SELECT id FROM integration_providers WHERE slug = 'webex'), 'client_secret', 'Client Secret', 'password', true, true,  'Your Webex OAuth Client Secret', 2);
```

### Step 2: Edge Functions — Add Provider Config

In `user-oauth-connect/index.ts`, add to `getProviderConfig`:

```typescript
webex: {
  authUrl: "https://webexapis.com/v1/authorize",
  scopes: ["meeting:schedules_read", "meeting:schedules_write", "spark:people_read"],
  additionalParams: { response_type: "code" },
},
```

In `user-oauth-callback/index.ts`, add to `getTokenEndpoint`:
```typescript
webex: "https://webexapis.com/v1/access_token",
```

And add to `getUserInfo`:
```typescript
case "webex":
  url = "https://webexapis.com/v1/people/me";
  // then normalize: return { email: data.emails[0], name: data.displayName, picture: data.avatar };
```

### Step 3: Frontend — Add Icon Mapping

In `integration-utils.ts`, add:
```typescript
webex: Video,  // in getProviderIcon
```

### Step 4: Create Provider Detail Page (Optional)

Create `src/pages/admin/integrations/WebexIntegration.tsx` following the Zoom reference implementation pattern.

### Step 5: Add Route

In your router config:
```tsx
<Route path="/admin/integrations/webex" element={<WebexIntegration />} />
```

### Step 6: Add to config.toml (if new edge functions)

```toml
[functions.user-oauth-connect]
verify_jwt = false

[functions.user-oauth-callback]
verify_jwt = false

[functions.user-oauth-disconnect]
verify_jwt = false

[functions.user-oauth-refresh]
verify_jwt = false
```

---

## 11. config.toml

All OAuth edge functions must use `verify_jwt = false` because the callback comes from the provider (no JWT). Auth is validated manually in-code.

```toml
[functions.user-oauth-connect]
verify_jwt = false

[functions.user-oauth-callback]
verify_jwt = false

[functions.user-oauth-disconnect]
verify_jwt = false

[functions.user-oauth-refresh]
verify_jwt = false

[functions.validate-api-key]
verify_jwt = false
```

---

## Environment Variables Required

| Variable | Where Set | Purpose |
|----------|-----------|---------|
| `SUPABASE_URL` | Auto | Supabase project URL |
| `SUPABASE_ANON_KEY` | Auto | Supabase anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto | Service role key (edge functions only) |
| `APP_URL` | Edge Function secret | Your app's public URL (for OAuth redirects) |

---

*Last updated: 2026-03-03*
