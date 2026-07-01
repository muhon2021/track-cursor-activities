# Integration Hub - Data Flow Diagrams

## Table of Contents
1. [OAuth 2.0 Flow](#oauth-20-flow)
2. [API Key Authentication Flow](#api-key-authentication-flow)
3. [Webhook Event Processing](#webhook-event-processing)
4. [Meeting Sync Architecture](#meeting-sync-architecture)
5. [Recording Download Flow](#recording-download-flow)
6. [Multi-Provider AI Routing](#multi-provider-ai-routing)
7. [Usage Logging & Analytics](#usage-logging--analytics)

---

## OAuth 2.0 Flow

### Authorization Code Grant (Standard Flow)

```
┌─────────────┐                                    ┌──────────────────┐
│             │                                    │                  │
│   User      │                                    │   Provider       │
│   Browser   │                                    │   (Zoom/Teams)   │
│             │                                    │                  │
└──────┬──────┘                                    └────────┬─────────┘
       │                                                    │
       │  1. Click "Connect with Provider"                 │
       │                                                    │
┌──────▼──────────────────────────────────────────────┐    │
│                                                      │    │
│  Integration Detail Page                            │    │
│  /admin/integrations/:provider                      │    │
│                                                      │    │
│  - Load provider config from database               │    │
│  - Generate OAuth state (CSRF token)                │    │
│  - Build authorization URL with scopes              │    │
│                                                      │    │
└──────┬──────────────────────────────────────────────┘    │
       │                                                    │
       │  2. Redirect to authorization URL                 │
       │    https://provider.com/oauth/authorize?          │
       │    - client_id=xxx                                │
       │    - redirect_uri=xxx                             │
       │    - scope=meeting:read recording:read            │
       │    - state=random_token                           │
       │    - response_type=code                           │
       ├───────────────────────────────────────────────────►
       │                                                    │
       │  3. Provider displays login & consent screen      │
       │     ┌─────────────────────────────────────┐       │
       │     │                                     │       │
       │     │  ┌────────────────────────────┐    │       │
       │     │  │  Sign in to Zoom           │    │       │
       │     │  │                            │    │       │
       │     │  │  Email: [____________]     │    │       │
       │     │  │  Password: [__________]    │    │       │
       │     │  │                            │    │       │
       │     │  │  [Sign In]                 │    │       │
       │     │  └────────────────────────────┘    │       │
       │     │                                     │       │
       │     │  Control Tower requests permission:│       │
       │     │  ☑ Read user information           │       │
       │     │  ☑ View meetings                   │       │
       │     │  ☑ Access recordings               │       │
       │     │                                     │       │
       │     │  [Approve]  [Deny]                 │       │
       │     └─────────────────────────────────────┘       │
       │                                                    │
       │  4. User approves                                 │
       ◄────────────────────────────────────────────────────┤
       │                                                    │
       │  5. Provider redirects with authorization code    │
       │    https://your-domain.com/api/oauth-callback?    │
       │    - code=auth_code_xyz                           │
       │    - state=random_token                           │
       │                                                    │
┌──────▼──────────────────────────────────────────────┐    │
│                                                      │    │
│  Edge Function: oauth-callback                      │    │
│  /functions/v1/oauth-callback                       │    │
│                                                      │    │
│  Steps:                                             │    │
│  1. Verify state parameter matches                  │    │
│  2. Extract authorization code                      │    │
│  3. Exchange code for tokens                        │    │
│     POST /oauth/token                               │    │
│     - grant_type=authorization_code                 │    │
│     - code=auth_code_xyz                            │    │
│     - client_id=xxx                                 │    │
│     - client_secret=xxx                             │    │
│     - redirect_uri=xxx                              ├────►
│                                                      │    │
│  4. Receive tokens                                  │    │
│     {                                               │◄────┤
│       access_token: "eyJh...",                      │    │
│       refresh_token: "AwAB...",                     │    │
│       expires_in: 3600,                             │    │
│       token_type: "Bearer"                          │    │
│     }                                               │    │
│                                                      │    │
└──────┬──────────────────────────────────────────────┘    │
       │                                                    │
       │  5. Store tokens in database                      │
       │                                                    │
┌──────▼────────────────────────────────────────────────────────┐
│                                                                │
│  Database: organization_integrations                          │
│                                                                │
│  UPDATE organization_integrations SET                         │
│    oauth_tokens = {                                           │
│      access_token: encrypt("eyJh..."),                        │
│      refresh_token: encrypt("AwAB..."),                       │
│      expires_at: now() + interval '3600 seconds'              │
│    },                                                          │
│    connection_status = 'connected',                           │
│    last_tested_at = now()                                     │
│  WHERE provider_id = 'zoom-provider-id'                       │
│                                                                │
└──────┬─────────────────────────────────────────────────────────┘
       │
       │  6. Log integration activity
       │
┌──────▼────────────────────────────────────────────────────────┐
│                                                                │
│  Database: integration_usage_logs                             │
│                                                                │
│  INSERT INTO integration_usage_logs (                         │
│    provider_id,                                               │
│    action: 'oauth_connected',                                 │
│    status: 'success',                                         │
│    user_id: current_user_id                                   │
│  )                                                             │
│                                                                │
└──────┬─────────────────────────────────────────────────────────┘
       │
       │  7. Redirect back to integration page
       │
┌──────▼──────────────────────────────────────────────┐
│                                                      │
│  Integration Detail Page                            │
│  /admin/integrations/zoom?success=true              │
│                                                      │
│  - Display success toast                            │
│  - Reload provider status                           │
│  - Show "Connected" badge                           │
│  - Display available services                       │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Token Refresh Flow

```
┌───────────────────────────────────────────────┐
│                                               │
│  Background Job / API Request                 │
│  (Token expired or expiring soon)             │
│                                               │
└───────┬───────────────────────────────────────┘
        │
        │  1. Detect token expiration
        │     (expires_at < now() + 5 minutes)
        │
┌───────▼────────────────────────────────────────────────┐
│                                                         │
│  Token Refresh Service                                 │
│                                                         │
│  1. Retrieve refresh_token from database               │
│  2. Request new access_token                           │
│                                                         │
│     POST /oauth/token                                  │
│     - grant_type=refresh_token                         │
│     - refresh_token=AwAB...                            │
│     - client_id=xxx                                    │
│     - client_secret=xxx                                │
│                                                         │
└───────┬────────────────────────────────────────────────┘
        │
        │  3. Receive new tokens
        │
┌───────▼─────────────────────────────────────────────┐
│  {                                                   │
│    access_token: "eyJh_NEW...",                     │
│    refresh_token: "AwAB_NEW..." (sometimes),        │
│    expires_in: 3600                                 │
│  }                                                   │
└───────┬─────────────────────────────────────────────┘
        │
        │  4. Update database
        │
┌───────▼──────────────────────────────────────────────────┐
│  UPDATE organization_integrations SET                    │
│    oauth_tokens = jsonb_set(                             │
│      oauth_tokens,                                       │
│      '{access_token}',                                   │
│      encrypt("eyJh_NEW...")                             │
│    ),                                                    │
│    oauth_tokens = jsonb_set(                             │
│      oauth_tokens,                                       │
│      '{expires_at}',                                     │
│      to_jsonb(now() + interval '3600 seconds')          │
│    )                                                     │
│  WHERE provider_id = 'zoom-provider-id'                  │
└──────────────────────────────────────────────────────────┘
```

---

## API Key Authentication Flow

### Simpler flow for API key-based providers (OpenAI, Anthropic, SendGrid, etc.)

```
┌─────────────┐
│             │
│   Admin     │
│   User      │
│             │
└──────┬──────┘
       │
       │  1. Navigate to provider detail page
       │
┌──────▼──────────────────────────────────────────────┐
│                                                      │
│  Integration Detail Page                            │
│  /admin/integrations/openai                         │
│                                                      │
│  ┌────────────────────────────────────────────┐    │
│  │  API Key: [____________________________]   │    │
│  │                                            │    │
│  │  Organization ID: [_________________]      │    │
│  │                                            │    │
│  │  [Test Connection]  [Save]                │    │
│  └────────────────────────────────────────────┘    │
│                                                      │
└──────┬──────────────────────────────────────────────┘
       │
       │  2. Click "Test Connection"
       │
┌──────▼──────────────────────────────────────────────────┐
│                                                          │
│  Edge Function: validate-api-key                        │
│                                                          │
│  {                                                       │
│    provider: "openai",                                  │
│    credentials: {                                       │
│      api_key: "sk-...",                                 │
│      organization_id: "org-..."                         │
│    }                                                     │
│  }                                                       │
│                                                          │
└──────┬──────────────────────────────────────────────────┘
       │
       │  3. Call provider API to validate
       │
       │  Example for OpenAI:
       │  GET https://api.openai.com/v1/models
       │  Headers: Authorization: Bearer sk-...
       │           OpenAI-Organization: org-...
       │
┌──────▼─────────────────────────────────────────────┐
│                                                     │
│  Provider API                                      │
│  (OpenAI)                                          │
│                                                     │
│  If valid:                                         │
│    HTTP 200 OK                                     │
│    { "data": [list of models] }                    │
│                                                     │
│  If invalid:                                       │
│    HTTP 401 Unauthorized                           │
│    { "error": "Invalid API key" }                  │
│                                                     │
└──────┬─────────────────────────────────────────────┘
       │
       │  4. Return validation result
       │
┌──────▼──────────────────────────────────────────────┐
│                                                      │
│  Edge Function Response                             │
│                                                      │
│  Success:                                           │
│  {                                                   │
│    valid: true,                                     │
│    message: "Connection successful",                │
│    details: {                                       │
│      provider: "OpenAI",                            │
│      organization: "Your Org Name",                 │
│      models_available: 15                           │
│    }                                                 │
│  }                                                   │
│                                                      │
│  Error:                                             │
│  {                                                   │
│    valid: false,                                    │
│    message: "Invalid API key",                      │
│    error_code: "INVALID_CREDENTIALS"                │
│  }                                                   │
│                                                      │
└──────┬──────────────────────────────────────────────┘
       │
       │  5. Display result to user
       │
┌──────▼──────────────────────────────────────────────┐
│                                                      │
│  UI Toast Notification                              │
│                                                      │
│  ✓ Connection successful                            │
│    Connected to OpenAI with 15 models available     │
│                                                      │
│  [Save Configuration]                               │
│                                                      │
└──────┬──────────────────────────────────────────────┘
       │
       │  6. Click "Save Configuration"
       │
┌──────▼────────────────────────────────────────────────────┐
│                                                            │
│  Database: organization_integrations                      │
│                                                            │
│  INSERT INTO organization_integrations (                  │
│    provider_id,                                           │
│    enabled: true,                                         │
│    config: {                                              │
│      api_key: encrypt("sk-..."),                          │
│      organization_id: "org-..."                           │
│    },                                                      │
│    connection_status: 'connected',                        │
│    last_tested_at: now()                                  │
│  )                                                         │
│  ON CONFLICT (provider_id) DO UPDATE...                   │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## Webhook Event Processing

### Generic webhook flow for real-time events

```
┌──────────────────────────────────────┐
│                                      │
│  Provider (Zoom, Teams, etc.)        │
│                                      │
│  Event occurs:                       │
│  - Meeting started                   │
│  - Recording completed               │
│  - Transcript ready                  │
│                                      │
└──────┬───────────────────────────────┘
       │
       │  1. Send webhook POST request
       │
       │  POST /functions/v1/webhooks/:provider
       │  Headers:
       │    Content-Type: application/json
       │    X-Webhook-Signature: sha256=...
       │  Body:
       │  {
       │    event: "recording.completed",
       │    timestamp: 1641000000,
       │    data: { ... }
       │  }
       │
┌──────▼─────────────────────────────────────────────┐
│                                                     │
│  Edge Function: webhooks/:provider                 │
│                                                     │
│  Step 1: Verify webhook signature                  │
│  ────────────────────────────────────              │
│  const signature = headers['X-Webhook-Signature']; │
│  const payload = await request.text();             │
│  const isValid = verifySignature(                  │
│    payload,                                        │
│    signature,                                      │
│    webhookSecret                                   │
│  );                                                 │
│                                                     │
│  if (!isValid) {                                   │
│    return 401 Unauthorized                         │
│  }                                                  │
│                                                     │
└──────┬─────────────────────────────────────────────┘
       │
       │  Step 2: Parse and validate event
       │
┌──────▼─────────────────────────────────────────────┐
│                                                     │
│  Event Processor                                   │
│                                                     │
│  const event = JSON.parse(payload);                │
│                                                     │
│  switch (event.type) {                             │
│    case 'recording.completed':                     │
│      await processRecordingCompleted(event);       │
│      break;                                        │
│    case 'meeting.started':                         │
│      await processMeetingStarted(event);           │
│      break;                                        │
│    // ... other event types                        │
│  }                                                  │
│                                                     │
└──────┬─────────────────────────────────────────────┘
       │
       │  Step 3: Process event
       │  (Example: recording.completed)
       │
┌──────▼─────────────────────────────────────────────────────┐
│                                                             │
│  processRecordingCompleted(event)                          │
│                                                             │
│  1. Extract recording metadata                             │
│     const {                                                │
│       meeting_id,                                          │
│       recording_files,                                     │
│       download_url                                         │
│     } = event.data;                                        │
│                                                             │
│  2. Check if auto-download is enabled                      │
│     const settings = await getProviderSettings();          │
│     if (!settings.auto_download_recordings) {              │
│       return; // Just log the event                        │
│     }                                                       │
│                                                             │
│  3. Download recording file                                │
│     const file = await fetch(download_url);                │
│     const blob = await file.blob();                        │
│                                                             │
│  4. Store according to configuration                       │
│     if (settings.storage_location === 's3') {              │
│       await uploadToS3(blob, metadata);                    │
│     } else if (settings.storage_location === 'database') { │
│       await storeInDatabase(blob, metadata);               │
│     }                                                       │
│                                                             │
│  5. Create database record                                 │
│     await supabase                                         │
│       .from('zoom_recordings')                             │
│       .insert({                                            │
│         meeting_id,                                        │
│         zoom_recording_id: event.data.id,                  │
│         file_type: event.data.file_type,                   │
│         download_url,                                      │
│         downloaded_at: new Date(),                         │
│         storage_location: settings.storage_location        │
│       });                                                   │
│                                                             │
│  6. Trigger post-processing                                │
│     if (settings.ai_processing_enabled) {                  │
│       await queueAIProcessing(recording_id);               │
│     }                                                       │
│                                                             │
│  7. Send notifications                                     │
│     if (settings.notification_channels.includes('email')) {│
│       await sendEmailNotification({                        │
│         to: meeting_organizer_email,                       │
│         subject: 'Recording Ready',                        │
│         body: 'Your meeting recording is available'        │
│       });                                                   │
│     }                                                       │
│                                                             │
└──────┬──────────────────────────────────────────────────────┘
       │
       │  Step 4: Log webhook processing
       │
┌──────▼────────────────────────────────────────────────────┐
│                                                            │
│  Database: integration_usage_logs                         │
│                                                            │
│  INSERT INTO integration_usage_logs (                     │
│    provider_id: 'zoom-provider-id',                       │
│    action: 'webhook_received',                            │
│    status: 'success',                                     │
│    request_metadata: {                                    │
│      event_type: 'recording.completed',                   │
│      meeting_id: '123456',                                │
│      file_size: 125000000                                 │
│    },                                                      │
│    estimated_cost: 0 // Webhooks are free                 │
│  )                                                         │
│                                                            │
└──────┬─────────────────────────────────────────────────────┘
       │
       │  Step 5: Return 200 OK to provider
       │
┌──────▼─────────────────────────────────────────────┐
│                                                     │
│  Response to Provider                              │
│                                                     │
│  HTTP 200 OK                                       │
│  {                                                  │
│    received: true,                                 │
│    event_id: "evt_123"                             │
│  }                                                  │
│                                                     │
│  Important: Respond quickly (< 3 seconds)          │
│  to avoid webhook timeout                          │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Meeting Sync Architecture

### Scheduled background job for periodic synchronization

```
┌───────────────────────────────────────┐
│                                       │
│  Cron Job / Scheduled Task            │
│  (Runs every 15 minutes)              │
│                                       │
│  Trigger:                             │
│  - pg_cron schedule                   │
│  - External scheduler (Vercel Cron)   │
│  - Manual trigger from UI             │
│                                       │
└───────┬───────────────────────────────┘
        │
        │  1. Invoke sync edge function
        │
┌───────▼─────────────────────────────────────────────────┐
│                                                          │
│  Edge Function: sync-zoom-meetings                      │
│                                                          │
│  Step 1: Get all connected integrations                 │
│  ─────────────────────────────────────────              │
│  const { data: integrations } = await supabase          │
│    .from('organization_integrations')                   │
│    .select(`                                            │
│      *,                                                 │
│      provider:integration_providers(*)                  │
│    `)                                                    │
│    .eq('enabled', true)                                 │
│    .eq('provider.category_id', 'meeting-providers')     │
│    .eq('connection_status', 'connected');               │
│                                                          │
└───────┬─────────────────────────────────────────────────┘
        │
        │  Step 2: For each integration, sync meetings
        │
        ├─────────────────┬────────────────┬──────────────┐
        │                 │                │              │
┌───────▼────┐    ┌───────▼────┐   ┌──────▼─────┐       │
│ Zoom       │    │ MS Teams   │   │ Google     │       │
│ Sync       │    │ Sync       │   │ Meet Sync  │       │
└───────┬────┘    └───────┬────┘   └──────┬─────┘       │
        │                 │                │              │
        │  Parallel execution (Promise.all)              │
        └─────────────────┴────────────────┴──────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                                                              │
│  syncProviderMeetings(integration)                          │
│                                                              │
│  1. Get access token (refresh if needed)                    │
│     const accessToken = await getValidAccessToken(          │
│       integration.oauth_tokens                              │
│     );                                                       │
│                                                              │
│  2. Fetch meetings from provider API                        │
│     const response = await fetch(                           │
│       `${provider.baseUrl}/users/me/meetings`,              │
│       {                                                      │
│         headers: {                                          │
│           Authorization: `Bearer ${accessToken}`            │
│         }                                                    │
│       }                                                      │
│     );                                                       │
│     const meetings = await response.json();                 │
│                                                              │
│  3. Transform to standard format                            │
│     const standardized = meetings.map(m => ({               │
│       external_id: m.id,                                    │
│       external_uuid: m.uuid,                                │
│       provider_slug: integration.provider.slug,             │
│       title: m.topic || m.subject,                          │
│       start_time: m.start_time || m.startDateTime,          │
│       duration_minutes: m.duration,                         │
│       join_url: m.join_url || m.joinUrl,                    │
│       host_email: m.host_email,                             │
│       participants: m.participants,                         │
│       raw_data: m                                           │
│     }));                                                     │
│                                                              │
│  4. Upsert to database                                      │
│     await supabase                                          │
│       .from('meetings')                                     │
│       .upsert(standardized, {                               │
│         onConflict: 'provider_slug,external_id'             │
│       });                                                    │
│                                                              │
│  5. Update last_sync_at timestamp                           │
│     await supabase                                          │
│       .from('organization_integrations')                    │
│       .update({ last_sync_at: new Date() })                 │
│       .eq('id', integration.id);                            │
│                                                              │
│  6. Log sync activity                                       │
│     await logUsage({                                        │
│       provider_id: integration.provider_id,                 │
│       action: 'sync_meetings',                              │
│       status: 'success',                                    │
│       metadata: { count: standardized.length }              │
│     });                                                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Recording Download Flow

```
┌────────────────────────────────────────┐
│                                        │
│  Trigger Event:                        │
│  - Webhook: recording.completed        │
│  - Manual download request             │
│  - Scheduled batch download            │
│                                        │
└────────┬───────────────────────────────┘
         │
┌────────▼──────────────────────────────────────────┐
│                                                    │
│  Download Recording Worker                        │
│                                                    │
│  Input:                                           │
│  {                                                 │
│    meeting_id: "123456",                          │
│    recording_id: "rec-789",                       │
│    download_url: "https://...",                   │
│    provider: "zoom",                              │
│    file_type: "MP4",                              │
│    file_size: 125000000                           │
│  }                                                 │
│                                                    │
└────────┬──────────────────────────────────────────┘
         │
         │  1. Get provider access token
         │
┌────────▼──────────────────────────────────────────┐
│  const { oauth_tokens } = await supabase          │
│    .from('organization_integrations')             │
│    .select('oauth_tokens')                        │
│    .eq('provider_id', providerId)                 │
│    .single();                                      │
│                                                    │
│  const accessToken = oauth_tokens.access_token;   │
└────────┬──────────────────────────────────────────┘
         │
         │  2. Stream download from provider
         │
┌────────▼──────────────────────────────────────────────────┐
│  const response = await fetch(download_url, {             │
│    headers: {                                             │
│      Authorization: `Bearer ${accessToken}`               │
│    }                                                       │
│  });                                                       │
│                                                            │
│  if (!response.ok) {                                      │
│    throw new Error('Download failed');                   │
│  }                                                         │
│                                                            │
│  const stream = response.body;                            │
│  const totalBytes = file_size;                            │
│  let downloadedBytes = 0;                                 │
│                                                            │
│  // Update progress in real-time (optional)               │
│  stream.on('data', (chunk) => {                           │
│    downloadedBytes += chunk.length;                       │
│    const progress = (downloadedBytes / totalBytes) * 100; │
│    // Emit progress event                                 │
│  });                                                       │
└────────┬───────────────────────────────────────────────────┘
         │
         │  3. Store based on configuration
         │
         ├─────────┬─────────────┬──────────────┐
         │         │             │              │
┌────────▼───┐ ┌──▼────────┐ ┌──▼─────────┐   │
│ Database   │ │ AWS S3    │ │ Google     │   │
│ Storage    │ │ Storage   │ │ Drive      │   │
└────────┬───┘ └──┬────────┘ └──┬─────────┘   │
         │         │             │              │
         └─────────┴─────────────┴──────────────┘
                   │
┌──────────────────▼────────────────────────────────────┐
│  Storage Handler                                      │
│                                                        │
│  if (storage_location === 'database') {               │
│    // Store as bytea in PostgreSQL                    │
│    await supabase.storage                             │
│      .from('recordings')                              │
│      .upload(`${meeting_id}/${recording_id}.mp4`,     │
│        stream                                         │
│      );                                                │
│  }                                                     │
│                                                        │
│  else if (storage_location === 's3') {                │
│    // Upload to S3                                    │
│    await s3Client.send(new PutObjectCommand({         │
│      Bucket: 'recordings-bucket',                     │
│      Key: `${meeting_id}/${recording_id}.mp4`,        │
│      Body: stream                                     │
│    }));                                                │
│  }                                                     │
│                                                        │
│  else if (storage_location === 'google_drive') {      │
│    // Upload to Google Drive                          │
│    await googleDrive.files.create({                   │
│      requestBody: {                                   │
│        name: `${meeting_title}.mp4`,                  │
│        parents: [folderId]                            │
│      },                                                │
│      media: { body: stream }                          │
│    });                                                 │
│  }                                                     │
│                                                        │
└──────────────────┬────────────────────────────────────┘
                   │
                   │  4. Create database record
                   │
┌──────────────────▼────────────────────────────────────┐
│  await supabase                                       │
│    .from('zoom_recordings')                           │
│    .insert({                                          │
│      meeting_id,                                      │
│      zoom_recording_id: recording_id,                 │
│      file_type: 'MP4',                                │
│      file_size,                                       │
│      download_url,                                    │
│      storage_location,                                │
│      local_path: storage_path,                        │
│      downloaded_at: new Date(),                       │
│      status: 'completed'                              │
│    });                                                 │
└──────────────────┬────────────────────────────────────┘
                   │
                   │  5. Trigger post-processing
                   │
┌──────────────────▼────────────────────────────────────┐
│  Post-Processing Queue                                │
│                                                        │
│  - Transcript extraction                              │
│  - AI summarization                                   │
│  - Thumbnail generation                               │
│  - Format conversion                                  │
│  - Metadata extraction                                │
│                                                        │
└───────────────────────────────────────────────────────┘
```

---

## Multi-Provider AI Routing

### How AI requests are routed to different providers

```
┌──────────────────────────────────────┐
│                                      │
│  User Request                        │
│  "Summarize this meeting transcript"│
│                                      │
└──────┬───────────────────────────────┘
       │
┌──────▼──────────────────────────────────────────────┐
│                                                      │
│  AI Chat Interface / API Endpoint                   │
│                                                      │
│  Request parameters:                                │
│  {                                                   │
│    prompt: "Summarize this transcript...",          │
│    model: "default" or "gpt-4o" or "claude-sonnet", │
│    max_tokens: 500,                                 │
│    temperature: 0.7                                 │
│  }                                                   │
│                                                      │
└──────┬──────────────────────────────────────────────┘
       │
┌──────▼────────────────────────────────────────────────┐
│                                                        │
│  AI Provider Router                                   │
│  (Edge Function: _shared/ai-provider-routing.ts)      │
│                                                        │
│  Step 1: Determine which provider to use             │
│  ──────────────────────────────────────              │
│  if (model === 'default') {                           │
│    // Get default chat model from database           │
│    const { data } = await supabase                    │
│      .from('ai_models')                               │
│      .select('*, provider:ai_providers(*)')           │
│      .eq('category', 'chat')                          │
│      .eq('is_default', true)                          │
│      .eq('enabled', true)                             │
│      .single();                                        │
│                                                        │
│    model = data; // e.g., Claude Sonnet 4            │
│    provider = data.provider; // Anthropic            │
│  } else {                                             │
│    // Look up specific model                         │
│    const { data } = await supabase                    │
│      .from('ai_models')                               │
│      .select('*, provider:ai_providers(*)')           │
│      .eq('model_id', model)                           │
│      .single();                                        │
│                                                        │
│    model = data;                                      │
│    provider = data.provider;                          │
│  }                                                     │
│                                                        │
│  Step 2: Get provider credentials                    │
│  ───────────────────────────────────                 │
│  const { data: integration } = await supabase         │
│    .from('organization_integrations')                 │
│    .select('config')                                  │
│    .eq('provider_id', provider.id)                    │
│    .single();                                          │
│                                                        │
│  const apiKey = decrypt(integration.config.api_key);  │
│                                                        │
└──────┬─────────────────────────────────────────────────┘
       │
       │  Step 3: Route to appropriate provider
       │
       ├───────────┬────────────┬──────────────┬──────────┐
       │           │            │              │          │
┌──────▼──────┐ ┌─▼────────┐ ┌─▼──────────┐ ┌─▼────────┐│
│ OpenAI      │ │Anthropic │ │ Google     │ │Perplexity││
│ API         │ │ API      │ │ Gemini API │ │ API      ││
└──────┬──────┘ └─┬────────┘ └─┬──────────┘ └─┬────────┘│
       │           │            │              │          │
       │  POST /v1/chat/completions            │          │
       │           │            │              │          │
       └───────────┴────────────┴──────────────┴──────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│  Provider-Specific Request Formatting                   │
│                                                          │
│  OpenAI/Perplexity Format:                              │
│  {                                                       │
│    model: "gpt-4o",                                     │
│    messages: [                                          │
│      { role: "user", content: "Summarize..." }         │
│    ],                                                    │
│    max_tokens: 500,                                     │
│    temperature: 0.7                                     │
│  }                                                       │
│                                                          │
│  Anthropic Format:                                      │
│  {                                                       │
│    model: "claude-sonnet-4-20250514",                   │
│    messages: [                                          │
│      { role: "user", content: "Summarize..." }         │
│    ],                                                    │
│    max_tokens: 500,                                     │
│    temperature: 0.7                                     │
│  }                                                       │
│                                                          │
│  Google Gemini Format:                                  │
│  {                                                       │
│    contents: [                                          │
│      { parts: [{ text: "Summarize..." }] }             │
│    ],                                                    │
│    generationConfig: {                                  │
│      maxOutputTokens: 500,                              │
│      temperature: 0.7                                   │
│    }                                                     │
│  }                                                       │
│                                                          │
└──────────────────┬──────────────────────────────────────┘
                   │
                   │  Step 4: Make API request
                   │
┌──────────────────▼──────────────────────────────────────┐
│  const response = await fetch(provider.base_url, {      │
│    method: 'POST',                                      │
│    headers: {                                           │
│      'Authorization': `Bearer ${apiKey}`,               │
│      'Content-Type': 'application/json',                │
│      ...providerSpecificHeaders                         │
│    },                                                    │
│    body: JSON.stringify(formattedRequest)               │
│  });                                                     │
│                                                          │
│  const data = await response.json();                    │
└──────────────────┬──────────────────────────────────────┘
                   │
                   │  Step 5: Calculate cost & log usage
                   │
┌──────────────────▼──────────────────────────────────────┐
│  Calculate Cost:                                        │
│  const inputCost =                                      │
│    (inputTokens / 1000) * model.input_cost_per_1k;      │
│  const outputCost =                                     │
│    (outputTokens / 1000) * model.output_cost_per_1k;    │
│  const totalCost = inputCost + outputCost;              │
│                                                          │
│  Log Usage:                                             │
│  await supabase                                         │
│    .from('integration_usage_logs')                      │
│    .insert({                                            │
│      provider_id: provider.id,                          │
│      service_id: model.id,                              │
│      user_id: currentUserId,                            │
│      action: 'chat_completion',                         │
│      status: 'success',                                 │
│      request_metadata: {                                │
│        model: model.model_id,                           │
│        input_tokens: inputTokens,                       │
│        output_tokens: outputTokens                      │
│      },                                                  │
│      estimated_cost: totalCost                          │
│    });                                                   │
└──────────────────┬──────────────────────────────────────┘
                   │
                   │  Step 6: Return standardized response
                   │
┌──────────────────▼──────────────────────────────────────┐
│  Standardized Response Format:                         │
│  {                                                       │
│    content: "Summary of the meeting...",                │
│    model: "claude-sonnet-4-20250514",                   │
│    provider: "anthropic",                               │
│    usage: {                                             │
│      input_tokens: 1200,                                │
│      output_tokens: 350,                                │
│      total_tokens: 1550                                 │
│    },                                                    │
│    cost: {                                              │
│      input: 0.0036,                                     │
│      output: 0.0105,                                    │
│      total: 0.0141,                                     │
│      currency: "USD"                                    │
│    },                                                    │
│    metadata: {                                          │
│      finish_reason: "stop",                             │
│      response_time_ms: 1245                             │
│    }                                                     │
│  }                                                       │
└─────────────────────────────────────────────────────────┘
```

---

## Usage Logging & Analytics

### How integration usage is tracked and displayed

```
┌───────────────────────────────────────┐
│                                       │
│  Integration Event                    │
│  (API call, webhook, sync, etc.)      │
│                                       │
└───────┬───────────────────────────────┘
        │
        │  Every integration action
        │  triggers a usage log entry
        │
┌───────▼─────────────────────────────────────────────────┐
│                                                          │
│  logIntegrationUsage({                                  │
│    provider_id: 'zoom-provider-id',                     │
│    service_id: 'zoom-recordings-service-id',            │
│    user_id: 'user-123',                                 │
│    action: 'download_recording',                        │
│    status: 'success',                                   │
│    request_metadata: {                                  │
│      meeting_id: '123456',                              │
│      file_size: 125000000,                              │
│      duration: 45                                       │
│    },                                                    │
│    estimated_cost: 0.05                                 │
│  })                                                      │
│                                                          │
└───────┬─────────────────────────────────────────────────┘
        │
        │  Insert into database
        │
┌───────▼─────────────────────────────────────────────────┐
│                                                          │
│  Database: integration_usage_logs                       │
│                                                          │
│  INSERT INTO integration_usage_logs (                   │
│    id,                                                  │
│    organization_id,                                     │
│    provider_id,                                         │
│    service_id,                                          │
│    user_id,                                             │
│    action,                                              │
│    status,                                              │
│    request_metadata,                                    │
│    estimated_cost,                                      │
│    created_at                                           │
│  ) VALUES (...)                                         │
│                                                          │
│  Indexes ensure fast aggregation:                       │
│  - idx_usage_logs_provider (provider_id)                │
│  - idx_usage_logs_created_at (created_at)               │
│  - idx_usage_logs_user (user_id)                        │
│                                                          │
└───────┬─────────────────────────────────────────────────┘
        │
        │  Analytics queries aggregate logs
        │
┌───────▼─────────────────────────────────────────────────────┐
│                                                              │
│  Analytics Query Examples:                                  │
│                                                              │
│  1. Total API calls per provider (this month):              │
│     SELECT                                                  │
│       p.name,                                               │
│       COUNT(*) as api_calls,                                │
│       SUM(estimated_cost) as total_cost                     │
│     FROM integration_usage_logs l                           │
│     JOIN integration_providers p ON l.provider_id = p.id    │
│     WHERE created_at >= date_trunc('month', now())          │
│     GROUP BY p.id, p.name                                   │
│     ORDER BY api_calls DESC;                                │
│                                                              │
│  2. Success rate by provider:                               │
│     SELECT                                                  │
│       p.name,                                               │
│       COUNT(*) FILTER (WHERE status = 'success') * 100.0    │
│         / COUNT(*) as success_rate                          │
│     FROM integration_usage_logs l                           │
│     JOIN integration_providers p ON l.provider_id = p.id    │
│     GROUP BY p.id, p.name;                                  │
│                                                              │
│  3. Top users by API usage:                                 │
│     SELECT                                                  │
│       u.email,                                              │
│       COUNT(*) as api_calls,                                │
│       SUM(estimated_cost) as total_cost                     │
│     FROM integration_usage_logs l                           │
│     JOIN auth.users u ON l.user_id = u.id                   │
│     WHERE created_at >= now() - interval '30 days'          │
│     GROUP BY u.id, u.email                                  │
│     ORDER BY api_calls DESC                                 │
│     LIMIT 10;                                               │
│                                                              │
│  4. Cost trend over time:                                   │
│     SELECT                                                  │
│       date_trunc('day', created_at) as date,                │
│       SUM(estimated_cost) as daily_cost                     │
│     FROM integration_usage_logs                             │
│     WHERE created_at >= now() - interval '30 days'          │
│     GROUP BY date                                           │
│     ORDER BY date;                                          │
│                                                              │
└───────┬──────────────────────────────────────────────────────┘
        │
        │  Display in analytics dashboard
        │
┌───────▼──────────────────────────────────────────────────┐
│                                                           │
│  Analytics Dashboard UI                                  │
│  /admin/integration-analytics                            │
│                                                           │
│  Components:                                             │
│  - Overview cards (total calls, cost, success rate)      │
│  - Usage by category chart                               │
│  - Cost breakdown table                                  │
│  - Top users list                                        │
│  - Error analytics                                       │
│  - Budget alerts                                         │
│                                                           │
│  Real-time updates via:                                  │
│  - Polling (every 30 seconds)                            │
│  - Real-time subscriptions (Supabase Realtime)           │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

---

## Summary

These data flow diagrams illustrate:

1. **OAuth 2.0 Flow**: Complete authorization flow from user click to token storage
2. **API Key Authentication**: Simpler flow for API key-based providers
3. **Webhook Processing**: Real-time event handling with signature verification
4. **Meeting Sync**: Scheduled background synchronization architecture
5. **Recording Downloads**: File download and storage routing
6. **Multi-Provider AI**: Intelligent routing across multiple AI providers with cost tracking
7. **Usage Logging**: Comprehensive tracking for analytics and monitoring

All flows are designed to be:
- **Secure**: Proper authentication, encryption, and validation
- **Scalable**: Async processing, parallel execution, queueing
- **Observable**: Comprehensive logging and error tracking
- **Cost-Effective**: Usage tracking and budget monitoring
- **Reliable**: Retry logic, error handling, and fallbacks

---

**Last Updated**: January 2, 2026
