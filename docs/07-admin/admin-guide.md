# CollabAi Admin Guide

![Built with Lovable](https://img.shields.io/badge/Built%20with-Lovable-ff69b4?style=flat-square)
![Backend: Supabase](https://img.shields.io/badge/Backend-Supabase-3ECF8E?style=flat-square)

> **Configuration and administration guide for CollabAi platform**
>
> 🔧 **All backend management happens in [Supabase Dashboard](https://supabase.com/dashboard)**

---

## 🛠️ Administration Platforms

| Task | Platform | Link |
|------|----------|------|
| **Frontend changes** | Lovable.dev | [lovable.dev](https://lovable.dev) |
| **User management** | Supabase Dashboard | [supabase.com/dashboard](https://supabase.com/dashboard) → Auth |
| **Database management** | Supabase Dashboard | [supabase.com/dashboard](https://supabase.com/dashboard) → Table Editor |
| **API secrets** | Supabase Dashboard | [supabase.com/dashboard](https://supabase.com/dashboard) → Settings → Edge Functions |
| **File storage** | Supabase Dashboard | [supabase.com/dashboard](https://supabase.com/dashboard) → Storage |
| **Logs & monitoring** | Supabase Dashboard | [supabase.com/dashboard](https://supabase.com/dashboard) → Logs |

---

## 🎯 Overview

This guide covers admin-only configuration tasks:

- User management
- Role assignment
- Feature configuration
- Integration setup
- Branding customization

---

## 🔐 Accessing Admin Panel

### Requirements

- User account with `admin` role in `user_roles` table
- Access to `/admin` route in the app

### Verify Admin Access

1. Log in to the application
2. Check if "Admin" appears in sidebar
3. Navigate to `/admin`

If you don't see Admin:
- Verify your role in **Supabase Dashboard** → Table Editor → `user_roles`
- Ensure role is `admin` (not `user` or `moderator`)

---

## 👥 User Management (Supabase Dashboard)

### Viewing Users

In **Supabase Dashboard**:
1. Go to **Authentication** → **Users**
2. View all user accounts
3. Click row to see details

Or in **Table Editor** → `profiles` for additional profile data.

### Creating Users

**Option 1: User Self-Registration**
1. Share signup URL: `https://your-app.com/signup`
2. User creates account
3. Admin assigns role (see below)

**Option 2: Supabase Dashboard**
1. Go to **Authentication** → **Users**
2. Click **"Add User"**
3. Enter email and password
4. User receives confirmation email

### Assigning Roles

**Via SQL Editor** ([Supabase Dashboard](https://supabase.com/dashboard) → SQL Editor):

```sql
-- Find user ID
SELECT id, email FROM auth.users WHERE email = 'user@example.com';

-- Assign role
INSERT INTO public.user_roles (user_id, role)
VALUES ('USER-UUID-HERE', 'admin');  -- or 'moderator' or 'user'
```

**Via Table Editor:**
1. Go to **Table Editor** → `user_roles`
2. Click **"Insert Row"**
3. Enter `user_id` and `role`
4. Save

### Available Roles

| Role | Access Level |
|------|--------------|
| `admin` | Full access to all features including Admin Panel |
| `moderator` | Access to admin features, limited config |
| `user` | Standard user access |

### Removing Users

**Soft Delete (Recommended):**
```sql
-- Remove role (user can still log in but has no permissions)
DELETE FROM user_roles WHERE user_id = 'USER-UUID';
```

**Hard Delete:**
```sql
-- Delete from auth.users (cascades to profiles)
-- This is PERMANENT
DELETE FROM auth.users WHERE id = 'USER-UUID';
```

---

## ⚙️ Feature Configuration

### Current Method (Database)

Features are controlled by code. To enable/disable features, modify in **Lovable.dev**:

1. `src/App.tsx` - Route definitions
2. `src/components/layout/AppSidebar.tsx` - Sidebar items

### Coming: Admin Panel Config (Sprint 2)

Will add `app_config` table with settings like:

| Key | Value | Description |
|-----|-------|-------------|
| `features.clients_enabled` | `true` | Show Clients module |
| `features.meetings_enabled` | `true` | Show Meetings module |
| `features.knowledge_enabled` | `true` | Show Knowledge Base |
| `features.ai_enabled` | `true` | Show AI Agents (admin only) |

---

## 🎨 Branding Configuration (via Lovable.dev)

### Update App Name

Open the project in **Lovable.dev** and modify:

**File: `index.html`**
```html
<title>Your App Name</title>
<meta property="og:title" content="Your App Name" />
```

**File: `src/components/layout/AppSidebar.tsx`**
```tsx
<span className="text-sm font-semibold">Your App Name</span>
```

### Update Logo

1. Create logo file (SVG or PNG)
2. Upload to **Supabase Storage** or `src/assets/logo.svg`
3. Import in components:

```tsx
import logo from '@/assets/logo.svg';
<img src={logo} alt="Logo" />
```

### Update Colors

**File: `src/index.css`** (edit in Lovable.dev)

```css
:root {
  --primary: 222.2 47.4% 11.2%;        /* Primary color */
  --primary-foreground: 210 40% 98%;   /* Text on primary */
  --accent: 210 40% 96.1%;             /* Accent color */
  /* ... other color variables */
}
```

### Update Favicon

1. Create favicon (`.ico` or `.png`)
2. Add to `public/favicon.ico`
3. Update `index.html`:

```html
<link rel="icon" href="/favicon.ico" type="image/x-icon">
```

---

## 🔌 Integration Setup (Supabase Edge Function Secrets)

Configure all API keys in **Supabase Dashboard** → Settings → Edge Function Secrets.

### OpenAI (AI Features)

1. Get API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. In **Supabase Dashboard** → Settings → Edge Function Secrets
3. Add: `OPENAI_API_KEY=sk-proj-...`

**Test:** Go to AI Chat, send a message

### Zoom (Meeting Sync)

1. Create app at [Zoom Marketplace](https://marketplace.zoom.us/)
2. Choose "Server-to-Server OAuth"
3. Add scopes: `meeting:read:admin`, `recording:read:admin`
4. Get credentials and add to **Edge Function Secrets**:

```
ZOOM_CLIENT_ID=...
ZOOM_CLIENT_SECRET=...
ZOOM_ACCOUNT_ID=...
```

### Google OAuth (Sign-in)

1. Create project in [Google Cloud Console](https://console.cloud.google.com)
2. Enable Google+ API
3. Create OAuth 2.0 credentials
4. Add redirect URI: `https://YOUR-PROJECT.supabase.co/auth/v1/callback`
5. In **Supabase Dashboard** → Authentication → Providers → Google:
   - Enable provider
   - Add Client ID and Secret

### SendGrid (Emails)

1. Create account at [SendGrid](https://sendgrid.com)
2. Create API key
3. Add to **Edge Function Secrets**: `SENDGRID_API_KEY=...`
4. Verify sender domain

### Slack (Notifications)

1. Create Slack app at [api.slack.com](https://api.slack.com)
2. Create Incoming Webhook
3. Add to **Edge Function Secrets**: `SLACK_WEBHOOK_URL=https://hooks.slack.com/...`

---

## 📊 Monitoring (Supabase Dashboard)

### User Activity

**Via Supabase Dashboard:**

1. **Authentication** → **Users** - See login activity
2. **Logs** → **Auth Logs** - Detailed auth events

**Via SQL Editor:**

```sql
-- Recent logins
SELECT 
  email,
  last_sign_in_at,
  created_at
FROM auth.users
ORDER BY last_sign_in_at DESC
LIMIT 20;
```

### Database Usage

**Via SQL Editor:**
```sql
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC;
```

### Edge Function Logs

1. **Supabase Dashboard** → **Edge Functions**
2. Select function
3. View **Logs** tab

---

## 🔒 Security Checklist

### Regular Tasks

- [ ] Review user list monthly
- [ ] Remove inactive users
- [ ] Rotate API keys quarterly
- [ ] Check RLS policies after schema changes
- [ ] Monitor failed login attempts

### RLS Verification

**Via SQL Editor:**
```sql
-- Check all tables have RLS enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
```

### API Key Rotation

1. Generate new key in provider dashboard
2. Update in **Supabase Dashboard** → Edge Function Secrets
3. Verify functionality
4. Revoke old key

---

## 🐛 Troubleshooting

### User Can't Log In

1. Check user exists in **Authentication** → **Users**
2. Verify email is confirmed
3. Check password is correct
4. Review **Logs** → **Auth Logs** for errors

### User Missing Features

1. Verify role in **Table Editor** → `user_roles`
2. Check sidebar filtering logic in code
3. Confirm feature is enabled

### API Errors

1. Check **Edge Functions** → Logs
2. Verify API keys are set correctly in **Edge Function Secrets**
3. Check API provider dashboard for issues

### Database Errors

1. Check **Logs** → **Database Logs**
2. Verify RLS policies in **Authentication** → **Policies**
3. Check for constraint violations

---

## 📚 Quick Reference

### Supabase Dashboard Links

Replace `[PROJECT]` with your project ID:

| Page | URL |
|------|-----|
| **Table Editor** | `https://supabase.com/dashboard/project/[PROJECT]/editor` |
| **Auth Users** | `https://supabase.com/dashboard/project/[PROJECT]/auth/users` |
| **Auth Providers** | `https://supabase.com/dashboard/project/[PROJECT]/auth/providers` |
| **Edge Functions** | `https://supabase.com/dashboard/project/[PROJECT]/functions` |
| **Edge Function Secrets** | `https://supabase.com/dashboard/project/[PROJECT]/settings/functions` |
| **Storage** | `https://supabase.com/dashboard/project/[PROJECT]/storage` |
| **Database Logs** | `https://supabase.com/dashboard/project/[PROJECT]/logs` |
| **SQL Editor** | `https://supabase.com/dashboard/project/[PROJECT]/sql/new` |

### Common SQL Queries

```sql
-- Count users by role
SELECT role, COUNT(*) 
FROM user_roles 
GROUP BY role;

-- List admins
SELECT p.email, p.full_name, ur.role
FROM profiles p
JOIN user_roles ur ON p.id = ur.user_id
WHERE ur.role = 'admin';

-- Recent activity
SELECT * FROM clients ORDER BY created_at DESC LIMIT 10;
```

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

**Questions?** Check the [README](./README.md) or platform documentation.
