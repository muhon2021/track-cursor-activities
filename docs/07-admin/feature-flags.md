# Feature Flags Reference

This document explains each feature flag in the `app_config` table and what it enables/disables in the Control Tower application.

## Overview

Feature flags allow you to enable or disable entire modules without modifying code. This is especially useful when:
- Self-hosting and wanting to run only specific features
- Disabling features that require API keys you don't have
- Gradually rolling out new capabilities
- Testing specific functionality in isolation

## How Feature Flags Work

All feature flags are stored in the `app_config` table with keys prefixed by `features.`. They are accessed throughout the application via the `useFeatureFlags()` hook.

## Available Feature Flags

### Core Features

| Flag | Default | Description | Required Secrets | Affected Components |
|------|---------|-------------|------------------|---------------------|
| `enableAIChat` | `true` | Enables the AI chat assistant interface | `OPENAI_API_KEY` | `/ai-chat`, `AIChatInterface`, `AIChatAssistant` |
| `enableKnowledgeBase` | `true` | Enables the organizational knowledge base | None | `/knowledge`, `KnowledgeList`, `KnowledgeDetail` |
| `enableMeetings` | `true` | Enables meeting management and transcripts | None | `/meetings`, `MeetingsList`, `MeetingDetail` |
| `enableTasks` | `true` | Enables task management module | None | `/tasks`, `TasksList`, `TaskForm` |
| `enableNotifications` | `true` | Enables in-app and email notifications | `SENDGRID_API_KEY` (for email) | `NotificationBell`, `/notifications` |
| `enableSemanticSearch` | `true` | Enables AI-powered semantic search | `OPENAI_API_KEY` | `SemanticSearch` component |
| `enableClients` | `true` | Enables client/customer management | None | `/clients`, `ClientsList`, `ClientDetail` |
| `enableAIAgents` | `true` | Enables custom AI agent creation and execution | `OPENAI_API_KEY` | `/ai-agents`, `AgentRunner`, `AgentBuilder` |
| `enablePersonalKnowledge` | `true` | Enables user's private knowledge base | None | `/personal-knowledge`, `UserKnowledgeList` |
| `enableFeedback` | `true` | Enables user feedback system | `SENDGRID_API_KEY` | `/feedback`, `FeedbackForm` |

### Integration Features

| Flag | Default | Description | Required Secrets | Affected Components |
|------|---------|-------------|------------------|---------------------|
| `enableGoogleDrive` | `false` | Enables Google Drive sync and file picker | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_API_KEY` | `GoogleDriveFilePicker`, `GoogleDriveSync` |
| `enableZoomSync` | `false` | Enables Zoom meeting recordings sync | `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `ZOOM_ACCOUNT_ID` | `ZoomFileList`, `sync-zoom-files` edge function |

## How to Toggle Features

### Method 1: Admin UI (Recommended)

1. Log in as an administrator
2. Navigate to **Settings** → **System Settings** → **Features**
3. Toggle the feature on or off
4. Changes take effect immediately

### Method 2: Database Direct Edit

Connect to your Supabase database and run:

```sql
-- Disable a feature
UPDATE app_config SET value = 'false' WHERE key = 'features.enableZoomSync';

-- Enable a feature
UPDATE app_config SET value = 'true' WHERE key = 'features.enableAIChat';

-- View all feature flags
SELECT * FROM app_config WHERE key LIKE 'features.%';
```

### Method 3: Seed Data

When initializing a new database, feature flags are set via the seed data. Edit your seed data before running migrations to set default values.

## Feature Dependencies

Some features depend on others to function correctly:

- **AI Chat** requires:
  - `OPENAI_API_KEY` secret set in Supabase Edge Functions
  - Knowledge Base enabled if you want it to reference documents

- **Semantic Search** requires:
  - `OPENAI_API_KEY` for embeddings generation
  - At least one content source (Knowledge Base, Meetings, etc.)

- **Notifications** requires:
  - `SENDGRID_API_KEY` for email notifications (in-app notifications work without it)

- **Google Drive** requires:
  - OAuth credentials configured
  - Google Cloud Console project set up
  - Proper redirect URIs configured

- **Zoom Sync** requires:
  - Zoom OAuth app created
  - Webhook endpoint configured
  - Storage bucket for recordings

## Environment Variables Reference

For each feature, here are the required environment variables:

### AI Features (`OPENAI_API_KEY`)
```bash
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx
```

Get from: https://platform.openai.com/api-keys

**Enables:**
- AI Chat Assistant
- Semantic Search
- AI Agents
- Meeting Summarization
- Document Embeddings

### Email Notifications (`SENDGRID_API_KEY`)
```bash
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
```

Get from: https://app.sendgrid.com/settings/api_keys

**Enables:**
- Email notifications
- User invites via email
- Feedback notifications to admins

### Google Integration
```bash
GOOGLE_CLIENT_ID=xxxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxxxxxxxxxxx
GOOGLE_API_KEY=xxxxxxxxxxxxx
```

Get from: https://console.cloud.google.com/

**Enables:**
- Google Drive file sync
- Google Drive file picker
- OAuth authentication with Google

### Zoom Integration
```bash
ZOOM_CLIENT_ID=xxxxxxxxxxxxx
ZOOM_CLIENT_SECRET=xxxxxxxxxxxxx
ZOOM_ACCOUNT_ID=xxxxxxxxxxxxx
```

Get from: https://marketplace.zoom.us/

**Enables:**
- Automatic sync of Zoom recordings
- Zoom meeting transcripts
- Zoom webhook integration

## Checking Feature Status in Code

To check if a feature is enabled in your components:

```typescript
import { useFeatureFlags } from '@/hooks';

function MyComponent() {
  const { features } = useFeatureFlags();

  if (!features.enableAIChat) {
    return <div>AI Chat is disabled</div>;
  }

  return <AIChatInterface />;
}
```

## Best Practices

1. **Disable unused features**: If you're not using a feature, disable it to reduce confusion and potential surface area for bugs.

2. **Check secrets first**: Before enabling an integration feature, ensure the required secrets are configured in Supabase Edge Functions.

3. **Test after toggling**: After enabling/disabling a feature, test the UI to ensure navigation and permissions work as expected.

4. **Document custom flags**: If you add new feature flags, document them here with their purpose and dependencies.

5. **Use environment-based defaults**: Consider having different default values for development vs. production environments.

## Troubleshooting

### Feature appears disabled even though flag is true

1. Check if required secrets are configured
2. Verify edge functions are deployed
3. Check browser console for errors
4. Clear localStorage and refresh

### Can't find feature toggle in admin UI

Ensure you're logged in as an administrator. Only users with the `admin` role can access system settings.

### Feature toggle doesn't take effect

- Refresh the page after toggling
- Check if the database value actually changed
- Verify no client-side caching is interfering

## Migration Guide

When forking or remixing this project:

1. Review all feature flags and decide which you need
2. Disable features you won't use immediately
3. Set up secrets only for enabled features
4. Test each feature independently
5. Update navigation/UI to hide disabled features

## Related Documentation

- [Environment Variables](.env.example)
- [Secrets Management](SECRETS_MANAGEMENT.md)
- [Edge Functions Catalog](EDGE_FUNCTIONS_CATALOG.md)
- [Admin Guide](ADMIN-GUIDE.md)
