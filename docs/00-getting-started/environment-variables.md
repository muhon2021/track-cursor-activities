# Environment Variables Reference

Complete list of environment variables for CollabAi.

---

## Required Variables

These are required for the application to function:

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_SUPABASE_PROJECT_ID` | Your Supabase project reference | `abcdefghijklmnop` |
| `VITE_SUPABASE_URL` | Supabase API URL | `https://xxx.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/public key | `eyJhbGc...` |

---

## AI Configuration

Choose one AI provider:

### OpenAI
```env
OPENAI_API_KEY=sk-proj-xxxxx
```

### Anthropic (Claude)
```env
ANTHROPIC_API_KEY=sk-ant-xxxxx
```

### Google AI (Gemini)
```env
GOOGLE_AI_API_KEY=xxxxx
```

> 💡 **Using Lovable?** You don't need any AI keys - Lovable AI is included!

---

## Microsoft Integration

For Microsoft Teams, Calendar, and OneDrive:

```env
# Azure AD Application
VITE_AZURE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
VITE_AZURE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Optional: Restrict to specific tenant
VITE_AZURE_AUTHORITY=https://login.microsoftonline.com/{tenant-id}
```

See [Microsoft Setup Guide](../05-integrations/providers/microsoft/) for Azure AD configuration.

---

## Google Integration

For Google Drive, Calendar, and Meet:

```env
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
```

See [Google Setup Guide](../05-integrations/providers/google/) for OAuth configuration.

---

## Zoom Integration

```env
ZOOM_CLIENT_ID=xxxxx
ZOOM_CLIENT_SECRET=xxxxx
ZOOM_WEBHOOK_SECRET_TOKEN=xxxxx
```

See [Zoom Setup Guide](../05-integrations/providers/zoom.md).

---

## Email Notifications

### SendGrid
```env
SENDGRID_API_KEY=SG.xxxxx
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
SENDGRID_FROM_NAME=CollabAi
```

### Resend (Alternative)
```env
RESEND_API_KEY=re_xxxxx
```

---

## Security & Encryption

```env
# For encrypting sensitive data
ENCRYPTION_KEY=your-32-character-encryption-key
```

---

## Where to Set Variables

### Lovable Projects
1. Go to **Settings → Secrets**
2. Add each variable as a secret
3. Secrets are automatically available to edge functions

### Self-Hosted (Local Development)
1. Copy `.env.example` to `.env`
2. Fill in your values
3. Never commit `.env` to git!

### Self-Hosted (Production)
Set in your hosting platform:
- **Vercel**: Project Settings → Environment Variables
- **Netlify**: Site Settings → Environment Variables
- **Docker**: Pass via `-e` flag or docker-compose

### Supabase Edge Functions
1. Go to Supabase Dashboard
2. Settings → Edge Function Secrets
3. Add secrets (they're encrypted at rest)

---

## Variable Types

| Prefix | Visibility | Use |
|--------|------------|-----|
| `VITE_` | Client-side (public) | Supabase URL, publishable keys |
| No prefix | Server-side only | API keys, secrets |

> ⚠️ **Never expose API keys with `VITE_` prefix!** They'll be visible in the browser.

---

## Validation

The app includes environment validation. Check the browser console for warnings about missing required variables.

```typescript
// Validation runs automatically on startup
// See: src/lib/env-validator.ts
```

---

## Example .env File

```env
# ============================================
# REQUIRED - Supabase
# ============================================
VITE_SUPABASE_PROJECT_ID="your-project-ref"
VITE_SUPABASE_URL="https://your-project-ref.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# ============================================
# AI PROVIDER (choose one)
# ============================================
OPENAI_API_KEY="sk-proj-..."
# ANTHROPIC_API_KEY="sk-ant-..."
# GOOGLE_AI_API_KEY="..."

# ============================================
# MICROSOFT (optional)
# ============================================
VITE_AZURE_CLIENT_ID=""
VITE_AZURE_TENANT_ID=""

# ============================================
# GOOGLE (optional)
# ============================================
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# ============================================
# ZOOM (optional)
# ============================================
ZOOM_CLIENT_ID=""
ZOOM_CLIENT_SECRET=""

# ============================================
# EMAIL (optional)
# ============================================
SENDGRID_API_KEY=""
SENDGRID_FROM_EMAIL=""
```
