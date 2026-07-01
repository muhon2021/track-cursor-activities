# Edge Functions Deployment Guide

## ✅ What's Been Created

**24 Edge Functions** have been created in `supabase/functions/`:

### Foundation Functions (4)
- ✅ `validate-api-key` - API key validation
- ✅ `audit-log-writer` - Activity logging
- ✅ `send-email` - Email sending via SendGrid
- ✅ `send-notification` - Multi-channel notifications

### AI Functions (6)
- ✅ `ai-chat-assistant` - AI chat with history
- ✅ `semantic-search` - Vector similarity search
- ✅ `run-ai-agent` - Execute AI agents
- ✅ `generate-embeddings` - Create vector embeddings
- ✅ `generate-meeting-summary` - AI meeting summaries
- ✅ `generate-business-doc` - Generate SOW, NDA, contracts

### Meetings Functions (5)
- ✅ `sync-zoom-files` - Sync Zoom recordings
- ✅ `zoom-transcript-processing` - Parse VTT transcripts
- ✅ `auto-embed-meetings` - Generate meeting embeddings
- ✅ `categorize-meeting` - Auto-categorize meetings
- ✅ `api-v1-meetings` - Meetings CRUD API

### Knowledge Base Functions (7)
- ✅ `google-drive-sync` - Admin Google Drive sync
- ✅ `google-drive-upload` - Upload to Google Drive
- ✅ `user-knowledge-upload` - User file uploads
- ✅ `user-knowledge-drive-sync` - User Google Drive sync
- ✅ `user-knowledge-process` - Process user files
- ✅ `auto-embed-knowledge-files` - Generate knowledge embeddings
- ✅ `unified-knowledge-search` - Search all knowledge

### Clients & Feedback Functions (2)
- ✅ `api-v1-clients` - Clients CRUD API
- ✅ `send-feedback-notification` - Feedback notifications

---

## 🚀 Deployment Steps

### Step 1: Install Supabase CLI

```bash
# Using npm
npm install -g supabase

# Or using Homebrew (Mac)
brew install supabase/tap/supabase

# Verify installation
supabase --version
```

### Step 2: Login to Supabase

```bash
supabase login
```

This will open a browser window to authenticate.

### Step 3: Link to Your Project

```bash
supabase link --project-ref tjkqvbxtziheggurtvcz
```

When prompted, enter your database password from the Supabase dashboard.

### Step 4: Deploy All Edge Functions

You can deploy all functions at once or one by one:

**Option A: Deploy All Functions**
```bash
# Deploy all functions
for func in supabase/functions/*; do
  if [ -d "$func" ]; then
    func_name=$(basename "$func")
    echo "Deploying $func_name..."
    supabase functions deploy "$func_name"
  fi
done
```

**Option B: Deploy Individual Functions**
```bash
# Deploy one function at a time
supabase functions deploy validate-api-key
supabase functions deploy ai-chat-assistant
# ... etc
```

**Option C: Deploy Specific Categories**
```bash
# Foundation functions
supabase functions deploy validate-api-key
supabase functions deploy audit-log-writer
supabase functions deploy send-email
supabase functions deploy send-notification

# AI functions
supabase functions deploy ai-chat-assistant
supabase functions deploy semantic-search
supabase functions deploy run-ai-agent
supabase functions deploy generate-embeddings
supabase functions deploy generate-meeting-summary
supabase functions deploy generate-business-doc

# Meetings functions
supabase functions deploy sync-zoom-files
supabase functions deploy zoom-transcript-processing
supabase functions deploy auto-embed-meetings
supabase functions deploy categorize-meeting
supabase functions deploy api-v1-meetings

# Knowledge Base functions
supabase functions deploy google-drive-sync
supabase functions deploy google-drive-upload
supabase functions deploy user-knowledge-upload
supabase functions deploy user-knowledge-drive-sync
supabase functions deploy user-knowledge-process
supabase functions deploy auto-embed-knowledge-files
supabase functions deploy unified-knowledge-search

# Clients & Feedback functions
supabase functions deploy api-v1-clients
supabase functions deploy send-feedback-notification
```

### Step 5: Set Environment Variables

Go to your Supabase dashboard:
https://supabase.com/dashboard/project/tjkqvbxtziheggurtvcz/settings/functions

Click on "Secrets" and add these environment variables:

**Required for AI Features:**
```bash
OPENAI_API_KEY=sk-proj-...
```

**Optional - Alternative AI:**
```bash
GEMINI_API_KEY=...
```

**Required for Zoom Integration:**
```bash
ZOOM_CLIENT_ID=...
ZOOM_CLIENT_SECRET=...
ZOOM_ACCOUNT_ID=...
```

**Required for Google Drive:**
```bash
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_API_KEY=...
```

**Required for Email:**
```bash
SENDGRID_API_KEY=...
```

**Optional - Slack:**
```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

**Auto-set by Supabase (verify they exist):**
```bash
SUPABASE_URL=https://tjkqvbxtziheggurtvcz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
```

---

## 🔧 Additional Database Setup

### Create the `match_embeddings` Function

The semantic search requires a PostgreSQL function. Run this in your Supabase SQL Editor:

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create match_embeddings function for semantic search
CREATE OR REPLACE FUNCTION match_embeddings(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  entity_type text,
  entity_id text,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.entity_type,
    e.entity_id,
    e.content,
    e.metadata,
    1 - (e.embedding <=> query_embedding) as similarity
  FROM embeddings e
  WHERE 1 - (e.embedding <=> query_embedding) > match_threshold
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

---

## ✅ Verification Steps

### 1. Check Deployment Status

```bash
# List all deployed functions
supabase functions list
```

### 2. Test a Simple Function

```bash
# Test validate-api-key
curl -X POST \
  https://tjkqvbxtziheggurtvcz.supabase.co/functions/v1/validate-api-key \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "test-api-key-12345678901234567890"}'
```

### 3. Check Function Logs

Go to: https://supabase.com/dashboard/project/tjkqvbxtziheggurtvcz/logs/edge-functions

---

## 📝 Environment Variable Checklist

- [ ] `OPENAI_API_KEY` - **CRITICAL** for AI features
- [ ] `ZOOM_CLIENT_ID` - For Zoom sync
- [ ] `ZOOM_CLIENT_SECRET` - For Zoom sync
- [ ] `ZOOM_ACCOUNT_ID` - For Zoom sync
- [ ] `GOOGLE_CLIENT_ID` - For Google Drive
- [ ] `GOOGLE_CLIENT_SECRET` - For Google Drive
- [ ] `GOOGLE_API_KEY` - For Google Drive
- [ ] `SENDGRID_API_KEY` - For email
- [ ] `SLACK_WEBHOOK_URL` - Optional, for Slack notifications
- [ ] `GEMINI_API_KEY` - Optional, alternative AI provider

---

## 🐛 Troubleshooting

### Functions Won't Deploy

**Error: "No such file or directory"**
- Make sure you're in the project root directory
- Check that `supabase/functions/` exists

**Error: "Project not linked"**
```bash
supabase link --project-ref tjkqvbxtziheggurtvcz
```

### Function Returns 500 Error

**Check environment variables:**
1. Go to Supabase dashboard > Edge Functions > Secrets
2. Verify all required keys are set
3. Check function logs for specific errors

**Common issues:**
- Missing `OPENAI_API_KEY` for AI functions
- Missing `ZOOM_*` credentials for Zoom functions
- Database tables don't exist (check migrations)

### Semantic Search Not Working

1. Verify `match_embeddings` function exists:
```sql
SELECT routine_name
FROM information_schema.routines
WHERE routine_name = 'match_embeddings';
```

2. Check if pgvector extension is enabled:
```sql
SELECT * FROM pg_extension WHERE extname = 'vector';
```

---

## 🎯 Next Steps

After deploying all functions:

1. ✅ Set all environment variables
2. ✅ Create `match_embeddings` database function
3. ✅ Test each function category
4. ✅ Insert test data
5. ✅ Test frontend integration

---

## 📚 Documentation

For detailed API documentation of each function, see:
- `docs/sj-innovation-framework_ai-agents.md` - AI functions
- `docs/sj-innovation-framework_meetings-zoom.md` - Meetings functions
- `docs/sj-innovation-framework_knowledge-base.md` - Knowledge functions

---

## 🔐 Secrets Migration

When copying this project to a new Supabase instance, secrets must be manually re-added.

### Critical Secrets (Required)
| Secret | Purpose |
|--------|---------|
| `OPENAI_API_KEY` | AI chat, embeddings, agents |

### Optional Secrets
| Secret | Purpose |
|--------|---------|
| `SENDGRID_API_KEY` | Email notifications |
| `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `ZOOM_ACCOUNT_ID` | Zoom integration |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google Drive |

### Auto-configured by Supabase
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

For detailed secrets documentation, see: [docs/SECRETS_MANAGEMENT.md](docs/SECRETS_MANAGEMENT.md)

---

**Created:** 2025-12-31
**Updated:** 2026-01-02
**Status:** Ready for deployment
**Total Functions:** 31
