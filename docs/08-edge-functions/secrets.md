# Secrets Management Guide

This document explains how secrets are managed in the SJ Innovation Framework and how to migrate them when copying or deploying to a new environment.

## Overview

Secrets are stored securely in Supabase Edge Function Secrets and are **NOT** stored in code or version control. When you copy this project, you must manually re-add all secrets to the new Supabase project.

## Required Secrets

### Critical (Required for core functionality)

| Secret Name | Purpose | Required For |
|------------|---------|--------------|
| `OPENAI_API_KEY` | OpenAI API access | AI chat, embeddings, agents, meeting summaries |
| `SUPABASE_URL` | Supabase project URL | Auto-set by Supabase |
| `SUPABASE_ANON_KEY` | Supabase anonymous key | Auto-set by Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role | Auto-set by Supabase |

### Optional (Enable additional features)

| Secret Name | Purpose | Required For |
|------------|---------|--------------|
| `SENDGRID_API_KEY` | SendGrid email API | Email notifications |
| `ZOOM_CLIENT_ID` | Zoom OAuth client ID | Zoom integration |
| `ZOOM_CLIENT_SECRET` | Zoom OAuth secret | Zoom integration |
| `ZOOM_ACCOUNT_ID` | Zoom account ID | Zoom integration |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Google Drive sync |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret | Google Drive sync |
| `GOOGLE_API_KEY` | Google API key | Google Drive sync |
| `SLACK_WEBHOOK_URL` | Slack webhook URL | Slack notifications |
| `GEMINI_API_KEY` | Google Gemini API | Alternative AI provider |

## How to Add Secrets

### Via Supabase Dashboard

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Settings** → **Edge Functions** → **Secrets**
4. Click **Add new secret**
5. Enter the secret name and value
6. Click **Save**

### Via Supabase CLI

```bash
# Set a single secret
supabase secrets set OPENAI_API_KEY=sk-proj-xxxxx

# Set multiple secrets at once
supabase secrets set \
  OPENAI_API_KEY=sk-proj-xxxxx \
  SENDGRID_API_KEY=SG.xxxxx

# List existing secrets
supabase secrets list
```

## Project Migration Checklist

When copying this project to a new Supabase instance:

### 1. Auto-configured Secrets
These are automatically set by Supabase when you create a new project:
- [ ] `SUPABASE_URL` - Verify it exists
- [ ] `SUPABASE_ANON_KEY` - Verify it exists
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - Verify it exists
- [ ] `SUPABASE_DB_URL` - Verify it exists

### 2. Required Secrets to Add Manually
- [ ] `OPENAI_API_KEY` - **CRITICAL** for AI features

### 3. Optional Secrets (add based on features needed)
- [ ] `SENDGRID_API_KEY` - For email notifications
- [ ] `ZOOM_CLIENT_ID` - For Zoom integration
- [ ] `ZOOM_CLIENT_SECRET` - For Zoom integration
- [ ] `ZOOM_ACCOUNT_ID` - For Zoom integration
- [ ] `GOOGLE_CLIENT_ID` - For Google Drive
- [ ] `GOOGLE_CLIENT_SECRET` - For Google Drive
- [ ] `GOOGLE_API_KEY` - For Google Drive
- [ ] `SLACK_WEBHOOK_URL` - For Slack notifications

## Security Best Practices

1. **Never commit secrets** - Secrets should never be in `.env` files or committed to git
2. **Use least privilege** - Only add secrets that are actually needed
3. **Rotate regularly** - Update API keys periodically
4. **Monitor usage** - Check API dashboards for unusual activity
5. **Different keys per environment** - Use separate API keys for dev/staging/prod

## Troubleshooting

### Function Returns 500 Error
1. Check if the required secret exists in Supabase Dashboard
2. Verify the secret value is correct (no extra spaces or quotes)
3. Check function logs for specific error messages

### Secret Not Found
```
Error: Environment variable OPENAI_API_KEY is not set
```
The secret hasn't been added. Follow the steps above to add it.

### Invalid API Key
```
Error: Invalid API key provided
```
The secret value is incorrect. Update it in Supabase Dashboard.

## Related Documentation

- [EDGE_FUNCTIONS_DEPLOYMENT.md](../EDGE_FUNCTIONS_DEPLOYMENT.md) - Full deployment guide
- [PRODUCTION_DEPLOYMENT_GUIDE.md](../PRODUCTION_DEPLOYMENT_GUIDE.md) - Production checklist
