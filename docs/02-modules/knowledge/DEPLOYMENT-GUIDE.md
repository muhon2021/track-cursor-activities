# Knowledge Module - Deployment Guide

**Version:** 1.1
**Last Updated:** February 11, 2026
**Status:** Production Ready

---

## Quick Start

### 1. Deploy Edge Functions

Deploy the two new edge functions for batch processing and cleanup:

```bash
# Deploy batch embedding processor
supabase functions deploy process-embedding-queue --no-verify-jwt

# Deploy retention cleanup function
supabase functions deploy embedding-retention-cleanup --no-verify-jwt
```

**Why `--no-verify-jwt`?**
These functions are triggered by cron jobs or internal processes, not direct user requests.

---

## 2. Set Up Cron Jobs (Optional)

For automated processing, add these cron jobs to your Supabase project:

```sql
-- Process embedding queue every 5 minutes
SELECT cron.schedule(
  'process-embedding-queue',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/process-embedding-queue',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('batch_size', 20)
  ) AS request_id;
  $$
);

-- Clean up old embeddings daily at 2 AM
SELECT cron.schedule(
  'embedding-retention-cleanup',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/embedding-retention-cleanup',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('dry_run', false)
  ) AS request_id;
  $$
);
```

**To view cron jobs:**
```sql
SELECT * FROM cron.job ORDER BY jobid DESC;
```

**To remove a cron job:**
```sql
SELECT cron.unschedule('process-embedding-queue');
```

---

## 3. Verify Storage Buckets

Check that storage buckets exist with correct permissions:

```bash
# List buckets
supabase storage list

# You should see:
# - user-knowledge (private)
# - knowledge-files (private)
# - meeting-recordings (private)
```

**Create buckets if missing:**
```sql
-- User knowledge bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-knowledge', 'user-knowledge', false);

-- Knowledge files bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('knowledge-files', 'knowledge-files', false);
```

---

## 4. Test Edge Functions

### Test Embedding Queue Processor

```bash
# Invoke manually
curl -X POST \
  'https://your-project.supabase.co/functions/v1/process-embedding-queue' \
  -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"batch_size": 5}'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Processed 5 items",
  "results": {
    "processed": 5,
    "succeeded": 4,
    "failed": 1,
    "errors": ["knowledge_entry:abc123 - File not found"]
  }
}
```

### Test Retention Cleanup (Dry Run)

```bash
# Test without deleting
curl -X POST \
  'https://your-project.supabase.co/functions/v1/embedding-retention-cleanup' \
  -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"dry_run": true}'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Would delete 142 embeddings",
  "results": {
    "total_checked": 142,
    "total_deleted": 0,
    "by_entity_type": {
      "email_memory": { "checked": 85, "deleted": 0 },
      "conversation_summary": { "checked": 57, "deleted": 0 }
    },
    "dry_run": true
  }
}
```

---

## 5. Access New Admin Pages

The following pages are now available in the admin panel:

| Page | Route | Purpose |
|------|-------|---------|
| Knowledge Dashboard | `/admin/knowledge/dashboard` | Unified analytics, usage insights, sync status, source overview |
| Knowledge Files | `/admin/knowledge/files` | File management with search, filtering, and reprocess |
| Knowledge Categories | `/admin/knowledge/categories` | Category CRUD |

**Navigation:** Admin > Knowledge Base > Dashboard | Categories | Files

**Removed from navigation (redirect to dashboard):** Sources, Common Knowledge, Analytics, Sync Status, Gemini RAG, Batch Upload. Source management is in Integrations.

---

## 6. Configuration

### Retention Policies

Default retention policies (in `embedding-retention-cleanup`):

| Entity Type | Retention Period | Notes |
|-------------|------------------|-------|
| `knowledge_entry` | Permanent | Never deleted |
| `user_knowledge` | Permanent | Never deleted |
| `meeting_transcript` | 1 year | 365 days |
| `client_research` | 1 year | 365 days |
| `deal_details` | 1 year | 365 days |
| `email_memory` | 3 months | 90 days |
| `conversation_summary` | 3 months | 90 days |

**To customize retention:**
```bash
# Pass custom policies
curl -X POST \
  'https://your-project.supabase.co/functions/v1/embedding-retention-cleanup' \
  -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "dry_run": false,
    "custom_policies": [
      {"entity_type": "email_memory", "retention_days": 30},
      {"entity_type": "meeting_transcript", "retention_days": 180}
    ]
  }'
```

### Batch Processing

**Recommended batch sizes:**
- Development: 5-10 items
- Production: 20-30 items
- High volume: Up to 50 items (max)

**Why not larger?**
- Edge functions have execution time limits
- OpenAI API rate limits
- Cost management

---

## 7. Monitoring

### Check Processing Queue Status

```sql
-- View pending items
SELECT
  entity_type,
  COUNT(*) as count,
  AVG(retry_count) as avg_retries
FROM embedding_queue
WHERE status = 'pending'
GROUP BY entity_type;
```

### Check Failed Embeddings

```sql
-- View failed items
SELECT * FROM embedding_queue
WHERE status = 'failed'
ORDER BY updated_at DESC
LIMIT 10;
```

### Monitor Costs

```sql
-- Embedding costs (if rag_cost_log table exists)
SELECT
  DATE(created_at) as date,
  COUNT(*) as total_embeddings,
  SUM(cost_usd) as daily_cost
FROM rag_cost_log
WHERE operation = 'embedding'
GROUP BY DATE(created_at)
ORDER BY date DESC
LIMIT 30;
```

---

## 8. Troubleshooting

### Issue: Embeddings not processing

**Check:**
1. Edge function deployment status
2. OpenAI API key is set
3. Files exist in storage
4. Queue table has pending items

**Fix:**
```bash
# Manually trigger processing
supabase functions invoke process-embedding-queue \
  --data '{"batch_size": 10}'
```

### Issue: Sync failing

**Check:**
1. Google Drive credentials are valid
2. Source URLs are correct
3. Network connectivity

**Fix:**
```sql
-- Reset sync status
UPDATE knowledge_sources
SET sync_status = 'pending'
WHERE id = 'SOURCE_ID';
```

### Issue: Storage permission denied

**Check:**
1. RLS policies are correctly configured
2. Bucket exists
3. File paths match user ID folder structure

**Fix:**
```sql
-- Verify RLS policies
SELECT * FROM pg_policies
WHERE tablename = 'objects'
AND schemaname = 'storage';
```

---

## 9. Performance Optimization

### Index Recommendations

```sql
-- Add index for faster queue processing
CREATE INDEX IF NOT EXISTS idx_embedding_queue_status_priority
ON embedding_queue(status, priority DESC, created_at ASC)
WHERE status = 'pending';

-- Add index for entity lookups
CREATE INDEX IF NOT EXISTS idx_embedding_queue_entity
ON embedding_queue(entity_type, entity_id);
```

### Query Optimization

```sql
-- Analyze query performance
EXPLAIN ANALYZE
SELECT * FROM embedding_queue
WHERE status = 'pending'
ORDER BY priority DESC, created_at ASC
LIMIT 20;
```

---

## 10. Rollback Plan

If issues occur:

```bash
# Stop cron jobs
SELECT cron.unschedule('process-embedding-queue');
SELECT cron.unschedule('embedding-retention-cleanup');

# Verify no active processing
SELECT * FROM embedding_queue WHERE status = 'processing';

# Rollback edge functions (deploy previous version)
supabase functions deploy process-embedding-queue --legacy-bundle

# Clear failed items
UPDATE embedding_queue SET status = 'pending' WHERE status = 'failed';
```

---

## 11. Security Checklist

- [ ] Service role key is secured (not exposed to client)
- [ ] RLS policies are enabled on all knowledge tables
- [ ] Storage bucket policies enforce user isolation
- [ ] Admin pages require admin role
- [ ] Edge functions validate input
- [ ] CORS is properly configured

---

## 12. Post-Deployment Validation

Run this checklist after deployment:

```bash
# 1. Check edge functions are deployed
supabase functions list | grep -E "process-embedding-queue|embedding-retention-cleanup"

# 2. Test process-embedding-queue
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/process-embedding-queue" \
  -H "Authorization: Bearer SERVICE_KEY" \
  -d '{"batch_size": 1}'

# 3. Test retention cleanup (dry run)
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/embedding-retention-cleanup" \
  -H "Authorization: Bearer SERVICE_KEY" \
  -d '{"dry_run": true}'

# 4. Access admin pages
# - Navigate to /admin/knowledge/dashboard
# - Navigate to /admin/knowledge/files
# - Navigate to /admin/knowledge/categories

# 5. Verify navigation items appear in admin sidebar
```

**All tests passing?** ✅ Deployment successful!

---

## Support

- **Documentation:** `/docs/02-modules/knowledge/`
- **Gap Analysis:** `/docs/02-modules/knowledge/KNOWLEDGE-GAP-ANALYSIS.md`
- **Replication Guide:** `/docs/02-modules/knowledge/KNOWLEDGE-REPLICATION.md`
- **Issues:** https://github.com/sjinnovation/sj-control-tower-framework/issues

---

**Last Updated:** February 11, 2026
**Deployed By:** Claude Code Agent
