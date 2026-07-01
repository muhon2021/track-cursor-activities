# 🚀 Production Deployment Guide - CollabAI Framework

> **Complete step-by-step guide to deploy the SJ Innovation Framework V1 to production**

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Database Setup](#database-setup)
3. [Edge Functions Deployment](#edge-functions-deployment)
4. [Environment Variables](#environment-variables)
5. [Frontend Deployment](#frontend-deployment)
6. [Testing & Verification](#testing--verification)
7. [Post-Deployment](#post-deployment)

---

## 🔧 Prerequisites

### Required Accounts & API Keys

- [ ] **Supabase Account** - https://supabase.com
- [ ] **OpenAI API Key** - https://platform.openai.com/api-keys (CRITICAL for AI features)
- [ ] **SendGrid Account** - https://sendgrid.com (for email notifications)
- [ ] **Zoom Developer Account** - https://marketplace.zoom.us (optional, for Zoom integration)
- [ ] **Google Cloud Project** - https://console.cloud.google.com (optional, for Drive integration)
- [ ] **Slack Webhook** - https://api.slack.com/messaging/webhooks (optional, for Slack notifications)

### Required Tools

- [ ] Git
- [ ] Node.js 18+ and npm
- [ ] Modern web browser
- [ ] Text editor

---

## 💾 Database Setup

### Step 1: Run Migrations

**Option A: Using Supabase Dashboard (Recommended)**

1. Go to your Supabase project SQL Editor:
   ```
   https://supabase.com/dashboard/project/tjkqvbxtziheggurtvcz/sql/new
   ```

2. Run migrations in order:

   **Migration 1: Create match_embeddings function**
   - Open: `supabase/migrations/20251231183400_create_match_embeddings_function.sql`
   - Copy entire content
   - Paste in SQL Editor
   - Click "Run"

   **Migration 2: Insert test data**
   - Open: `supabase/migrations/20251231183500_insert_test_data.sql`
   - Copy entire content
   - Paste in SQL Editor
   - Click "Run"

3. Verify migrations:
   ```sql
   -- Check if match_embeddings function exists
   SELECT routine_name
   FROM information_schema.routines
   WHERE routine_name = 'match_embeddings';

   -- Check test data
   SELECT COUNT(*) FROM clients;
   SELECT COUNT(*) FROM knowledge_entries;
   SELECT COUNT(*) FROM ai_agents;
   ```

**Option B: Using Local Supabase CLI** (if installed)

```bash
# Apply migrations
supabase db push

# Or reset and reapply all
supabase db reset
```

### Step 2: Verify Database Tables

Run this query to verify all tables exist:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Expected tables:
- ai_agent_runs
- ai_agents
- ai_chat_history
- audit_logs
- clients
- embeddings
- feedback
- knowledge_categories
- knowledge_entries
- knowledge_files
- knowledge_sources
- meeting_assignments
- meeting_categorizations
- meeting_transcripts
- meetings
- notifications
- profiles
- roles
- user_agent_personalizations
- user_knowledge_files
- user_knowledge_sources
- user_roles
- zoom_files

---

## ⚡ Edge Functions Deployment

### Option 1: Manual Upload via Supabase Dashboard

For each function in `supabase/functions/`:

1. Go to Edge Functions: https://supabase.com/dashboard/project/tjkqvbxtziheggurtvcz/functions

2. Click "New Function"

3. Enter function details:
   - **Name**: (function name, e.g., "ai-chat-assistant")
   - **Code**: Copy content from `supabase/functions/[name]/index.ts`

4. Click "Deploy"

5. Repeat for all 24 functions

**Functions List (in priority order):**

**Critical (Deploy First):**
- validate-api-key
- send-notification
- ai-chat-assistant
- semantic-search
- generate-embeddings

**Important:**
- generate-meeting-summary
- run-ai-agent
- api-v1-clients
- api-v1-meetings
- send-email

**Optional (if using features):**
- sync-zoom-files
- zoom-transcript-processing
- auto-embed-meetings
- categorize-meeting
- google-drive-sync
- user-knowledge-upload
- user-knowledge-process
- auto-embed-knowledge-files
- unified-knowledge-search
- generate-business-doc
- send-feedback-notification
- audit-log-writer

### Option 2: Bulk Deploy Script

Create a file `deploy-functions.sh`:

```bash
#!/bin/bash

# List of all functions to deploy
FUNCTIONS=(
  "validate-api-key"
  "ai-chat-assistant"
  "semantic-search"
  "generate-embeddings"
  "generate-meeting-summary"
  "run-ai-agent"
  "send-email"
  "send-notification"
  "api-v1-clients"
  "api-v1-meetings"
  "sync-zoom-files"
  "zoom-transcript-processing"
  "auto-embed-meetings"
  "categorize-meeting"
  "google-drive-sync"
  "user-knowledge-upload"
  "user-knowledge-process"
  "auto-embed-knowledge-files"
  "unified-knowledge-search"
  "generate-business-doc"
  "send-feedback-notification"
  "audit-log-writer"
  "google-drive-upload"
  "user-knowledge-drive-sync"
)

# Deploy each function
for func in "${FUNCTIONS[@]}"; do
  echo "Deploying $func..."
  npx supabase functions deploy "$func" --project-ref tjkqvbxtziheggurtvcz
done

echo "✅ All functions deployed!"
```

Run:
```bash
chmod +x deploy-functions.sh
./deploy-functions.sh
```

---

## 🔐 Environment Variables

### Step 1: Set Edge Function Secrets

Go to: https://supabase.com/dashboard/project/tjkqvbxtziheggurtvcz/settings/functions

Click "Secrets" and add:

#### **CRITICAL - AI Services**
```
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx
```
Get from: https://platform.openai.com/api-keys

#### **Optional - Alternative AI**
```
GEMINI_API_KEY=xxxxxxxxxxxxx
```
Get from: https://aistudio.google.com/app/apikey

#### **Email Notifications**
```
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
```
Get from: https://app.sendgrid.com/settings/api_keys

#### **Zoom Integration** (if using)
```
ZOOM_CLIENT_ID=xxxxxxxxxxxxx
ZOOM_CLIENT_SECRET=xxxxxxxxxxxxx
ZOOM_ACCOUNT_ID=xxxxxxxxxxxxx
```
Get from: https://marketplace.zoom.us/

#### **Google Drive** (if using)
```
GOOGLE_CLIENT_ID=xxxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxxxxxxxxxxx
GOOGLE_API_KEY=xxxxxxxxxxxxx
```
Get from: https://console.cloud.google.com/

#### **Slack Notifications** (optional)
```
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxxxx
```
Get from: https://api.slack.com/messaging/webhooks

#### **Auto-Set by Supabase** (verify they exist)
```
SUPABASE_URL=https://tjkqvbxtziheggurtvcz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
```

### Step 2: Frontend Environment Variables

Update `.env` file:

```env
VITE_SUPABASE_PROJECT_ID="tjkqvbxtziheggurtvcz"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
VITE_SUPABASE_URL="https://tjkqvbxtziheggurtvcz.supabase.co"
```

---

## 🌐 Frontend Deployment

### Option 1: Vercel (Recommended)

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Deploy:**
   ```bash
   vercel
   ```

3. **Set Environment Variables in Vercel:**
   - Go to Project Settings → Environment Variables
   - Add all `VITE_*` variables

### Option 2: Netlify

1. **Install Netlify CLI:**
   ```bash
   npm install -g netlify-cli
   ```

2. **Deploy:**
   ```bash
   netlify deploy --prod
   ```

3. **Set Environment Variables:**
   - Go to Site Settings → Environment Variables
   - Add all `VITE_*` variables

### Option 3: Build & Deploy Manually

```bash
# Build production bundle
npm run build

# Upload dist/ folder to your hosting provider
```

---

## ✅ Testing & Verification

### Step 1: Database Test

```sql
-- Verify test data
SELECT * FROM clients LIMIT 5;
SELECT * FROM knowledge_entries LIMIT 5;
SELECT * FROM ai_agents;

-- Test match_embeddings function
SELECT match_embeddings(
  ARRAY[0.1, 0.2, ...]::vector(1536),
  0.7,
  5
);
```

### Step 2: Edge Functions Test

```bash
# Test validate-api-key
curl -X POST \
  https://tjkqvbxtziheggurtvcz.supabase.co/functions/v1/validate-api-key \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "test-key-12345678901234567890"}'

# Expected: {"valid":true,"message":"API key is valid"}
```

### Step 3: Frontend Test

1. **Visit your deployed URL**
2. **Test authentication:**
   - Sign up with email
   - Sign up with Google
3. **Test navigation:**
   - Dashboard
   - Clients
   - Meetings
   - Knowledge Base
   - AI Chat
4. **Test CRUD operations:**
   - Create a client
   - Edit a client
   - Delete a client

### Step 4: AI Features Test

1. **AI Chat:**
   - Go to AI Chat page
   - Send a message
   - Verify response

2. **Semantic Search:**
   - Search in Knowledge Base
   - Verify results

---

## 🎯 Post-Deployment

### Step 1: Monitoring

- **Edge Functions Logs:**
  https://supabase.com/dashboard/project/tjkqvbxtziheggurtvcz/logs/edge-functions

- **Database Activity:**
  https://supabase.com/dashboard/project/tjkqvbxtziheggurtvcz/logs/postgres-logs

### Step 2: Security Checklist

- [ ] RLS policies enabled on all tables
- [ ] API keys secured (not in client code)
- [ ] CORS configured properly
- [ ] Rate limiting enabled
- [ ] SSL/HTTPS enforced

### Step 3: Performance Optimization

- [ ] Database indexes created
- [ ] CDN configured for static assets
- [ ] Image optimization enabled
- [ ] Caching configured

### Step 4: Backup Strategy

- [ ] Enable automatic Supabase backups
- [ ] Export database schema
- [ ] Document recovery procedures

---

## 🚨 Troubleshooting

### Edge Functions Return 500

1. Check function logs
2. Verify environment variables
3. Test function locally
4. Check database connectivity

### AI Features Not Working

1. Verify `OPENAI_API_KEY` is set
2. Check API key has credits
3. Test OpenAI API directly
4. Check function logs

### Database Connection Issues

1. Verify connection strings
2. Check RLS policies
3. Test with service role key
4. Review database logs

---

## 📊 Deployment Checklist

### Pre-Deployment
- [ ] All migrations created
- [ ] Test data prepared
- [ ] Environment variables ready
- [ ] API keys obtained

### Deployment
- [ ] Database migrations applied
- [ ] Edge functions deployed
- [ ] Environment variables set
- [ ] Frontend deployed

### Post-Deployment
- [ ] Database tested
- [ ] Edge functions tested
- [ ] Frontend tested
- [ ] Monitoring configured
- [ ] Backups enabled

### Production Ready
- [ ] Security audit complete
- [ ] Performance optimized
- [ ] Documentation updated
- [ ] Team trained

---

## 📞 Support

- **Documentation:** `/docs` folder
- **Edge Functions Guide:** `EDGE_FUNCTIONS_DEPLOYMENT.md`
- **Architecture:** `docs/sj-innovation-framework_architecture.md`

---

**Last Updated:** 2025-12-31
**Framework Version:** V1.0
**Status:** Production Ready
