# Integration Hub - API Reference

Developer documentation for the Integration Hub system.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Database Schema](#database-schema)
3. [React Hooks](#react-hooks)
4. [Utility Functions](#utility-functions)
5. [Edge Functions](#edge-functions)
6. [OAuth Flow](#oauth-flow)
7. [Webhook Handling](#webhook-handling)
8. [Adding New Providers](#adding-new-providers)

---

## Architecture Overview

The Integration Hub follows a layered architecture:

```
┌─────────────────────────────────────────┐
│           Frontend (React)              │
│  - Pages (IntegrationAnalytics, etc.)  │
│  - Components (ProviderCard, etc.)      │
│  - Hooks (useIntegrations, etc.)        │
│  - Utils (integration-utils.ts)         │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│          Supabase Client                │
│  - React Query for data fetching        │
│  - Real-time subscriptions              │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│         Database (PostgreSQL)           │
│  - integration_categories               │
│  - integration_providers                │
│  - integration_fields                   │
│  - organization_integrations            │
│  - integration_services                 │
│  - integration_usage_logs               │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│      Edge Functions (Deno)              │
│  - validate-api-key                     │
│  - oauth-exchange-token                 │
│  - oauth-refresh-token                  │
└─────────────────────────────────────────┘
```

---

## Database Schema

### `integration_categories`

Defines integration categories (AI, Meeting, Email, etc.).

```sql
CREATE TABLE integration_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  display_order INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `integration_providers`

Defines available integration providers.

```sql
CREATE TABLE integration_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES integration_categories(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  logo_url TEXT,
  docs_url TEXT,
  auth_type TEXT NOT NULL CHECK (auth_type IN ('api_key', 'oauth2', 'basic', 'service_account')),
  oauth_config JSONB,
  is_available BOOLEAN DEFAULT true,
  is_coming_soon BOOLEAN DEFAULT false,
  is_beta BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**oauth_config structure**:
```typescript
{
  authorize_url: string;
  token_url: string;
  scopes: string[];
  client_id?: string;
  client_secret?: string;
  response_type?: string; // default: 'code'
  grant_type?: string; // default: 'authorization_code'
}
```

### `integration_fields`

Defines form fields for provider configuration.

```sql
CREATE TABLE integration_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES integration_providers(id),
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('text', 'password', 'url', 'email', 'select', 'textarea')),
  placeholder TEXT,
  default_value TEXT,
  is_required BOOLEAN DEFAULT false,
  is_sensitive BOOLEAN DEFAULT false,
  help_text TEXT,
  validation_regex TEXT,
  select_options JSONB,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `organization_integrations`

Stores organization-specific integration configurations.

```sql
CREATE TABLE organization_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  provider_id UUID NOT NULL REFERENCES integration_providers(id),
  enabled BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}'::jsonb,
  oauth_tokens JSONB,
  connection_status TEXT DEFAULT 'disconnected' CHECK (connection_status IN ('connected', 'disconnected', 'error', 'testing')),
  connection_message TEXT,
  last_tested_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, provider_id)
);
```

**oauth_tokens structure**:
```typescript
{
  access_token: string;
  refresh_token: string | null;
  token_type: string; // 'Bearer'
  expires_at: string | null; // ISO timestamp
  scope: string | null;
}
```

### `integration_services`

Defines individual services per provider (e.g., AI models).

```sql
CREATE TABLE integration_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES integration_providers(id),
  service_key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  is_beta BOOLEAN DEFAULT false,
  has_cost BOOLEAN DEFAULT false,
  cost_model JSONB,
  features JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider_id, service_key)
);
```

### `integration_usage_logs`

Tracks API usage for analytics.

```sql
CREATE TABLE integration_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  provider_id UUID NOT NULL REFERENCES integration_providers(id),
  service_id UUID REFERENCES integration_services(id),
  request_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'partial')),
  response_time INTEGER, -- milliseconds
  cost DECIMAL(10, 6),
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## React Hooks

### useIntegrationCategories()

Fetch all integration categories.

```typescript
import { useIntegrationCategories } from '@/hooks/useIntegrations';

function MyComponent() {
  const { data, isLoading, error } = useIntegrationCategories();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <ul>
      {data?.map((category) => (
        <li key={category.id}>{category.name}</li>
      ))}
    </ul>
  );
}
```

### useIntegrationProviders(categoryId?)

Fetch all providers, optionally filtered by category.

```typescript
const { data: providers } = useIntegrationProviders();
const { data: aiProviders } = useIntegrationProviders(categoryId);
```

### useIntegrationProvider(slug)

Fetch a single provider by slug.

```typescript
const { data: provider } = useIntegrationProvider('openai');
```

### useOrganizationIntegrations()

Fetch all organization integrations.

```typescript
const { data: integrations } = useOrganizationIntegrations();
```

### useUpdateIntegration()

Mutation to save integration configuration.

```typescript
const updateIntegration = useUpdateIntegration();

await updateIntegration.mutateAsync({
  providerId: 'uuid',
  config: { api_key: 'sk-...' },
  enabled: true,
});
```

### useTestConnection()

Mutation to test integration connection.

```typescript
const testConnection = useTestConnection();

const result = await testConnection.mutateAsync({
  providerSlug: 'openai',
  credentials: { api_key: 'sk-...' },
});

if (result.valid) {
  console.log('Connection successful');
}
```

### useDisconnectIntegration()

Mutation to disconnect an integration.

```typescript
const disconnectIntegration = useDisconnectIntegration();

await disconnectIntegration.mutateAsync({
  providerId: 'uuid',
});
```

### useIntegrationServices(providerId)

Fetch services for a provider.

```typescript
const { data: services } = useIntegrationServices(providerId);
```

### useToggleService()

Mutation to enable/disable a service.

```typescript
const toggleService = useToggleService();

await toggleService.mutateAsync({
  serviceId: 'uuid',
  enabled: true,
});
```

### useIntegrationUsageLogs(filters)

Fetch usage logs with filters.

```typescript
const { data: logs } = useIntegrationUsageLogs({
  dateRange: '30d',
  categoryId: 'uuid',
  providerId: 'uuid',
});
```

---

## Utility Functions

### Integration Utils (`src/lib/integration-utils.ts`)

#### Icon Helpers

```typescript
import { getCategoryIcon, getProviderIcon } from '@/lib/integration-utils';

const Icon = getCategoryIcon('ai'); // Returns Brain icon
const ProviderIcon = getProviderIcon('openai'); // Returns OpenAI icon
```

#### Status Helpers

```typescript
import {
  getConnectionStatusLabel,
  getConnectionStatusVariant,
  getAuthTypeLabel,
} from '@/lib/integration-utils';

const label = getConnectionStatusLabel('connected'); // 'Connected'
const variant = getConnectionStatusVariant('connected'); // 'default'
const authLabel = getAuthTypeLabel('oauth2'); // 'OAuth 2.0'
```

#### Formatting Helpers

```typescript
import {
  formatRelativeTime,
  formatCost,
  maskSensitiveValue,
} from '@/lib/integration-utils';

const timeAgo = formatRelativeTime('2024-01-01T00:00:00Z'); // '2 days ago'
const cost = formatCost(0.0025); // '$0.0025'
const masked = maskSensitiveValue('sk-abc123'); // 'sk-•••••••••'
```

#### Validation Helpers

```typescript
import {
  validateFieldValue,
  areRequiredFieldsFilled,
} from '@/lib/integration-utils';

const validation = validateFieldValue(field, 'value');
if (!validation.valid) {
  console.error(validation.error);
}

const allFilled = areRequiredFieldsFilled(fields, config);
```

#### OAuth Helpers

```typescript
import {
  generateOAuthState,
  storeOAuthState,
  retrieveOAuthState,
  buildOAuthAuthorizationUrl,
} from '@/lib/integration-utils';

// Generate and store state
const state = generateOAuthState();
storeOAuthState(state, providerId);

// Build auth URL
const authUrl = buildOAuthAuthorizationUrl(
  provider,
  state,
  'https://example.com/callback'
);

// Validate state on callback
const stateData = retrieveOAuthState(state);
if (!stateData) {
  throw new Error('Invalid state');
}
```

---

## Edge Functions

### validate-api-key

Validates provider API keys.

**Endpoint**: `POST /functions/v1/validate-api-key`

**Request**:
```json
{
  "apiKey": "sk-...",
  "service": "openai"
}
```

**Response**:
```json
{
  "valid": true,
  "message": "OpenAI API key is valid",
  "details": {
    "models_count": 50
  }
}
```

**Supported Services**:
- `openai`, `anthropic`, `google_ai`, `perplexity`
- `sendgrid`, `mailgun`, `postmark`
- `zoom`, `salesforce`, `hubspot`
- `jira`, `asana`, `monday`

### oauth-exchange-token

Exchanges authorization code for access tokens.

**Endpoint**: `POST /functions/v1/oauth-exchange-token`

**Request**:
```json
{
  "code": "auth_code",
  "providerId": "uuid",
  "redirectUri": "https://example.com/callback"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Successfully connected to Zoom",
  "integration": {
    "id": "uuid",
    "provider_id": "uuid",
    "oauth_tokens": {
      "access_token": "...",
      "refresh_token": "...",
      "expires_at": "2024-01-01T00:00:00Z"
    }
  }
}
```

### oauth-refresh-token

Refreshes expired OAuth access tokens.

**Endpoint**: `POST /functions/v1/oauth-refresh-token`

**Request**:
```json
{
  "providerId": "uuid",
  "refreshToken": "refresh_token"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Successfully refreshed token",
  "tokens": {
    "access_token": "new_access_token",
    "refresh_token": "new_refresh_token",
    "expires_at": "2024-01-02T00:00:00Z"
  }
}
```

---

## OAuth Flow

### Frontend Implementation

```typescript
// 1. Initiate OAuth
const handleOAuthConnect = () => {
  const state = generateOAuthState();
  storeOAuthState(state, provider.id);

  const redirectUri = `${window.location.origin}/admin/integrations/oauth/callback`;
  const authUrl = buildOAuthAuthorizationUrl(provider, state, redirectUri);

  window.location.href = authUrl;
};

// 2. Handle Callback (OAuthCallback.tsx)
const handleOAuthCallback = async () => {
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  // Validate state
  const stateData = retrieveOAuthState(state);
  if (!stateData) throw new Error('Invalid state');

  // Exchange code for tokens
  const { data } = await supabase.functions.invoke('oauth-exchange-token', {
    body: { code, providerId: stateData.providerId, redirectUri },
  });

  if (data.success) {
    navigate(`/admin/integrations/${provider.slug}`);
  }
};
```

### Backend Implementation (Edge Function)

```typescript
// oauth-exchange-token/index.ts
serve(async (req) => {
  const { code, providerId, redirectUri } = await req.json();

  // 1. Fetch provider OAuth config
  const { data: provider } = await supabase
    .from('integration_providers')
    .select('oauth_config')
    .eq('id', providerId)
    .single();

  // 2. Exchange code for tokens
  const tokenResponse = await fetch(provider.oauth_config.token_url, {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: provider.oauth_config.client_id,
      client_secret: provider.oauth_config.client_secret,
    }),
  });

  const tokens = await tokenResponse.json();

  // 3. Store tokens in database
  await supabase
    .from('organization_integrations')
    .upsert({
      provider_id: providerId,
      oauth_tokens: tokens,
      connection_status: 'connected',
    });

  return new Response(JSON.stringify({ success: true }));
});
```

---

## Webhook Handling

### Register Webhook

```typescript
import { createWebhookSubscription } from '@/lib/webhook-handlers';

const result = await createWebhookSubscription(
  organizationId,
  providerId,
  ['meeting.created', 'recording.completed']
);
```

### Verify Webhook Signature

```typescript
import { verifyZoomWebhookSignature } from '@/lib/webhook-handlers';

const isValid = await verifyZoomWebhookSignature(
  rawPayload,
  timestamp,
  signature,
  secretToken
);

if (!isValid) {
  throw new Error('Invalid webhook signature');
}
```

### Process Webhook Event

```typescript
import { logWebhookEvent, parseWebhookEvent } from '@/lib/webhook-handlers';

// Parse provider-specific event to standard format
const event = parseWebhookEvent('zoom', rawEvent);

// Log the event
await logWebhookEvent(subscriptionId, event, payload);

// Process based on event type
switch (event) {
  case 'recording.completed':
    await syncMeetingRecordings(orgIntegrationId, payload.meeting_id);
    break;
  // ... other events
}
```

---

## Adding New Providers

### 1. Add Provider to Database

```sql
INSERT INTO integration_providers (
  category_id,
  name,
  slug,
  description,
  auth_type,
  oauth_config,
  is_available
) VALUES (
  (SELECT id FROM integration_categories WHERE slug = 'meeting'),
  'GoToMeeting',
  'gotomeeting',
  'Video conferencing platform',
  'oauth2',
  '{
    "authorize_url": "https://api.getgo.com/oauth/v2/authorize",
    "token_url": "https://api.getgo.com/oauth/v2/token",
    "scopes": ["meetings:read", "meetings:write"]
  }'::jsonb,
  false -- Coming soon
);
```

### 2. Add Provider Icon

Edit `src/lib/integration-utils.ts`:

```typescript
export function getProviderIcon(slug: string): LucideIcon {
  const iconMap: Record<string, LucideIcon> = {
    openai: Brain,
    zoom: Video,
    gotomeeting: Video, // Add new provider
    // ...
  };
  return iconMap[slug] || Cloud;
}
```

### 3. Add Form Fields (if API key auth)

```sql
INSERT INTO integration_fields (
  provider_id,
  field_key,
  label,
  field_type,
  placeholder,
  is_required,
  is_sensitive,
  help_text
) VALUES (
  (SELECT id FROM integration_providers WHERE slug = 'gotomeeting'),
  'api_key',
  'API Key',
  'password',
  'Enter your GoToMeeting API key',
  true,
  true,
  'Found in your GoToMeeting developer portal'
);
```

### 4. Add Validation (if API key auth)

Edit `supabase/functions/validate-api-key/index.ts`:

```typescript
case 'gotomeeting':
  validationResult = await validateGoToMeeting(apiKey);
  break;

// Add validation function
async function validateGoToMeeting(apiKey: string) {
  const response = await fetch('https://api.getgo.com/v1/account', {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });

  if (response.ok) {
    return {
      valid: true,
      message: 'GoToMeeting API key is valid',
      details: {},
    };
  }

  return {
    valid: false,
    message: 'Invalid GoToMeeting API key',
    details: { status: response.status },
  };
}
```

### 5. Add Services (Optional)

```sql
INSERT INTO integration_services (
  provider_id,
  service_key,
  name,
  description,
  enabled,
  is_default
) VALUES (
  (SELECT id FROM integration_providers WHERE slug = 'gotomeeting'),
  'standard_meeting',
  'Standard Meeting',
  'Regular video conferences',
  true,
  true
);
```

### 6. Test Integration

1. Restart development server
2. Navigate to Integration Hub
3. Verify provider appears in correct category
4. Test connection with valid credentials
5. Verify services appear and can be toggled

---

## Testing

### Unit Tests

```typescript
// integration-utils.test.ts
import { formatCost, validateFieldValue } from '@/lib/integration-utils';

describe('formatCost', () => {
  it('formats cost correctly', () => {
    expect(formatCost(0.0025)).toBe('$0.0025');
    expect(formatCost(1.5)).toBe('$1.50');
  });
});

describe('validateFieldValue', () => {
  it('validates email fields', () => {
    const field = {
      field_type: 'email',
      is_required: true,
      validation_regex: null,
    };

    const result = validateFieldValue(field, 'test@example.com');
    expect(result.valid).toBe(true);
  });
});
```

### Integration Tests

```typescript
// oauth-flow.test.ts
import { generateOAuthState, storeOAuthState, retrieveOAuthState } from '@/lib/integration-utils';

describe('OAuth Flow', () => {
  it('generates and validates state correctly', () => {
    const state = generateOAuthState();
    storeOAuthState(state, 'provider-id');

    const retrieved = retrieveOAuthState(state);
    expect(retrieved?.providerId).toBe('provider-id');

    // State should be consumed (one-time use)
    const second = retrieveOAuthState(state);
    expect(second).toBeNull();
  });
});
```

---

## Environment Variables

Required environment variables for OAuth providers:

```bash
# Zoom
ZOOM_CLIENT_ID=your_client_id
ZOOM_CLIENT_SECRET=your_client_secret

# Microsoft
MICROSOFT_CLIENT_ID=your_client_id
MICROSOFT_CLIENT_SECRET=your_client_secret

# Google
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret

# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

---

## Performance Optimization

### React Query Caching

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
    },
  },
});
```

### Database Indexes

```sql
-- Speed up provider queries
CREATE INDEX idx_integration_providers_category ON integration_providers(category_id);
CREATE INDEX idx_integration_providers_slug ON integration_providers(slug);

-- Speed up usage log queries
CREATE INDEX idx_usage_logs_created_at ON integration_usage_logs(created_at DESC);
CREATE INDEX idx_usage_logs_provider ON integration_usage_logs(provider_id, created_at DESC);
```

---

## Security Considerations

1. **API Key Storage**: All sensitive fields encrypted at rest
2. **OAuth Tokens**: Stored with encryption, auto-refresh before expiration
3. **CSRF Protection**: OAuth state parameter with 5-minute expiration
4. **Row Level Security**: RLS policies on all tables
5. **Webhook Signatures**: HMAC verification for all webhooks
6. **Rate Limiting**: Implement rate limits on edge functions

---

**Last Updated**: January 2026
**API Version**: 1.0.0
