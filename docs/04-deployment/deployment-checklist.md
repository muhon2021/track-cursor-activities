# CollabAi Deployment Checklist

![Built with Lovable](https://img.shields.io/badge/Built%20with-Lovable-ff69b4?style=flat-square)
![Backend: Supabase](https://img.shields.io/badge/Backend-Supabase-3ECF8E?style=flat-square)

> **Complete checklist for deploying CollabAi to a new client**
>
> 🚀 **Deployment Platform:** [Lovable.dev](https://lovable.dev)  
> 🔧 **Backend Platform:** [Supabase](https://supabase.com)

---

## ⚠️ Important: No CLI Required

This deployment is done entirely through web interfaces:

- ✅ **Lovable.dev** - Frontend development & publishing
- ✅ **Supabase Dashboard** - Backend configuration
- ❌ No terminal or CLI commands needed
- ❌ No local development environment

---

## 📋 Prerequisites

### Required Accounts

- [ ] **Lovable.dev account** - [Sign up here](https://lovable.dev)
- [ ] **Supabase account** - Auto-provisioned by Lovable or [sign up](https://supabase.com)

### Optional API Keys

- [ ] OpenAI API key (for AI features)
- [ ] Zoom credentials (for meeting sync)
- [ ] Google OAuth credentials (for Google sign-in)
- [ ] SendGrid API key (for email notifications)

---

## 📋 Pre-Deployment

### Infrastructure (via Lovable)

- [ ] Project created/forked in [Lovable.dev](https://lovable.dev)
- [ ] Supabase project connected (auto-provisioned or external)
- [ ] GitHub repo linked (optional)

### Access Credentials

- [ ] Lovable.dev login for admin
- [ ] Supabase Dashboard access
- [ ] API keys collected (OpenAI, Zoom, etc.)

---

## 🗄️ Database Setup (Supabase Dashboard)

### Tables Verified

Open **Supabase Dashboard** → Table Editor and verify:

- [ ] `profiles` - User profiles
- [ ] `user_roles` - Role assignments
- [ ] `roles` - Role definitions
- [ ] `clients` - Client data
- [ ] `meetings` - Meeting records
- [ ] `zoom_files` - Zoom recordings
- [ ] `knowledge_entries` - Knowledge articles
- [ ] `knowledge_categories` - Categories
- [ ] `ai_agents` - AI configurations
- [ ] `ai_agent_runs` - AI execution logs
- [ ] `ai_chat_history` - Chat history
- [ ] `embeddings` - Vector embeddings
- [ ] `feedback` - User feedback
- [ ] `notifications` - Notifications

### Security (Supabase Dashboard → Authentication → Policies)

- [ ] RLS enabled on all tables
- [ ] Policies configured correctly
- [ ] `has_role()` function exists
- [ ] Service role key secured

---

## 🔐 Authentication (Supabase Dashboard)

### Supabase Auth Config

Go to **Supabase Dashboard** → Authentication → URL Configuration:

- [ ] Site URL configured (`https://your-app.lovable.app` or custom domain)
- [ ] Redirect URLs added
- [ ] Email templates customized (optional)
- [ ] Email confirmation setting decided

### OAuth Providers (Optional)

Go to **Supabase Dashboard** → Authentication → Providers:

- [ ] Google OAuth configured
- [ ] Redirect URI added to Google Cloud Console
- [ ] Provider enabled in Supabase

### Admin Account

- [ ] Admin user created (via app signup or Supabase Dashboard)
- [ ] Admin role assigned in `user_roles` table
- [ ] Admin can access `/admin` route

**Assign admin role via SQL Editor:**
```sql
-- Find user ID
SELECT id, email FROM auth.users WHERE email = 'admin@example.com';

-- Assign admin role
INSERT INTO public.user_roles (user_id, role)
VALUES ('USER-UUID-HERE', 'admin');
```

---

## 🎨 Branding

### Visual Identity

- [ ] Company name updated
- [ ] Logo uploaded (via Supabase Storage)
- [ ] Favicon updated
- [ ] Primary colors configured
- [ ] App title in `index.html` updated

### Content

- [ ] Welcome message customized
- [ ] Email templates branded (if using)
- [ ] Demo credentials removed/updated

---

## ⚙️ Feature Configuration

### Core Modules

- [ ] Clients module enabled/disabled
- [ ] Meetings module enabled/disabled
- [ ] Knowledge Base enabled/disabled
- [ ] AI Agents enabled/disabled
- [ ] Feedback enabled/disabled

### Navigation

- [ ] Sidebar items match enabled features
- [ ] Admin-only items hidden from regular users

---

## 🔌 Integrations (Supabase Edge Function Secrets)

Configure secrets in **Supabase Dashboard** → Settings → Edge Function Secrets:

### AI (OpenAI)

- [ ] `OPENAI_API_KEY` set
- [ ] API key has credits
- [ ] AI chat tested

### Zoom (Optional)

- [ ] Zoom Server-to-Server OAuth app created at [marketplace.zoom.us](https://marketplace.zoom.us)
- [ ] `ZOOM_CLIENT_ID` set
- [ ] `ZOOM_CLIENT_SECRET` set
- [ ] `ZOOM_ACCOUNT_ID` set
- [ ] Required scopes added (`meeting:read:admin`, `recording:read:admin`)

### Google Drive (Optional)

- [ ] Google Cloud project created at [console.cloud.google.com](https://console.cloud.google.com)
- [ ] `GOOGLE_CLIENT_ID` set
- [ ] `GOOGLE_CLIENT_SECRET` set
- [ ] Drive API enabled

### Email (Optional)

- [ ] SendGrid account created at [sendgrid.com](https://sendgrid.com)
- [ ] `SENDGRID_API_KEY` set
- [ ] Sender domain verified

### Slack (Optional)

- [ ] Slack webhook created at [api.slack.com](https://api.slack.com)
- [ ] `SLACK_WEBHOOK_URL` set

---

## 📦 Storage Buckets (Supabase Dashboard → Storage)

- [ ] `user-knowledge` bucket created (private)
- [ ] `meeting-recordings` bucket created (private)
- [ ] `knowledge-files` bucket created (private)
- [ ] Bucket policies configured

---

## 🧪 Testing

### Authentication

- [ ] Email/password signup works
- [ ] Email/password login works
- [ ] Google OAuth works (if enabled)
- [ ] Logout works
- [ ] Password reset works

### Core Features

- [ ] Dashboard loads with KPIs
- [ ] Clients CRUD operations work
- [ ] Meetings CRUD operations work
- [ ] Knowledge Base accessible
- [ ] AI Chat responds (if configured)
- [ ] Notifications appear

### Access Control

- [ ] Regular users see only allowed items
- [ ] Admins can access `/admin`
- [ ] AI routes protected (admin only)
- [ ] RLS prevents unauthorized data access

### Responsive

- [ ] Desktop layout works
- [ ] Tablet layout works
- [ ] Mobile layout works

---

## 🚀 Publishing (via Lovable)

### Lovable Publish

1. Click **"Publish"** button in Lovable (top right)
2. Wait for build to complete
3. Verify preview URL works

- [ ] Build completed successfully
- [ ] Preview URL accessible
- [ ] All features work in preview

### Custom Domain (Optional)

Go to **Lovable** → Settings → Domains:

- [ ] Domain purchased/available
- [ ] Custom domain added in Lovable
- [ ] DNS records configured:
  - `A` record or `CNAME` as instructed by Lovable
- [ ] SSL certificate provisioned (automatic)
- [ ] Custom domain verified

### Post-Publish

- [ ] Production URL tested
- [ ] All features work on production
- [ ] No console errors
- [ ] Update Supabase Site URL to production URL

---

## 👥 User Onboarding

### Initial Users

- [ ] Admin users invited
- [ ] Roles assigned correctly (in Supabase Table Editor → `user_roles`)
- [ ] Login credentials shared securely

### Documentation

- [ ] User guide provided (if needed)
- [ ] Admin guide provided ([ADMIN-GUIDE.md](./ADMIN-GUIDE.md))
- [ ] Support contact shared

---

## 📊 Monitoring (Supabase Dashboard)

### Supabase Logs

- [ ] Database logs monitored (Database → Logs)
- [ ] Auth logs reviewed (Authentication → Logs)
- [ ] Edge function logs checked (Edge Functions → Logs)

### Performance

- [ ] Page load times acceptable
- [ ] No memory leaks
- [ ] API response times normal

---

## 📝 Handoff

### Client Deliverables

- [ ] Production URL shared
- [ ] Admin credentials delivered securely
- [ ] Documentation links provided
- [ ] Support process defined

### Internal Documentation

- [ ] Deployment documented
- [ ] Client-specific configs noted
- [ ] Any customizations documented

---

## ✅ Sign-Off

| Check | Completed | Notes |
|-------|-----------|-------|
| Infrastructure (Lovable + Supabase) | ☐ | |
| Database | ☐ | |
| Authentication | ☐ | |
| Branding | ☐ | |
| Features | ☐ | |
| Integrations | ☐ | |
| Testing | ☐ | |
| Publishing | ☐ | |
| User Onboarding | ☐ | |

**Deployed By:** _______________  
**Date:** _______________  
**Client:** _______________  
**Production URL:** _______________

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

**🎉 Deployment Complete!**
