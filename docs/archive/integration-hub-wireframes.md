# Integration Hub - Detailed Wireframes

## Table of Contents
1. [Integration Hub (Main Page)](#integration-hub-main-page)
2. [Provider Detail Page - API Key Auth](#provider-detail-page-api-key-auth)
3. [Provider Detail Page - OAuth](#provider-detail-page-oauth)
4. [Enhanced Provider Pages](#enhanced-provider-pages)
5. [Integration Analytics Dashboard](#integration-analytics-dashboard)
6. [Component Specifications](#component-specifications)

---

## Integration Hub (Main Page)

**Route**: `/admin/integrations`

### Layout Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ← Admin Dashboard                                          [User] [Settings] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  Integration Hub                                         [View Analytics →] │
│  Configure third-party service integrations                                  │
│                                                                               │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  🔍 Search integrations...                         [Filter: All ▼]    │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ ▼ AI Providers                              4 providers, 2 connected    ││
│  ├─────────────────────────────────────────────────────────────────────────┤│
│  │                                                                           ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐││
│  │  │  ┌────────┐  │  │  ┌────────┐  │  │  ┌────────┐  │  │  ┌────────┐  │││
│  │  │  │ [🧠]   │  │  │  │ [✨]   │  │  │  │ [☁️]   │  │  │  │ [⚡]   │  │││
│  │  │  └────────┘  │  │  └────────┘  │  │  └────────┘  │  │  └────────┘  │││
│  │  │              │  │              │  │              │  │              │││
│  │  │   OpenAI     │  │   Anthropic  │  │    Google    │  │  Perplexity  │││
│  │  │   Claude     │  │    Claude    │  │    Gemini    │  │    Sonar     │││
│  │  │              │  │              │  │              │  │              │││
│  │  │ ● Connected  │  │ ● Connected  │  │ ○ Configure  │  │ ○ Configure  │││
│  │  │ 4 models     │  │ 3 models     │  │ 3 models     │  │ 2 models     │││
│  │  │              │  │              │  │              │  │              │││
│  │  │ [Configure]  │  │ [Configure]  │  │ [Configure]  │  │ [Configure]  │││
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘││
│  │                                                                           ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ ▼ Meeting Providers                         5 providers, 1 connected    ││
│  ├─────────────────────────────────────────────────────────────────────────┤│
│  │                                                                           ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐││
│  │  │  ┌────────┐  │  │  ┌────────┐  │  │  ┌────────┐  │  │  ┌────────┐  │││
│  │  │  │ [📹]   │  │  │  │ [🎯]   │  │  │  │ [📱]   │  │  │  │ [🌐]   │  │││
│  │  │  └────────┘  │  │  └────────┘  │  │  └────────┘  │  │  └────────┘  │││
│  │  │              │  │              │  │              │  │              │││
│  │  │    Zoom      │  │ MS Teams     │  │ Google Meet  │  │    Webex     │││
│  │  │              │  │              │  │              │  │    (Cisco)   │││
│  │  │              │  │              │  │              │  │              │││
│  │  │ ● Connected  │  │ ○ Configure  │  │ ○ Configure  │  │ 🔜 Soon      │││
│  │  │ OAuth 2.0    │  │ OAuth 2.0    │  │ OAuth 2.0    │  │              │││
│  │  │              │  │              │  │              │  │              │││
│  │  │ [Configure]  │  │ [Connect]    │  │ [Connect]    │  │              │││
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘││
│  │                                                                           ││
│  │  ┌──────────────┐                                                        ││
│  │  │  ┌────────┐  │                                                        ││
│  │  │  │ [📞]   │  │                                                        ││
│  │  │  └────────┘  │                                                        ││
│  │  │              │                                                        ││
│  │  │ GoToMeeting  │                                                        ││
│  │  │              │                                                        ││
│  │  │              │                                                        ││
│  │  │ ○ Configure  │                                                        ││
│  │  │ OAuth 2.0    │                                                        ││
│  │  │              │                                                        ││
│  │  │ [Connect]    │                                                        ││
│  │  └──────────────┘                                                        ││
│  │                                                                           ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ ▶ Email Providers                           4 providers, 1 connected    ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ ▶ CRM Systems                               4 providers, 0 connected    ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ ▶ Project Management                        4 providers, 0 connected    ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ ▶ Storage & Productivity                    2 providers, 0 connected    ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### UI Components Breakdown

#### Header Section
```tsx
<div className="flex items-center justify-between mb-6">
  <div>
    <h1 className="text-3xl font-bold tracking-tight">Integration Hub</h1>
    <p className="text-muted-foreground">
      Configure third-party service integrations
    </p>
  </div>
  <Button variant="outline" onClick={() => navigate('/admin/integration-analytics')}>
    <BarChart3 className="mr-2 h-4 w-4" />
    View Analytics
  </Button>
</div>
```

#### Search & Filter Bar
```tsx
<div className="flex gap-4 mb-6">
  <div className="flex-1">
    <Input
      placeholder="Search integrations..."
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      icon={<Search className="h-4 w-4" />}
    />
  </div>
  <Select value={filterCategory} onValueChange={setFilterCategory}>
    <SelectTrigger className="w-48">
      <SelectValue placeholder="Filter: All" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">All Categories</SelectItem>
      <SelectItem value="ai-providers">AI Providers</SelectItem>
      <SelectItem value="meeting-providers">Meeting Providers</SelectItem>
      <SelectItem value="email-providers">Email Providers</SelectItem>
      <SelectItem value="crm-systems">CRM Systems</SelectItem>
      <SelectItem value="project-management">Project Management</SelectItem>
      <SelectItem value="storage-productivity">Storage & Productivity</SelectItem>
    </SelectContent>
  </Select>
</div>
```

#### Category Section (Collapsible)
```tsx
<Collapsible open={expandedCategories.includes(category.id)} onOpenChange={() => toggleCategory(category.id)}>
  <Card>
    <CollapsibleTrigger className="w-full">
      <CardHeader className="flex flex-row items-center justify-between cursor-pointer hover:bg-muted/50">
        <div className="flex items-center gap-3">
          <ChevronRight className={`h-5 w-5 transition-transform ${expandedCategories.includes(category.id) ? 'rotate-90' : ''}`} />
          <div className="flex items-center gap-2">
            {getCategoryIcon(category.icon)}
            <CardTitle>{category.name}</CardTitle>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          {category.providers.length} providers, {connectedCount} connected
        </div>
      </CardHeader>
    </CollapsibleTrigger>
    <CollapsibleContent>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {category.providers.map(provider => (
            <ProviderCard key={provider.id} provider={provider} />
          ))}
        </div>
      </CardContent>
    </CollapsibleContent>
  </Card>
</Collapsible>
```

#### Provider Card Component
```tsx
<Card className="border-2 hover:border-primary/50 transition-colors cursor-pointer" onClick={() => navigate(`/admin/integrations/${provider.slug}`)}>
  <CardContent className="p-4">
    <div className="flex flex-col items-center text-center gap-3">
      {/* Icon */}
      <div className="rounded-lg border p-3 bg-muted/50">
        {getProviderIcon(provider.slug, 'h-8 w-8')}
      </div>

      {/* Name */}
      <div>
        <p className="font-semibold">{provider.name}</p>
        <p className="text-xs text-muted-foreground">{provider.description}</p>
      </div>

      {/* Status Badge */}
      <Badge variant={getStatusVariant(provider.status)}>
        {provider.status === 'connected' && <CheckCircle2 className="mr-1 h-3 w-3" />}
        {provider.status === 'disconnected' && <Circle className="mr-1 h-3 w-3" />}
        {provider.status === 'coming_soon' && <Clock className="mr-1 h-3 w-3" />}
        {getStatusLabel(provider.status)}
      </Badge>

      {/* Metadata */}
      {provider.status === 'connected' && (
        <p className="text-xs text-muted-foreground">
          {provider.serviceCount} {provider.serviceCount === 1 ? 'service' : 'services'}
        </p>
      )}
      {provider.status === 'disconnected' && (
        <p className="text-xs text-muted-foreground">{provider.authType}</p>
      )}

      {/* Action Button */}
      <Button
        variant={provider.status === 'connected' ? 'outline' : 'default'}
        size="sm"
        className="w-full"
        disabled={provider.is_coming_soon}
        onClick={(e) => {
          e.stopPropagation();
          navigate(`/admin/integrations/${provider.slug}`);
        }}
      >
        {provider.status === 'connected' ? 'Configure' :
         provider.is_coming_soon ? 'Coming Soon' :
         provider.authType === 'oauth2' ? 'Connect' : 'Configure'}
      </Button>
    </div>
  </CardContent>
</Card>
```

---

## Provider Detail Page - API Key Auth

**Route**: `/admin/integrations/openai` (example)

### Layout Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ← Integration Hub                                      [User] [Settings]    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌──────────┐                                                                │
│  │  [🧠]    │  OpenAI Integration                                           │
│  └──────────┘                                                                │
│                                                                               │
│  Industry-leading AI models for chat, embeddings, and vision                │
│  [📚 View Documentation →]                                                   │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ Connection Status                                                        ││
│  ├─────────────────────────────────────────────────────────────────────────┤│
│  │                                                                           ││
│  │  ● Connected                                                             ││
│  │  Last tested: 2 minutes ago                                              ││
│  │  API Key: sk-...abc123 (ends with abc123)                                ││
│  │                                                                           ││
│  │  [Test Connection]  [Disconnect]                                         ││
│  │                                                                           ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ Configuration                                                            ││
│  ├─────────────────────────────────────────────────────────────────────────┤│
│  │                                                                           ││
│  │  API Key *                                                                ││
│  │  ┌────────────────────────────────────────────────────────────────────┐ ││
│  │  │ ••••••••••••••••••••••••••••••••••••••••••           [👁 Show]    │ ││
│  │  └────────────────────────────────────────────────────────────────────┘ ││
│  │  Your OpenAI API key. Keep this secret and never share it.               ││
│  │                                                                           ││
│  │  Organization ID (optional)                                               ││
│  │  ┌────────────────────────────────────────────────────────────────────┐ ││
│  │  │ org-abc123xyz                                                       │ ││
│  │  └────────────────────────────────────────────────────────────────────┘ ││
│  │  For organization-scoped API keys                                        ││
│  │                                                                           ││
│  │  Base URL (optional)                                                      ││
│  │  ┌────────────────────────────────────────────────────────────────────┐ ││
│  │  │ https://api.openai.com/v1                                           │ ││
│  │  └────────────────────────────────────────────────────────────────────┘ ││
│  │  Override the default OpenAI API endpoint                                ││
│  │                                                                           ││
│  │                                            [Cancel]  [Save Configuration] ││
│  │                                                                           ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ Available Models                                              [+ Add]    ││
│  ├─────────────────────────────────────────────────────────────────────────┤│
│  │                                                                           ││
│  │  Chat Models                                                             ││
│  │  ┌─────────────────────────────────────────────────────────────────────┐││
│  │  │ Model          │ Context │ Input Cost  │ Output Cost │ Features │ □ │││
│  │  ├────────────────┼─────────┼─────────────┼─────────────┼──────────┼───┤││
│  │  │ GPT-5          │ 200k    │ $0.01500/1k │ $0.06000/1k │ 👁 ⚡ ⭐ │ ☑ │││
│  │  │ ● Default      │         │             │             │          │   │││
│  │  ├────────────────┼─────────┼─────────────┼─────────────┼──────────┼───┤││
│  │  │ GPT-4o         │ 128k    │ $0.00250/1k │ $0.01000/1k │ 👁 🎨    │ ☑ │││
│  │  ├────────────────┼─────────┼─────────────┼─────────────┼──────────┼───┤││
│  │  │ GPT-4o mini    │ 128k    │ $0.00015/1k │ $0.00060/1k │ 👁 ⚡    │ ☑ │││
│  │  └────────────────┴─────────┴─────────────┴─────────────┴──────────┴───┘││
│  │                                                                           ││
│  │  Embedding Models                                                        ││
│  │  ┌─────────────────────────────────────────────────────────────────────┐││
│  │  │ Model                │ Dimensions │ Cost        │ Features   │ □    │││
│  │  ├──────────────────────┼────────────┼─────────────┼────────────┼──────┤││
│  │  │ text-embedding-3-lg  │ 3072       │ $0.00013/1k │ ⚡ Quality │ ☑    │││
│  │  │ ● Default            │            │             │            │      │││
│  │  └──────────────────────┴────────────┴─────────────┴────────────┴──────┘││
│  │                                                                           ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ Usage & Analytics                                    [View Full Report]  ││
│  ├─────────────────────────────────────────────────────────────────────────┤│
│  │                                                                           ││
│  │  This Month                                                               ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐││
│  │  │ 12,543       │  │ 4.2M         │  │ 3.1M         │  │ $42.31       │││
│  │  │ API Calls    │  │ Input Tokens │  │ Output Tokens│  │ Total Cost   │││
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘││
│  │                                                                           ││
│  │  [████████████████████░░░░░░░░░░] 72% of monthly budget ($60)            ││
│  │                                                                           ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Features

1. **Connection Status Panel**
   - Real-time status indicator (● Connected, ○ Disconnected, ⚠ Error)
   - Last tested timestamp
   - Masked API key preview
   - Quick action buttons

2. **Configuration Form**
   - Dynamic fields based on `integration_fields` table
   - Password fields with show/hide toggle
   - Inline help text
   - Validation on blur

3. **Service Management** (like AI Model Management)
   - Tabular display of services
   - Toggle enable/disable
   - Set default per category
   - Feature badges
   - Cost information

4. **Usage Analytics Preview**
   - Quick stats (calls, tokens, cost)
   - Budget progress bar
   - Link to full analytics

---

## Provider Detail Page - OAuth

**Route**: `/admin/integrations/zoom` (example)

### Layout Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ← Integration Hub                                      [User] [Settings]    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌──────────┐                                                                │
│  │  [📹]    │  Zoom Integration                                             │
│  └──────────┘                                                                │
│                                                                               │
│  Video conferencing platform with recordings and transcriptions             │
│  [📚 View Documentation →]                                                   │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ OAuth Connection                                                         ││
│  ├─────────────────────────────────────────────────────────────────────────┤│
│  │                                                                           ││
│  │  Status: Not Connected                                                   ││
│  │                                                                           ││
│  │  Connect your Zoom account to enable meeting synchronization,           ││
│  │  recording downloads, and transcript processing.                         ││
│  │                                                                           ││
│  │  ┌────────────────────────────────────────────────────────────────┐     ││
│  │  │                                                                 │     ││
│  │  │       [📹]   Connect with Zoom                                 │     ││
│  │  │                                                                 │     ││
│  │  │  This will open a new window to authorize access              │     ││
│  │  │                                                                 │     ││
│  │  └────────────────────────────────────────────────────────────────┘     ││
│  │                                                                           ││
│  │  Required Permissions:                                                   ││
│  │  ☑ Read user information                                                 ││
│  │  ☑ View and manage meetings                                              ││
│  │  ☑ Access meeting recordings                                             ││
│  │  ☑ View meeting transcripts                                              ││
│  │                                                                           ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ ℹ How to Set Up                                                          ││
│  ├─────────────────────────────────────────────────────────────────────────┤│
│  │                                                                           ││
│  │  1. Click "Connect with Zoom" above                                      ││
│  │  2. Sign in to your Zoom account                                         ││
│  │  3. Review and approve the requested permissions                         ││
│  │  4. You'll be redirected back to complete the setup                      ││
│  │                                                                           ││
│  │  [Learn more about Zoom OAuth setup →]                                   ││
│  │                                                                           ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘

------- AFTER OAUTH CONNECTION -------

┌─────────────────────────────────────────────────────────────────────────────┐
│ ← Integration Hub                                      [User] [Settings]    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌──────────┐                                                                │
│  │  [📹]    │  Zoom Integration                                             │
│  └──────────┘                                                                │
│                                                                               │
│  Video conferencing platform with recordings and transcriptions             │
│  [📚 View Documentation →]                                                   │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ OAuth Connection                                                         ││
│  ├─────────────────────────────────────────────────────────────────────────┤│
│  │                                                                           ││
│  │  ● Connected                                                             ││
│  │  Account: john@company.com                                                ││
│  │  Connected: Jan 2, 2026 at 10:30 AM                                      ││
│  │  Token expires: Feb 2, 2026 (auto-refresh enabled)                       ││
│  │                                                                           ││
│  │  [Test Connection]  [Reconnect]  [Disconnect]                            ││
│  │                                                                           ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ Services                                                                 ││
│  ├─────────────────────────────────────────────────────────────────────────┤│
│  │                                                                           ││
│  │  ┌────────────────────────────────────────────────────────────────┐     ││
│  │  │ ☑ Meeting Synchronization                    [Enabled ▼]      │     ││
│  │  │   Automatically sync meetings to your calendar                │     ││
│  │  │   └─ Sync frequency: Every 15 minutes                         │     ││
│  │  └────────────────────────────────────────────────────────────────┘     ││
│  │                                                                           ││
│  │  ┌────────────────────────────────────────────────────────────────┐     ││
│  │  │ ☑ Recording Downloads                        [Enabled ▼]      │     ││
│  │  │   Automatically download meeting recordings                   │     ││
│  │  │   └─ Storage: Database (can configure to S3/Drive)            │     ││
│  │  │   └─ Retention: 90 days                                       │     ││
│  │  └────────────────────────────────────────────────────────────────┘     ││
│  │                                                                           ││
│  │  ┌────────────────────────────────────────────────────────────────┐     ││
│  │  │ ☑ Transcript Processing                      [Enabled ▼]      │     ││
│  │  │   Process and analyze meeting transcripts                     │     ││
│  │  │   └─ AI Summarization: Enabled (using Claude Sonnet)          │     ││
│  │  │   └─ Speaker identification: Enabled                          │     ││
│  │  └────────────────────────────────────────────────────────────────┘     ││
│  │                                                                           ││
│  │  ┌────────────────────────────────────────────────────────────────┐     ││
│  │  │ ☐ Webhook Events                              [Configure]     │     ││
│  │  │   Receive real-time notifications for events                  │     ││
│  │  │   └─ No webhooks configured                                   │     ││
│  │  └────────────────────────────────────────────────────────────────┘     ││
│  │                                                                           ││
│  │                                                         [Save Settings]   ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ Recent Activity                                      [View All →]        ││
│  ├─────────────────────────────────────────────────────────────────────────┤│
│  │                                                                           ││
│  │  • Recording downloaded: "Team Standup" (2 min ago)                      ││
│  │  • Meeting synced: "Client Review" (15 min ago)                          ││
│  │  • Transcript processed: "Planning Session" (1 hour ago)                 ││
│  │                                                                           ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### OAuth Flow Sequence

```
User Action                    System Response
────────────────              ────────────────────────────────────
[Connect with Zoom]           1. Generate OAuth state (CSRF token)
                              2. Build authorization URL with scopes
                              3. Open popup/redirect to Zoom

User logs into Zoom           4. Zoom displays permission consent
User approves permissions     5. Zoom redirects to callback URL with code

                              6. Edge function receives callback
                              7. Exchange code for access_token
                              8. Store tokens in organization_integrations
                              9. Close popup/redirect back
                              10. Show success message
                              11. Load connected state
```

---

## Enhanced Provider Pages

### Google Workspace Integration Page

**Route**: `/admin/integrations/google-workspace`

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ← Integration Hub                                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌──────────┐                                                                │
│  │  [G]     │  Google Workspace Integration                                 │
│  └──────────┘                                                                │
│                                                                               │
│  Connect Google Drive, Calendar, and Meet with a single sign-on             │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ Account Connection                                                       ││
│  ├─────────────────────────────────────────────────────────────────────────┤│
│  │                                                                           ││
│  │  ● Connected                                                             ││
│  │  Account: workspace@company.com                                           ││
│  │  Authorized services: Drive, Calendar, Meet                              ││
│  │                                                                           ││
│  │  [Reconnect]  [Disconnect]                                               ││
│  │                                                                           ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐            ││
│  │ │ Google Drive    │ │ Google Calendar │ │ Google Meet     │            ││
│  │ │ ☑ Enabled       │ │ ☑ Enabled       │ │ ☑ Enabled       │            ││
│  │ └─────────────────┘ └─────────────────┘ └─────────────────┘            ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ Google Drive Settings                                         [Edit]    ││
│  ├─────────────────────────────────────────────────────────────────────────┤│
│  │                                                                           ││
│  │  Sync Folder                                                             ││
│  │  ┌────────────────────────────────────────────────────────────────────┐ ││
│  │  │ 📁 My Drive > Control Tower Files              [Browse Folders]    │ ││
│  │  └────────────────────────────────────────────────────────────────────┘ ││
│  │                                                                           ││
│  │  Auto-upload Settings                                                    ││
│  │  ☑ Upload user knowledge files automatically                             ││
│  │  ☑ Upload meeting recordings                                             ││
│  │  ☐ Upload AI chat transcripts                                            ││
│  │                                                                           ││
│  │  File Type Filters                                                       ││
│  │  ☑ Documents (.pdf, .docx, .txt)                                         ││
│  │  ☑ Spreadsheets (.xlsx, .csv)                                            ││
│  │  ☑ Presentations (.pptx)                                                 ││
│  │  ☑ Images (.jpg, .png)                                                   ││
│  │  ☑ Videos (.mp4, .mov)                                                   ││
│  │                                                                           ││
│  │  Storage Quota: 12.3 GB / 30 GB (41% used)                               ││
│  │  [██████████████████░░░░░░░░░░░░░░░░░░]                                  ││
│  │                                                                           ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ Google Calendar Settings                                      [Edit]    ││
│  ├─────────────────────────────────────────────────────────────────────────┤│
│  │                                                                           ││
│  │  Synced Calendars                                                        ││
│  │  ☑ Primary Calendar (workspace@company.com)                              ││
│  │  ☑ Meetings Calendar                                                     ││
│  │  ☐ Personal Calendar                                                     ││
│  │                                                                           ││
│  │  Sync Preferences                                                        ││
│  │  Sync direction: ○ Two-way  ● To Control Tower  ○ From Control Tower    ││
│  │  Sync frequency: Every 15 minutes                                        ││
│  │                                                                           ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ Google Meet Settings                                          [Edit]    ││
│  ├─────────────────────────────────────────────────────────────────────────┤│
│  │                                                                           ││
│  │  Meeting Creation                                                        ││
│  │  ☑ Auto-add Meet link to calendar events                                 ││
│  │  ☑ Use custom meeting names (from event title)                           ││
│  │                                                                           ││
│  │  Recording Preferences                                                   ││
│  │  ☑ Download recordings automatically                                     ││
│  │  Storage location: Google Drive (Control Tower Files/Recordings)         ││
│  │  Retention: 90 days                                                      ││
│  │                                                                           ││
│  │  Webhooks (via Workspace Events API)                                     ││
│  │  ☑ Meeting started                                                       ││
│  │  ☑ Meeting ended                                                         ││
│  │  ☑ Recording available                                                   ││
│  │  ☐ Transcript generated                                                  ││
│  │                                                                           ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                               │
│                                                                [Save All]    │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Integration Analytics Dashboard

**Route**: `/admin/integration-analytics`

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ← Admin Dashboard                                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  Integration Usage Analytics                                                │
│  Track API usage, costs, and performance across all integrations            │
│                                                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ [Today ▼]  [This Week]  [This Month]  [Custom Range]                   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ Overview - This Month                                                    ││
│  ├─────────────────────────────────────────────────────────────────────────┤│
│  │                                                                           ││
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐        ││
│  │  │ 45,892     │  │ $127.43    │  │ 99.2%      │  │ 12         │        ││
│  │  │ API Calls  │  │ Total Cost │  │ Success    │  │ Active     │        ││
│  │  │ +12.3% ↑   │  │ +8.7% ↑    │  │ Rate       │  │ Integrations│       ││
│  │  └────────────┘  └────────────┘  └────────────┘  └────────────┘        ││
│  │                                                                           ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ Usage by Category                                                        ││
│  ├─────────────────────────────────────────────────────────────────────────┤│
│  │                                                                           ││
│  │        │                                                                 ││
│  │  45k   │     ██                                                          ││
│  │        │     ██                                                          ││
│  │  30k   │     ██                                                          ││
│  │        │     ██    ██                                                    ││
│  │  15k   │     ██    ██    ██                                              ││
│  │        │     ██    ██    ██    ██                                        ││
│  │   0    │─────██────██────██────██────██────█─────                        ││
│  │        │     AI   Email  Meet  CRM   PM   Storage                        ││
│  │                                                                           ││
│  │  Legend:  ■ AI: 32,450 calls (70.7%)   ■ Email: 8,231 (17.9%)           ││
│  │           ■ Meetings: 3,122 (6.8%)     ■ CRM: 1,543 (3.4%)              ││
│  │           ■ Project Mgmt: 421 (0.9%)   ■ Storage: 125 (0.3%)            ││
│  │                                                                           ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ Cost Breakdown                                                           ││
│  ├─────────────────────────────────────────────────────────────────────────┤│
│  │                                                                           ││
│  │  Provider          │ API Calls │ Success Rate │ Cost      │ % of Total  ││
│  │  ──────────────────┼───────────┼──────────────┼───────────┼───────────  ││
│  │  🧠 OpenAI         │ 18,234    │ 99.8%        │ $78.23    │ 61.4%       ││
│  │  ✨ Anthropic      │ 14,216    │ 99.1%        │ $32.10    │ 25.2%       ││
│  │  📧 SendGrid       │ 8,231     │ 100%         │ $8.23     │ 6.5%        ││
│  │  📹 Zoom           │ 3,122     │ 98.7%        │ $5.42     │ 4.3%        ││
│  │  👥 HubSpot        │ 1,543     │ 99.4%        │ $2.31     │ 1.8%        ││
│  │  📋 Jira           │ 421       │ 100%         │ $0.84     │ 0.7%        ││
│  │  ☁️ Google Drive   │ 125       │ 100%         │ $0.30     │ 0.2%        ││
│  │  ──────────────────┴───────────┴──────────────┴───────────┴───────────  ││
│  │  Total             │ 45,892    │ 99.2%        │ $127.43   │ 100%        ││
│  │                                                                           ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ Top Users by API Usage                               [View All →]        ││
│  ├─────────────────────────────────────────────────────────────────────────┤│
│  │                                                                           ││
│  │  1. John Doe (john@company.com)           12,543 calls    $42.31         ││
│  │  2. Jane Smith (jane@company.com)          8,921 calls    $28.14         ││
│  │  3. Bob Johnson (bob@company.com)          6,234 calls    $19.82         ││
│  │  4. Alice Williams (alice@company.com)     4,112 calls    $13.25         ││
│  │  5. Charlie Brown (charlie@company.com)    3,892 calls    $11.43         ││
│  │                                                                           ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ Error Analytics                                                          ││
│  ├─────────────────────────────────────────────────────────────────────────┤│
│  │                                                                           ││
│  │  Total Errors: 376 (0.8% error rate)                                     ││
│  │                                                                           ││
│  │  Top Errors:                                                             ││
│  │  • Rate limit exceeded (OpenAI): 142 occurrences                         ││
│  │  • Invalid authentication (Zoom): 87 occurrences                         ││
│  │  • Network timeout (HubSpot): 63 occurrences                             ││
│  │  • Invalid request format (Jira): 41 occurrences                         ││
│  │  • Permission denied (Google Drive): 43 occurrences                      ││
│  │                                                                           ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ Budget Alerts                                                            ││
│  ├─────────────────────────────────────────────────────────────────────────┤│
│  │                                                                           ││
│  │  ⚠️ Warning: OpenAI costs at 78% of monthly budget ($100)                ││
│  │     Current: $78.23  |  Projected: $94.50 by end of month               ││
│  │     [View Details]  [Adjust Budget]                                      ││
│  │                                                                           ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Specifications

### TypeScript Interfaces

```typescript
// Core Types
interface IntegrationCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string; // Lucide icon name
  display_order: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

interface IntegrationProvider {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string;
  logo_url: string | null;
  docs_url: string | null;
  auth_type: 'api_key' | 'oauth2' | 'basic' | 'service_account';
  oauth_config: OAuthConfig | null;
  is_available: boolean;
  is_coming_soon: boolean;
  is_beta: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

interface OAuthConfig {
  authorize_url: string;
  token_url: string;
  scopes: string[];
  response_type?: string;
  grant_type?: string;
}

interface IntegrationField {
  id: string;
  provider_id: string;
  field_key: string;
  label: string;
  field_type: 'text' | 'password' | 'url' | 'email' | 'select' | 'textarea';
  placeholder: string | null;
  default_value: string | null;
  is_required: boolean;
  is_sensitive: boolean;
  help_text: string | null;
  validation_regex: string | null;
  select_options: SelectOption[] | null;
  display_order: number;
  created_at: string;
}

interface SelectOption {
  value: string;
  label: string;
}

interface OrganizationIntegration {
  id: string;
  organization_id: string | null;
  provider_id: string;
  enabled: boolean;
  config: Record<string, any>;
  connection_status: 'connected' | 'disconnected' | 'error' | 'testing';
  connection_message: string | null;
  last_tested_at: string | null;
  last_sync_at: string | null;
  oauth_tokens: OAuthTokens | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  expires_at?: string;
  token_type: string;
  scope?: string;
}

interface IntegrationService {
  id: string;
  provider_id: string;
  name: string;
  service_key: string;
  description: string | null;
  features: Record<string, boolean> | null;
  has_cost: boolean;
  cost_model: CostModel | null;
  enabled: boolean;
  is_default: boolean;
  requires_config: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

interface CostModel {
  type: 'per_api_call' | 'tiered' | 'flat' | 'per_token';
  rate?: number;
  currency?: string;
  tiers?: CostTier[];
}

interface CostTier {
  up_to?: number;
  above?: number;
  rate: number;
}

interface IntegrationUsageLog {
  id: string;
  organization_id: string | null;
  provider_id: string | null;
  service_id: string | null;
  user_id: string | null;
  action: string;
  status: 'success' | 'error' | 'partial';
  request_metadata: Record<string, any> | null;
  response_metadata: Record<string, any> | null;
  error_message: string | null;
  estimated_cost: number;
  created_at: string;
}

// UI Component Props
interface ProviderCardProps {
  provider: IntegrationProvider & {
    category: IntegrationCategory;
    orgIntegration?: OrganizationIntegration;
    serviceCount?: number;
  };
  onClick?: () => void;
}

interface ProviderConfigFormProps {
  provider: IntegrationProvider;
  fields: IntegrationField[];
  currentConfig?: Record<string, any>;
  onSave: (config: Record<string, any>) => Promise<void>;
  onTest: (config: Record<string, any>) => Promise<TestResult>;
}

interface TestResult {
  valid: boolean;
  message: string;
  details?: Record<string, any>;
}

interface OAuthButtonProps {
  provider: IntegrationProvider;
  onSuccess: (tokens: OAuthTokens) => void;
  onError: (error: Error) => void;
  disabled?: boolean;
}

interface ServiceToggleProps {
  service: IntegrationService;
  enabled: boolean;
  onToggle: (enabled: boolean) => Promise<void>;
  disabled?: boolean;
}

interface ConnectionStatusProps {
  status: 'connected' | 'disconnected' | 'error' | 'testing';
  message?: string;
  lastTested?: string;
  onTest?: () => Promise<void>;
  onDisconnect?: () => Promise<void>;
}
```

### Component Structure

```tsx
// ProviderCard.tsx
export function ProviderCard({ provider, onClick }: ProviderCardProps) {
  const statusVariant = {
    connected: 'default',
    disconnected: 'secondary',
    error: 'destructive',
    coming_soon: 'outline',
  }[provider.orgIntegration?.connection_status || 'disconnected'];

  return (
    <Card className="cursor-pointer hover:border-primary/50" onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex flex-col items-center gap-3">
          {/* Icon */}
          <div className="rounded-lg border p-3 bg-muted/50">
            {getProviderIcon(provider.slug)}
          </div>

          {/* Name & Description */}
          <div className="text-center">
            <p className="font-semibold">{provider.name}</p>
            <p className="text-xs text-muted-foreground line-clamp-2">
              {provider.description}
            </p>
          </div>

          {/* Status Badge */}
          <Badge variant={statusVariant}>
            {getStatusIcon(provider.orgIntegration?.connection_status)}
            {getStatusLabel(provider.orgIntegration?.connection_status)}
          </Badge>

          {/* Metadata */}
          {provider.orgIntegration?.connection_status === 'connected' && (
            <p className="text-xs text-muted-foreground">
              {provider.serviceCount} {provider.serviceCount === 1 ? 'service' : 'services'}
            </p>
          )}

          {/* Action Button */}
          <Button
            variant={provider.orgIntegration?.connection_status === 'connected' ? 'outline' : 'default'}
            size="sm"
            className="w-full"
            disabled={provider.is_coming_soon}
          >
            {getActionLabel(provider)}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ProviderConfigForm.tsx
export function ProviderConfigForm({
  provider,
  fields,
  currentConfig,
  onSave,
  onTest
}: ProviderConfigFormProps) {
  const [config, setConfig] = useState(currentConfig || {});
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const handleTest = async () => {
    setTesting(true);
    try {
      const result = await onTest(config);
      setTestResult(result);
      if (result.valid) {
        toast.success('Connection successful!');
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Test failed');
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuration</CardTitle>
        <CardDescription>
          Enter your {provider.name} credentials
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => { e.preventDefault(); onSave(config); }}>
          <div className="space-y-4">
            {fields
              .sort((a, b) => a.display_order - b.display_order)
              .map(field => (
                <FormField key={field.id} field={field} value={config[field.field_key]} onChange={(val) => setConfig({ ...config, [field.field_key]: val })} />
              ))}

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={handleTest} disabled={testing}>
                {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                Test Connection
              </Button>
              <Button type="submit">
                Save Configuration
              </Button>
            </div>

            {testResult && (
              <Alert variant={testResult.valid ? 'default' : 'destructive'}>
                <AlertDescription>{testResult.message}</AlertDescription>
              </Alert>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// OAuthButton.tsx
export function OAuthButton({ provider, onSuccess, onError, disabled }: OAuthButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleOAuthFlow = async () => {
    setLoading(true);
    try {
      // Generate state for CSRF protection
      const state = generateRandomState();

      // Build authorization URL
      const authUrl = buildAuthorizationUrl(provider, state);

      // Open popup or redirect
      const popup = window.open(authUrl, 'oauth', 'width=600,height=700');

      // Listen for callback
      const handleMessage = (event: MessageEvent) => {
        if (event.data.type === 'oauth_success') {
          onSuccess(event.data.tokens);
          popup?.close();
        } else if (event.data.type === 'oauth_error') {
          onError(new Error(event.data.error));
          popup?.close();
        }
      };

      window.addEventListener('message', handleMessage);

      // Cleanup
      return () => window.removeEventListener('message', handleMessage);
    } catch (error) {
      onError(error as Error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleOAuthFlow} disabled={disabled || loading} size="lg" className="w-full">
      {loading ? (
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      ) : (
        getProviderIcon(provider.slug, 'mr-2 h-5 w-5')
      )}
      Connect with {provider.name}
    </Button>
  );
}
```

---

## Next Steps

This wireframe document provides:
1. **Pixel-perfect layouts** for all major pages
2. **Component hierarchies** with clear structure
3. **TypeScript interfaces** for type safety
4. **Interaction patterns** (hover states, clicks, flows)
5. **OAuth sequence** diagrams
6. **Real data examples** in the wireframes

Would you like me to:
1. Create provider-specific integration guides (detailed setup for Zoom, Teams, etc.)?
2. Create data flow diagrams for API interactions?
3. Build visual diagrams/flowcharts for the architecture?
4. Start implementing the first phase (database schema)?
