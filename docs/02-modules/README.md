# Application Modules

CollabAi includes several configurable modules. Enable or disable them via [Feature Flags](../07-admin/feature-flags.md).

---

## Module Overview

| Module | Description | Default | Feature Flag |
|--------|-------------|---------|--------------|
| Dashboard | Analytics and overview | Always on | - |
| [Clients](./clients.md) | Client/company management | On | - |
| [Meetings](./meetings.md) | Meeting management + Zoom sync | On | `enableZoomSync` |
| [Tasks](./tasks.md) | Task tracking | On | - |
| [Knowledge Base](./knowledge-base.md) | Shared knowledge library | On | `enableKnowledgeBase` |
| [Personal Knowledge](./personal-knowledge.md) | User's private documents | On | `enablePersonalKnowledge` |
| [AI Chat](./ai-chat.md) | AI assistant interface | On | `enableAIChat` |
| [AI Agents](./ai-agents.md) | Custom AI agents | On | `enableAIAgents` |
| [Notifications](./notifications.md) | In-app + email alerts | On | `enableEmailNotifications` |

---

## Module Dependencies

```
┌─────────────┐
│  Dashboard  │ ◄── Displays data from all modules
└─────────────┘
       ▲
       │
┌──────┴──────┬─────────────┬─────────────┐
│   Clients   │  Meetings   │    Tasks    │
└─────────────┴──────┬──────┴─────────────┘
                     │
                     ▼
              ┌─────────────┐
              │ Knowledge   │ ◄── AI Chat queries this
              │    Base     │
              └─────────────┘
                     ▲
                     │
              ┌──────┴──────┐
              │   AI Chat   │
              │  AI Agents  │
              └─────────────┘
```

---

## Files in This Section

| File | Description |
|------|-------------|
| [dashboard.md](./dashboard.md) | Dashboard widgets and analytics |
| [clients.md](./clients.md) | Client management features |
| [meetings.md](./meetings.md) | Meetings and Zoom integration |
| [tasks.md](./tasks.md) | Task management |
| [knowledge-base.md](./knowledge-base.md) | Knowledge base articles |
| [personal-knowledge.md](./personal-knowledge.md) | User documents |
| [ai-chat.md](./ai-chat.md) | AI chat interface |
| [ai-agents.md](./ai-agents.md) | Custom AI agents |
| [notifications.md](./notifications.md) | Notification system |

---

## Enabling/Disabling Modules

### Via Admin UI (Recommended)
1. Go to **Admin → System Settings → Features**
2. Toggle modules on/off
3. Changes take effect immediately

### Via Database
```sql
UPDATE app_config 
SET value = 'false'::jsonb 
WHERE key = 'enableAIChat';
```

---

## Module Architecture

Each module follows a consistent pattern:

```
src/
├── pages/
│   └── ModuleName.tsx      # Main page component
├── components/
│   └── module-name/        # Module-specific components
├── hooks/
│   └── useModuleName.ts    # Data fetching hooks
└── lib/
    └── module-utils.ts     # Utility functions
```

---

## Adding New Modules

See [Development Guide](../03-development/) for:
- Creating new pages
- Adding feature flags
- Database migrations
- Edge functions
