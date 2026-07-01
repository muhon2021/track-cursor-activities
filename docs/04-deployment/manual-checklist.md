# 📋 Manual Deployment Checklist - CollabAI Framework

> **For deploying edge functions and migrations via Supabase Dashboard (No CLI required)**

---

## 🎯 Overview

This checklist guides you through deploying all 24 edge functions and 2 database migrations manually using the Supabase Dashboard.

**Total Time:** ~2-3 hours
**Project URL:** https://supabase.com/dashboard/project/tjkqvbxtziheggurtvcz

---

## ✅ Pre-Deployment Checklist

Before starting, ensure you have:

- [ ] Access to Supabase Dashboard: https://supabase.com/dashboard/project/tjkqvbxtziheggurtvcz
- [ ] OPENAI_API_KEY ready (critical for AI features)
- [ ] Optional API keys: Zoom, Google, SendGrid, Slack
- [ ] All edge function files in `supabase/functions/` directory
- [ ] Migration files in `supabase/migrations/` directory

---

## 📦 STEP 1: Deploy Database Migrations

**Why first?** Edge functions depend on database tables and functions.

### Migration 1: Create match_embeddings Function

**File:** `supabase/migrations/20251231183400_create_match_embeddings_function.sql`

1. Go to: https://supabase.com/dashboard/project/tjkqvbxtziheggurtvcz/sql/new
2. Click **"New Query"**
3. Open the migration file in your code editor
4. Copy the entire SQL content
5. Paste into Supabase SQL Editor
6. Click **"Run"** or press `Ctrl+Enter`
7. Verify success (should show "Success. No rows returned")

**What it does:**
- Enables pgvector extension for vector search
- Creates `match_embeddings()` function for semantic search
- Creates vector index on embeddings table

**Verification:**
```sql
-- Run this to verify function exists
SELECT routine_name FROM information_schema.routines
WHERE routine_name = 'match_embeddings';
-- Should return 1 row
```

- [ ] Migration 1 completed successfully

---

### Migration 2: Insert Test Data

**File:** `supabase/migrations/20251231183500_insert_test_data.sql`

1. Go to: https://supabase.com/dashboard/project/tjkqvbxtziheggurtvcz/sql/new
2. Click **"New Query"**
3. Open the migration file in your code editor
4. Copy the entire SQL content
5. Paste into Supabase SQL Editor
6. Click **"Run"** or press `Ctrl+Enter`
7. Verify success

**What it creates:**
- 5 test clients (Acme Corp, TechStart Inc, Global Solutions, StartupHub, Enterprise Co)
- 3 knowledge entries (Quick Start Guide, API Documentation, Best Practices)
- 5 knowledge categories (Getting Started, API, Guides, Tutorials, Reference)
- 3 AI agents (Email Draft Assistant, Meeting Summarizer, SOW Generator)

**Verification:**
```sql
-- Check if test data exists
SELECT COUNT(*) FROM clients; -- Should return 5
SELECT COUNT(*) FROM knowledge_entries; -- Should return 3
SELECT COUNT(*) FROM knowledge_categories; -- Should return 5
SELECT COUNT(*) FROM ai_agents; -- Should return 3
```

- [ ] Migration 2 completed successfully
- [ ] Test data verified

---

## 🔧 STEP 2: Set Environment Variables

**Location:** https://supabase.com/dashboard/project/tjkqvbxtziheggurtvcz/settings/functions

1. Go to **Settings** → **Edge Functions** → **Secrets**
2. Add each environment variable by clicking **"Add new secret"**

### Required Variables (CRITICAL)

```bash
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx
```

**Without this:** AI chat, semantic search, embeddings, meeting summaries won't work

- [ ] OPENAI_API_KEY set

---

### Optional Variables (Enable Specific Features)

**Zoom Integration:**
```bash
ZOOM_CLIENT_ID=xxxxxxxxxxxxx
ZOOM_CLIENT_SECRET=xxxxxxxxxxxxx
ZOOM_ACCOUNT_ID=xxxxxxxxxxxxx
```

- [ ] Zoom credentials set (if using Zoom features)

**Google OAuth & Drive:**
```bash
GOOGLE_CLIENT_ID=xxxxxxxxxxxxx
GOOGLE_CLIENT_SECRET=xxxxxxxxxxxxx
GOOGLE_API_KEY=xxxxxxxxxxxxx
```

- [ ] Google credentials set (if using Google Drive sync)

**SendGrid (Email):**
```bash
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
```

- [ ] SendGrid API key set (if using email features)

**Slack (Notifications):**
```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxxxx
```

- [ ] Slack webhook set (if using Slack notifications)

---

### Auto-Set Variables (Verify These Exist)

These should already be set by Supabase:

```bash
SUPABASE_URL=https://tjkqvbxtziheggurtvcz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
```

- [ ] SUPABASE_URL exists
- [ ] SUPABASE_SERVICE_ROLE_KEY exists

---

## 🚀 STEP 3: Deploy Edge Functions (24 Functions)

**Location:** https://supabase.com/dashboard/project/tjkqvbxtziheggurtvcz/functions

For each function below:

1. Go to Edge Functions page
2. Click **"Create a new function"**
3. Enter function name (exactly as shown)
4. Open the corresponding `index.ts` file from `supabase/functions/[name]/index.ts`
5. Copy the entire file content
6. Paste into the function editor
7. Click **"Deploy"**
8. Wait for deployment to complete (green checkmark)

**Important:** Deploy in the order shown below (Foundation first)

---

### Foundation Functions (4) - DEPLOY FIRST

| # | Function Name | File Path | Deploy Status |
|---|---------------|-----------|---------------|
| 1 | `validate-api-key` | `supabase/functions/validate-api-key/index.ts` | [ ] |
| 2 | `audit-log-writer` | `supabase/functions/audit-log-writer/index.ts` | [ ] |
| 3 | `send-email` | `supabase/functions/send-email/index.ts` | [ ] |
| 4 | `send-notification` | `supabase/functions/send-notification/index.ts` | [ ] |

**Dependencies:** None
**Required Env Vars:** SENDGRID_API_KEY (optional)

---

### AI Functions (6)

| # | Function Name | File Path | Deploy Status |
|---|---------------|-----------|---------------|
| 5 | `ai-chat-assistant` | `supabase/functions/ai-chat-assistant/index.ts` | [ ] |
| 6 | `semantic-search` | `supabase/functions/semantic-search/index.ts` | [ ] |
| 7 | `run-ai-agent` | `supabase/functions/run-ai-agent/index.ts` | [ ] |
| 8 | `generate-embeddings` | `supabase/functions/generate-embeddings/index.ts` | [ ] |
| 9 | `generate-meeting-summary` | `supabase/functions/generate-meeting-summary/index.ts` | [ ] |
| 10 | `generate-business-doc` | `supabase/functions/generate-business-doc/index.ts` | [ ] |

**Dependencies:** Database tables (ai_chat_history, embeddings, ai_agents)
**Required Env Vars:** OPENAI_API_KEY (CRITICAL)

---

### Meeting Functions (5)

| # | Function Name | File Path | Deploy Status |
|---|---------------|-----------|---------------|
| 11 | `sync-zoom-files` | `supabase/functions/sync-zoom-files/index.ts` | [ ] |
| 12 | `zoom-transcript-processing` | `supabase/functions/zoom-transcript-processing/index.ts` | [ ] |
| 13 | `auto-embed-meetings` | `supabase/functions/auto-embed-meetings/index.ts` | [ ] |
| 14 | `categorize-meeting` | `supabase/functions/categorize-meeting/index.ts` | [ ] |
| 15 | `api-v1-meetings` | `supabase/functions/api-v1-meetings/index.ts` | [ ] |

**Dependencies:** Database tables (meetings, zoom_files)
**Required Env Vars:** ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, ZOOM_ACCOUNT_ID, OPENAI_API_KEY

---

### Knowledge Base Functions (7)

| # | Function Name | File Path | Deploy Status |
|---|---------------|-----------|---------------|
| 16 | `google-drive-sync` | `supabase/functions/google-drive-sync/index.ts` | [ ] |
| 17 | `google-drive-upload` | `supabase/functions/google-drive-upload/index.ts` | [ ] |
| 18 | `user-knowledge-upload` | `supabase/functions/user-knowledge-upload/index.ts` | [ ] |
| 19 | `user-knowledge-drive-sync` | `supabase/functions/user-knowledge-drive-sync/index.ts` | [ ] |
| 20 | `user-knowledge-process` | `supabase/functions/user-knowledge-process/index.ts` | [ ] |
| 21 | `auto-embed-knowledge-files` | `supabase/functions/auto-embed-knowledge-files/index.ts` | [ ] |
| 22 | `unified-knowledge-search` | `supabase/functions/unified-knowledge-search/index.ts` | [ ] |

**Dependencies:** Database tables (knowledge_entries, knowledge_files, embeddings)
**Required Env Vars:** GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, OPENAI_API_KEY

---

### Client Functions (1)

| # | Function Name | File Path | Deploy Status |
|---|---------------|-----------|---------------|
| 23 | `api-v1-clients` | `supabase/functions/api-v1-clients/index.ts` | [ ] |

**Dependencies:** Database table (clients)
**Required Env Vars:** None

---

### Feedback Functions (1)

| # | Function Name | File Path | Deploy Status |
|---|---------------|-----------|---------------|
| 24 | `send-feedback-notification` | `supabase/functions/send-feedback-notification/index.ts` | [ ] |

**Dependencies:** Database table (feedback)
**Required Env Vars:** None

---

## ✅ STEP 4: Verify Deployment

### 4.1 Check Function List

1. Go to: https://supabase.com/dashboard/project/tjkqvbxtziheggurtvcz/functions
2. Verify all 24 functions are listed
3. Check that each shows "Active" status with green indicator

- [ ] All 24 functions show "Active" status

---

### 4.2 Test Foundation Function

**Test validate-api-key:**

1. Go to: https://supabase.com/dashboard/project/tjkqvbxtziheggurtvcz/functions/validate-api-key
2. Click **"Invoke"** tab
3. Enter test payload:
```json
{
  "apiKey": "test-key-12345678901234567890"
}
```
4. Click **"Send Request"**
5. Should see response:
```json
{
  "valid": true,
  "message": "API key is valid"
}
```

- [ ] validate-api-key test passed

---

### 4.3 Test AI Function

**Test ai-chat-assistant:**

**Prerequisites:** OPENAI_API_KEY must be set

1. Go to ai-chat-assistant function
2. Click **"Invoke"** tab
3. Enter test payload:
```json
{
  "message": "Hello, how can you help me?",
  "session_id": "test-session-123",
  "user_id": "00000000-0000-0000-0000-000000000000"
}
```
4. Click **"Send Request"**
5. Should see AI response

- [ ] ai-chat-assistant test passed
- [ ] AI response received

---

### 4.4 Check Function Logs

1. For each deployed function, click on it
2. Go to **"Logs"** tab
3. Check for any errors or warnings
4. Common errors:
   - Missing environment variables
   - Database connection issues
   - Missing tables/columns

- [ ] No critical errors in logs

---

## 📊 STEP 5: Run Verification Script (Optional)

If you have bash/curl available:

```bash
chmod +x verify-deployment.sh
./verify-deployment.sh
```

This tests:
- Edge function endpoints
- Database connectivity
- Table accessibility

- [ ] Verification script passed

---

## 🧪 STEP 6: Test Frontend Integration

### 6.1 Test Authentication

1. Go to your Lovable preview URL or deployed frontend
2. Click **"Sign in with Google"** or use email/password
3. Verify redirect to dashboard
4. Check Supabase Dashboard → Authentication → Users
5. Verify user appears in the list

- [ ] Authentication working
- [ ] User created in database

---

### 6.2 Test CRUD Operations

**Test Clients:**
1. Navigate to `/clients`
2. Click **"Add Client"**
3. Fill form and submit
4. Verify client appears in list
5. Edit and delete to test full CRUD

- [ ] Create client works
- [ ] Read clients works
- [ ] Update client works
- [ ] Delete client works

**Test Meetings:**
1. Navigate to `/meetings`
2. Create a new meeting
3. Verify it appears in list

- [ ] Create meeting works
- [ ] Read meetings works

**Test Knowledge Base:**
1. Navigate to `/knowledge`
2. Verify test entries appear
3. Test search functionality

- [ ] Knowledge entries visible
- [ ] Search works

---

### 6.3 Test AI Features

**Prerequisites:** OPENAI_API_KEY must be set

**Test AI Chat:**
1. Navigate to `/ai/chat`
2. Send message: "Hello, how can you help me?"
3. Verify AI response appears
4. Check chat history persists

- [ ] AI chat responds
- [ ] Chat history saves

**Test Semantic Search:**
1. Go to Knowledge Base
2. Search for related term
3. Verify relevant results

- [ ] Semantic search works

---

## 📝 Deployment Summary

### Completion Checklist

- [ ] Database migrations deployed (2)
- [ ] Environment variables set (at least OPENAI_API_KEY)
- [ ] All 24 edge functions deployed
- [ ] Functions show "Active" status
- [ ] Test functions pass
- [ ] No critical errors in logs
- [ ] Authentication works
- [ ] CRUD operations work
- [ ] AI features work

---

## 🚨 Troubleshooting

### Common Issues

**1. Function fails with "Missing environment variable"**
- Go to Settings → Edge Functions → Secrets
- Verify the required variable is set
- Redeploy the function after setting

**2. Function fails with "Table does not exist"**
- Verify database migrations were run
- Check SQL Editor for table existence
- Run migrations in correct order

**3. AI features not working**
- Verify OPENAI_API_KEY is set
- Check function logs for OpenAI API errors
- Verify API key is valid and has credits

**4. Authentication not working**
- Check Supabase Auth settings
- Verify email templates are configured
- Check for RLS policy issues

**5. CORS errors in browser**
- Verify frontend URL is in Supabase Auth allowed URLs
- Check edge function CORS headers

---

## 📞 Support

If you encounter issues:

1. Check function logs in Supabase Dashboard
2. Review `TESTING_GUIDE.md` for detailed test procedures
3. Consult `PRODUCTION_READINESS_CHECKLIST.md` for comprehensive checks
4. Check Supabase status: https://status.supabase.com

---

## 🎉 Next Steps After Successful Deployment

1. **Add Logo & Favicon** - Complete branding
2. **Test All Features** - Follow `TESTING_GUIDE.md`
3. **Performance Testing** - Ensure < 3s load times
4. **Security Audit** - Review `PRODUCTION_READINESS_CHECKLIST.md`
5. **Production Launch** - Follow `PRODUCTION_DEPLOYMENT_GUIDE.md`

---

**Last Updated:** 2025-12-31
**Version:** 1.0
**Project:** CollabAI Framework V1
