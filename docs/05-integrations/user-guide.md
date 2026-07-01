# Integration Hub - User Guide

Complete guide to configuring and managing third-party integrations in the Control Tower framework.

## Table of Contents

1. [Overview](#overview)
2. [Accessing the Integration Hub](#accessing-the-integration-hub)
3. [Integration Categories](#integration-categories)
4. [Connecting an Integration](#connecting-an-integration)
   - [API Key Authentication](#api-key-authentication)
   - [OAuth 2.0 Authentication](#oauth-20-authentication)
5. [Managing Integrations](#managing-integrations)
6. [Service Management](#service-management)
7. [Usage Analytics](#usage-analytics)
8. [Troubleshooting](#troubleshooting)

---

## Overview

The Integration Hub allows you to connect your Control Tower application with 23+ third-party services across 7 categories:

- **AI Providers**: OpenAI, Anthropic, Google Gemini, Perplexity
- **Meeting Providers**: Zoom, Microsoft Teams, Google Meet, Webex, GoToMeeting
- **Email Services**: SendGrid, Mailgun, Postmark, Amazon SES
- **CRM Systems**: Salesforce, HubSpot, Pipedrive, Zoho
- **Project Management**: Jira, Asana, Monday.com, Trello, ClickUp
- **Storage & Productivity**: Google Workspace, Microsoft 365

---

## Accessing the Integration Hub

1. Log in to your Control Tower account
2. Navigate to **Admin Panel** (admin users only)
3. Click **Integrations** in the sidebar

You'll see a category-based view of all available integrations with their connection status.

---

## Integration Preferences

At the top of the Integration Hub, administrators can configure **Primary Integrations** and **Primary Knowledge Sources**. These settings define which connected systems the platform treats as defaults for future AI, search, knowledge, memory, and analytics features.

### Primary Integrations

Select one or more connected business systems:

- **CRM** — Salesforce, HubSpot, Pipedrive, Zoho CRM, etc.
- **Project Management** — Jira, Asana, ClickUp, ActiveCollab, etc.
- **Communication** — Microsoft Teams, Zoom, Google Meet, etc.
- **File Storage** — Google Drive, Google Workspace, Microsoft 365, etc.

Only **connected and enabled** integrations can be selected. Disconnected selections are removed automatically on save with a warning.

### Primary Knowledge Sources

Select connected external knowledge integrations and active internal sources:

- **External** — Confluence, SharePoint, Google Drive, etc. (must be connected)
- **Internal** — Manual Uploads, Meeting Transcripts, and other active `knowledge_sources` rows

### Permissions

- **Administrators** can view and save preferences
- **Moderators** can view preferences but cannot save changes

### Saving

1. Open **Admin → Integrations**
2. Scroll to **Integration Preferences** (or use `#preferences` anchor)
3. Use the searchable multi-select for each section
4. Click **Save Settings**

Success message: *Settings saved successfully.*

---

## Integration Categories

### AI Providers
Connect to AI model providers for chat, completions, and embeddings. Each provider supports multiple models that can be enabled or disabled individually.

### Meeting Providers
Integrate with video conferencing platforms to automatically sync meetings, recordings, and transcripts.

### Email Services
Connect email delivery services for transactional emails, notifications, and marketing campaigns.

### CRM Systems
Sync customer data, contacts, and deals with your CRM platform.

### Project Management
Integrate with project tracking tools to sync tasks, projects, and updates.

### Storage & Productivity
Connect to cloud storage and productivity suites for file management and collaboration.

---

## Connecting an Integration

### API Key Authentication

For providers that use API keys:

1. Click on the provider card (e.g., "OpenAI", "SendGrid")
2. Enter your API credentials in the configuration form
3. Click **Save Configuration**
4. Click **Test Connection** to verify

#### Example: Connecting OpenAI

1. Navigate to [OpenAI API Keys](https://platform.openai.com/api-keys)
2. Create a new API key
3. Copy the key
4. In Integration Hub, click **OpenAI**
5. Paste your API key in the "API Key" field
6. Click **Save Configuration**
7. Click **Test Connection**
8. If successful, you'll see a green "Connected" badge

#### Credential Formats by Provider

| Provider | Format | Example |
|----------|--------|---------|
| OpenAI | API Key | `sk-...` |
| Anthropic | API Key | `sk-ant-...` |
| SendGrid | API Key | `SG....` |
| Zoom | `account_id:client_id:client_secret` | `abc123:xyz789:secret` |
| Mailgun | `domain:api_key` | `mg.example.com:key-...` |
| Jira | `email:api_token:domain` | `user@example.com:token:company.atlassian.net` |
| Postmark | Server Token | `xxxxx-xxxx-xxxx` |
| Asana | Personal Access Token | `1/...` |
| Monday.com | API v2 Token | `eyJhbG...` |

### OAuth 2.0 Authentication

For providers that use OAuth (Zoom, Microsoft Teams, Google):

1. Click on the provider card
2. Click **Connect with [Provider]**
3. You'll be redirected to the provider's authorization page
4. Log in and approve the requested permissions
5. You'll be redirected back to the Integration Hub
6. The connection status will update to "Connected"

#### OAuth Permissions

When you connect via OAuth, the integration will request specific permissions:

**Zoom**:
- Read and manage meetings
- Access recording files
- Read participant data

**Microsoft Teams**:
- Read and create calendar events
- Access online meetings
- Read user profile

**Google Meet**:
- Manage calendar events
- Create and join meetings

---

## Managing Integrations

### Viewing Connection Status

Each integration shows its connection status:

- **🟢 Connected**: Integration is active and working
- **⚪ Disconnected**: Not configured
- **🔴 Error**: Connection failed (check credentials)
- **🔵 Testing**: Connection test in progress

### Testing Connections

After configuring an integration:

1. Click **Test Connection**
2. The system will verify your credentials
3. Results are displayed immediately
4. If the test fails, check the error message and update credentials

### Disconnecting an Integration

To remove an integration:

1. Open the provider detail page
2. Click **Disconnect**
3. Confirm the action
4. All credentials and tokens will be deleted

⚠️ **Warning**: Disconnecting will stop all automated synchronization and webhooks.

---

## Service Management

Some providers offer multiple services (like AI models or meeting types). You can:

### Enable/Disable Services

1. Navigate to the provider detail page
2. Scroll to **Available Services**
3. Toggle the switch next to each service
4. Enabled services will be available for use

### Set Default Service

1. Click the star icon (⭐) next to a service
2. The service becomes the default for that provider
3. The default service is used when no specific service is requested

**Note**: You cannot disable the default service. Set another service as default first.

### Service Features

Each service displays:
- Name and description
- Features (as badges)
- Cost information (if applicable)
- Beta status (if in beta)

---

## Usage Analytics

Track integration usage, costs, and performance:

### Accessing Analytics

1. Navigate to Integration Hub
2. Click **View Analytics** in the top-right corner

### Key Metrics

**Total API Calls**: Number of requests across all integrations

**Success Rate**: Percentage of successful API calls vs failures

**Total Cost**: Estimated cost based on provider pricing

**Avg Response Time**: Average API response time in milliseconds

### Filtering Data

- **Date Range**: Last 7 days, 30 days, 90 days, or All time
- **Category**: Filter by integration category
- **Provider**: Filter by specific provider

### Exporting Data

Click **Export CSV** or **Export Excel** to download usage logs including:
- Date/Time of each API call
- Provider and service used
- Success/error status
- Response time
- Cost
- Error messages (if any)

### Usage Chart

The chart shows daily usage patterns with:
- Green bars: Successful API calls
- Red bars: Failed API calls
- Hover for detailed stats per day

### Provider Breakdown Table

View statistics per provider:
- Total calls and success/error counts
- Success rate (color-coded)
- Total cost and average cost per call
- Average response time (color-coded)

**Color Coding**:
- 🟢 Green: Excellent (≥95% success, <500ms response)
- 🟡 Yellow: Good (80-94% success, 500-999ms response)
- 🔴 Red: Needs attention (<80% success, ≥1000ms response)

---

## Troubleshooting

### Connection Test Failed

**Problem**: "Invalid API key" or "Authentication failed"

**Solutions**:
1. Verify you copied the entire API key (no extra spaces)
2. Check if the API key has expired
3. Ensure the API key has the required permissions
4. For OAuth providers, try disconnecting and reconnecting

### OAuth Redirect Error

**Problem**: "Invalid state" or "Authorization failed"

**Solutions**:
1. Clear your browser cookies and cache
2. Try the OAuth flow again
3. Ensure pop-ups are not blocked
4. Check that the redirect URL is whitelisted in the provider's settings

### Slow Response Times

**Problem**: Average response time >1000ms

**Solutions**:
1. Check the provider's status page for outages
2. Verify your internet connection
3. Contact the provider's support if persistent
4. Consider using a different region/endpoint if available

### Low Success Rate

**Problem**: Success rate <80%

**Solutions**:
1. Review error messages in the usage analytics
2. Check if you've exceeded rate limits
3. Verify API key permissions
4. Ensure webhook signatures are correct (if using webhooks)
5. Contact support with specific error messages

### Integration Not Appearing

**Problem**: Provider not showing in Integration Hub

**Solutions**:
1. Check if the provider is marked as "Coming Soon"
2. Ensure you have admin permissions
3. Refresh the page
4. Clear browser cache

### Webhook Not Working

**Problem**: Real-time updates not arriving

**Solutions**:
1. Verify webhook URL is accessible (not behind firewall)
2. Check webhook signature verification settings
3. Review webhook logs in the provider's dashboard
4. Ensure webhook events are subscribed correctly
5. Test with the provider's webhook testing tool

---

## Best Practices

### Security

1. **Rotate API Keys Regularly**: Update keys every 90 days
2. **Use Environment-Specific Keys**: Separate keys for dev/staging/production
3. **Monitor Usage**: Check analytics weekly for anomalies
4. **Limit Permissions**: Only grant necessary scopes

### Performance

1. **Cache Responses**: Use caching where appropriate
2. **Batch Requests**: Combine multiple operations when possible
3. **Set Timeouts**: Configure appropriate timeout values
4. **Monitor Costs**: Track usage to avoid unexpected bills

### Maintenance

1. **Test After Updates**: Verify connections after system updates
2. **Document Changes**: Keep notes on configuration changes
3. **Review Analytics**: Check success rates monthly
4. **Update Webhooks**: Keep webhook URLs current

---

## Support

For additional help:

1. **Documentation**: Check provider-specific guides in `/docs/integrations/providers/`
2. **Community**: Join our Discord/Slack community
3. **Support Tickets**: Contact support@example.com
4. **Status Page**: Check system status at status.example.com

---

## Appendix

### Supported Providers (Current)

| Provider | Status | Auth Type | Category |
|----------|--------|-----------|----------|
| OpenAI | ✅ Available | API Key | AI |
| Anthropic | ✅ Available | API Key | AI |
| Google Gemini | ✅ Available | API Key | AI |
| Perplexity | ✅ Available | API Key | AI |
| SendGrid | ✅ Available | API Key | Email |
| Zoom | ✅ Available | OAuth / API Key | Meeting |
| Mailgun | ✅ Available | API Key | Email |
| Postmark | ✅ Available | API Key | Email |
| Salesforce | ✅ Available | OAuth / API Key | CRM |
| HubSpot | ✅ Available | API Key | CRM |
| Jira | ✅ Available | API Key | Project Mgmt |
| Asana | ✅ Available | API Key | Project Mgmt |
| Monday.com | ✅ Available | API Key | Project Mgmt |
| Microsoft Teams | 🔜 Coming Soon | OAuth | Meeting |
| Google Meet | 🔜 Coming Soon | OAuth | Meeting |

### Coming Soon

16 additional providers are in development and will be available in future updates.

---

**Last Updated**: January 2026
**Version**: 1.0.0
