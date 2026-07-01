# OAuth Provider Integration Guide

**Version:** 1.0.0
**Last Updated:** February 4, 2026

## Overview

SJ Control Tower can act as an **OAuth 2.0 Identity Provider**, allowing other Control Tower instances or third-party applications to authenticate users through a centralized Control Tower instance.

This enables:
- **Single Sign-On (SSO)** across multiple Control Tower deployments
- **Centralized user management** for organizations with multiple instances
- **"Login with Control Tower"** buttons in external applications
- **Secure API access** for third-party integrations

---

## Architecture

### OAuth 2.0 Authorization Code Flow

```
┌─────────────┐                                ┌──────────────────┐
│             │                                │                  │
│  External   │                                │  Control Tower   │
│  App/Client │                                │  (Provider)      │
│             │                                │                  │
└──────┬──────┘                                └────────┬─────────┘
       │                                                 │
       │  1. Redirect to /oauth/authorize               │
       │ ──────────────────────────────────────────────>│
       │                                                 │
       │                    2. Show consent screen      │
       │                       (if not trusted)         │
       │<───────────────────────────────────────────────│
       │                                                 │
       │  3. User approves                              │
       │ ──────────────────────────────────────────────>│
       │                                                 │
       │  4. Redirect with authorization code           │
       │<───────────────────────────────────────────────│
       │                                                 │
       │  5. Exchange code for access_token             │
       │    POST /oauth/token                           │
       │ ──────────────────────────────────────────────>│
       │                                                 │
       │  6. Return access_token & refresh_token        │
       │<───────────────────────────────────────────────│
       │                                                 │
       │  7. Request user info with access_token        │
       │    GET /oauth/userinfo                         │
       │ ──────────────────────────────────────────────>│
       │                                                 │
       │  8. Return user profile data                   │
       │<───────────────────────────────────────────────│
       │                                                 │
```

---

## Setup for Provider (Control Tower Admin)

### Step 1: Run Database Migration

Run the OAuth provider migration to create necessary tables:

```bash
# This migration creates:
# - oauth_clients
# - oauth_authorization_codes
# - oauth_access_tokens
# - oauth_user_consents

psql -d your_database -f supabase/migrations/20260204_oauth_provider.sql
```

### Step 2: Register an OAuth Client

As an **admin user**, register a new OAuth client application:

**Option A: Using SQL**

```sql
INSERT INTO oauth_clients (
  client_id,
  client_secret,
  client_name,
  redirect_uris,
  allowed_scopes,
  grant_types,
  homepage_url,
  require_consent,
  trusted
) VALUES (
  'my-app-client-id',
  crypt('my-super-secret-key', gen_salt('bf')), -- Hashed password
  'My Application Name',
  ARRAY['https://myapp.com/auth/callback', 'http://localhost:3000/auth/callback'],
  ARRAY['openid', 'profile', 'email', 'roles'],
  ARRAY['authorization_code', 'refresh_token'],
  'https://myapp.com',
  TRUE,  -- Require user consent
  FALSE  -- Not a trusted first-party app
);
```

**Option B: Using Admin UI** (coming soon in admin panel)

Navigate to: `/admin/oauth-clients` → "Add New Client"

### Step 3: Provide Credentials to Client App

Share the following with the external application developer:

- **Client ID:** `my-app-client-id`
- **Client Secret:** `my-super-secret-key` (keep this secure!)
- **Authorization URL:** `https://your-control-tower.com/functions/v1/oauth-authorize`
- **Token URL:** `https://your-control-tower.com/functions/v1/oauth-token`
- **UserInfo URL:** `https://your-control-tower.com/functions/v1/oauth-userinfo`
- **Allowed Redirect URIs:** List of callback URLs
- **Scopes:** `openid profile email roles`

---

## Setup for Client (External Application)

### Step 1: Obtain OAuth Credentials

Get the following from the Control Tower admin:
- Client ID
- Client Secret
- Authorization URL
- Token URL
- UserInfo URL

### Step 2: Implement OAuth Flow

#### **2.1: Redirect User to Authorization URL**

When user clicks "Login with Control Tower", redirect them to:

```
https://your-control-tower.com/functions/v1/oauth-authorize?
  client_id=YOUR_CLIENT_ID&
  redirect_uri=https://yourapp.com/auth/callback&
  response_type=code&
  scope=openid profile email roles&
  state=RANDOM_CSRF_TOKEN
```

**Parameters:**
| Parameter | Required | Description |
|-----------|----------|-------------|
| `client_id` | Yes | Your OAuth client ID |
| `redirect_uri` | Yes | Where to send user after authorization (must match registered URI) |
| `response_type` | Yes | Always `code` for authorization code flow |
| `scope` | No | Space-separated scopes (default: `openid profile email`) |
| `state` | Yes | Random token for CSRF protection |
| `code_challenge` | No | PKCE code challenge (recommended for public clients) |
| `code_challenge_method` | No | `S256` or `plain` (use `S256` for better security) |

#### **2.2: Handle Authorization Callback**

After user approves, they'll be redirected to your `redirect_uri` with:

```
https://yourapp.com/auth/callback?
  code=AUTH_CODE_HERE&
  state=YOUR_STATE_TOKEN
```

**Verify:**
1. ✅ `state` matches what you sent
2. ✅ Extract the `code`

#### **2.3: Exchange Code for Access Token**

Make a POST request to the token endpoint:

```http
POST https://your-control-tower.com/functions/v1/oauth-token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&
code=AUTH_CODE_HERE&
redirect_uri=https://yourapp.com/auth/callback&
client_id=YOUR_CLIENT_ID&
client_secret=YOUR_CLIENT_SECRET
```

**Response:**

```json
{
  "access_token": "abc123...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "xyz789...",
  "scope": "openid profile email roles"
}
```

#### **2.4: Fetch User Info**

Use the `access_token` to fetch user profile:

```http
GET https://your-control-tower.com/functions/v1/oauth-userinfo
Authorization: Bearer ACCESS_TOKEN_HERE
```

**Response:**

```json
{
  "sub": "user-uuid-123",
  "email": "user@example.com",
  "email_verified": true,
  "name": "John Doe",
  "given_name": "John",
  "family_name": "Doe",
  "picture": "https://example.com/avatar.jpg",
  "role": "admin",
  "roles": ["admin"],
  "updated_at": 1709654400
}
```

#### **2.5: Refresh Access Token (Optional)**

When `access_token` expires (after 1 hour), use `refresh_token`:

```http
POST https://your-control-tower.com/functions/v1/oauth-token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token&
refresh_token=REFRESH_TOKEN_HERE&
client_id=YOUR_CLIENT_ID&
client_secret=YOUR_CLIENT_SECRET
```

**Response:**

```json
{
  "access_token": "new_abc123...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "new_xyz789...",
  "scope": "openid profile email roles"
}
```

---

## Code Examples

### Node.js / Express Example

```javascript
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');

const app = express();

const CONTROL_TOWER_URL = 'https://your-control-tower.com';
const CLIENT_ID = 'your-client-id';
const CLIENT_SECRET = 'your-client-secret';
const REDIRECT_URI = 'http://localhost:3000/auth/callback';

// Step 1: Redirect to authorization
app.get('/auth/login', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  req.session.oauth_state = state; // Store in session

  const authUrl = new URL(`${CONTROL_TOWER_URL}/functions/v1/oauth-authorize`);
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'openid profile email roles');
  authUrl.searchParams.set('state', state);

  res.redirect(authUrl.toString());
});

// Step 2: Handle callback
app.get('/auth/callback', async (req, res) => {
  const { code, state } = req.query;

  // Verify state
  if (state !== req.session.oauth_state) {
    return res.status(400).send('Invalid state parameter');
  }

  try {
    // Exchange code for token
    const tokenResponse = await axios.post(
      `${CONTROL_TOWER_URL}/functions/v1/oauth-token`,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );

    const { access_token, refresh_token } = tokenResponse.data;

    // Fetch user info
    const userResponse = await axios.get(
      `${CONTROL_TOWER_URL}/functions/v1/oauth-userinfo`,
      {
        headers: { Authorization: `Bearer ${access_token}` },
      }
    );

    const user = userResponse.data;

    // Store user session
    req.session.user = user;
    req.session.access_token = access_token;
    req.session.refresh_token = refresh_token;

    res.redirect('/dashboard');
  } catch (error) {
    console.error('OAuth error:', error.response?.data || error.message);
    res.status(500).send('Authentication failed');
  }
});

// Protected route example
app.get('/dashboard', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }

  res.send(`
    <h1>Welcome, ${req.session.user.name}!</h1>
    <p>Email: ${req.session.user.email}</p>
    <p>Role: ${req.session.user.role}</p>
  `);
});

app.listen(3000, () => console.log('App running on http://localhost:3000'));
```

### React / Next.js Example

```typescript
// pages/api/auth/login.ts
import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';

const CONTROL_TOWER_URL = process.env.CONTROL_TOWER_URL!;
const CLIENT_ID = process.env.OAUTH_CLIENT_ID!;
const REDIRECT_URI = process.env.OAUTH_REDIRECT_URI!;

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const state = crypto.randomBytes(16).toString('hex');

  // Store state in cookie or session
  res.setHeader('Set-Cookie', `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax`);

  const authUrl = new URL(`${CONTROL_TOWER_URL}/functions/v1/oauth-authorize`);
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'openid profile email roles');
  authUrl.searchParams.set('state', state);

  res.redirect(authUrl.toString());
}
```

```typescript
// pages/api/auth/callback.ts
import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import cookie from 'cookie';

const CONTROL_TOWER_URL = process.env.CONTROL_TOWER_URL!;
const CLIENT_ID = process.env.OAUTH_CLIENT_ID!;
const CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET!;
const REDIRECT_URI = process.env.OAUTH_REDIRECT_URI!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code, state } = req.query;

  // Verify state
  const cookies = cookie.parse(req.headers.cookie || '');
  if (state !== cookies.oauth_state) {
    return res.status(400).json({ error: 'Invalid state' });
  }

  try {
    // Exchange code for token
    const tokenResponse = await axios.post(
      `${CONTROL_TOWER_URL}/functions/v1/oauth-token`,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token, refresh_token } = tokenResponse.data;

    // Fetch user info
    const userResponse = await axios.get(
      `${CONTROL_TOWER_URL}/functions/v1/oauth-userinfo`,
      { headers: { Authorization: `Bearer ${access_token}` } }
    );

    const user = userResponse.data;

    // Set session cookies
    res.setHeader('Set-Cookie', [
      `access_token=${access_token}; HttpOnly; Secure; SameSite=Lax; Max-Age=3600`,
      `refresh_token=${refresh_token}; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`,
      `user=${JSON.stringify(user)}; HttpOnly; Secure; SameSite=Lax; Max-Age=3600`,
    ]);

    res.redirect('/dashboard');
  } catch (error) {
    console.error('OAuth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}
```

---

## Security Best Practices

### 1. **Use HTTPS**
Always use HTTPS for all OAuth endpoints in production. Never transmit tokens over HTTP.

### 2. **Validate State Parameter**
Always validate the `state` parameter to prevent CSRF attacks.

### 3. **Store Client Secret Securely**
- Never commit `client_secret` to version control
- Use environment variables
- Rotate secrets periodically

### 4. **Implement PKCE for Public Clients**
For SPA or mobile apps, use PKCE (Proof Key for Code Exchange):

```javascript
// Generate code_verifier
const codeVerifier = crypto.randomBytes(32).toString('base64url');

// Generate code_challenge
const challenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

// Add to authorization request
authUrl.searchParams.set('code_challenge', challenge);
authUrl.searchParams.set('code_challenge_method', 'S256');

// Later, include code_verifier in token exchange
tokenParams.set('code_verifier', codeVerifier);
```

### 5. **Token Expiration**
- **Access tokens** expire in 1 hour
- **Refresh tokens** expire in 30 days
- Implement token refresh logic before access token expires

### 6. **Revoke Tokens on Logout**
When user logs out, revoke their tokens (revocation endpoint coming soon).

---

## Scopes

| Scope | Description | Returns |
|-------|-------------|---------|
| `openid` | **Required** for OpenID Connect | `sub` (user ID) |
| `profile` | User profile information | `name`, `given_name`, `family_name`, `picture`, `updated_at` |
| `email` | User email address | `email`, `email_verified` |
| `roles` | User roles in Control Tower | `role`, `roles` (array) |

**Example:**
```
scope=openid profile email roles
```

---

## Error Handling

### Authorization Errors

| Error | Description | Action |
|-------|-------------|--------|
| `invalid_request` | Missing required parameters | Check query parameters |
| `unsupported_response_type` | `response_type` not `code` | Use `response_type=code` |
| `invalid_client` | Invalid or disabled `client_id` | Verify client ID with admin |
| `invalid_scope` | Requested scope not allowed | Check allowed scopes |

### Token Errors

| Error | Description | Action |
|-------|-------------|--------|
| `invalid_grant` | Invalid or expired authorization code | Request new authorization |
| `invalid_client` | Wrong `client_secret` | Verify credentials |
| `unsupported_grant_type` | Grant type not allowed | Check `grant_types` config |

### UserInfo Errors

| Error | Description | Action |
|-------|-------------|--------|
| `invalid_token` | Expired or revoked access token | Refresh token |
| `invalid_request` | Missing `Authorization` header | Include `Bearer` token |

---

## Testing with cURL

### 1. Authorization (Manual Test)

Visit in browser:
```
https://your-control-tower.com/functions/v1/oauth-authorize?client_id=control-tower-dev-client&redirect_uri=http://localhost:8080/auth/callback&response_type=code&scope=openid%20profile%20email&state=test123
```

After consent, you'll be redirected to:
```
http://localhost:8080/auth/callback?code=AUTH_CODE&state=test123
```

### 2. Token Exchange

```bash
curl -X POST https://your-control-tower.com/functions/v1/oauth-token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "code=YOUR_AUTH_CODE" \
  -d "redirect_uri=http://localhost:8080/auth/callback" \
  -d "client_id=control-tower-dev-client" \
  -d "client_secret=dev_secret_123"
```

### 3. UserInfo Request

```bash
curl https://your-control-tower.com/functions/v1/oauth-userinfo \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## Use Cases

### 1. **Multi-Tenant Control Tower**
Organization runs multiple Control Tower instances (dev, staging, prod). Users log in once to the main instance, then access all environments without re-authenticating.

### 2. **White-Label Control Tower**
Agency provides Control Tower to multiple clients. Each client has their own instance, but all authenticate through agency's central instance for unified user management.

### 3. **Third-Party Integrations**
External analytics dashboard wants to pull data from Control Tower. Users authorize the dashboard, which then uses OAuth tokens to access Control Tower APIs.

### 4. **Mobile App**
Control Tower mobile app authenticates users via OAuth (with PKCE) instead of storing passwords.

---

## FAQ

**Q: Can I use this for external users (non-Control Tower)?**
A: Yes! Any application can use Control Tower as an identity provider, not just other Control Tower instances.

**Q: How do I revoke a client?**
A: Set `enabled = FALSE` in the `oauth_clients` table. All future authorization requests will be rejected.

**Q: How do I revoke a user's access to a client?**
A: Delete the row from `oauth_user_consents` table for that user + client. They'll be prompted to consent again.

**Q: Can I skip the consent screen for first-party apps?**
A: Yes! Set `trusted = TRUE` when creating the OAuth client. Users will be redirected immediately without consent.

**Q: What's the difference between `require_consent` and `trusted`?**
A: `require_consent = FALSE` skips consent for all users. `trusted = TRUE` is similar but also implies first-party app (for UI purposes).

**Q: Can I customize the consent screen?**
A: Yes, create a custom page at `/oauth/consent` that displays client info and scopes. (Example UI coming soon)

**Q: How do I monitor OAuth usage?**
A: Check `total_authorizations` and `last_used_at` in `oauth_clients` table. Full analytics dashboard coming soon.

---

## Roadmap

**Q1 2026 (Current)**
- ✅ Authorization Code Flow
- ✅ Access & Refresh Tokens
- ✅ UserInfo Endpoint
- ✅ PKCE Support

**Q2 2026**
- 📋 Admin UI for OAuth client management
- 📋 Token revocation endpoint
- 📋 Client credentials grant (for machine-to-machine)
- 📋 Consent screen customization

**Q3 2026**
- 📋 OAuth usage analytics dashboard
- 📋 Rate limiting per client
- 📋 Webhook notifications for new authorizations

---

## Support

**Documentation:** `/docs/public_website/oauth-provider-integration.md`

**Questions?**
- Email: support@sjinnovation.com
- GitHub: [Open an issue](https://github.com/sjinnovation/sj-control-tower-framework/issues)

---

**SJ Control Tower OAuth Provider** — Secure, centralized authentication for distributed applications.
