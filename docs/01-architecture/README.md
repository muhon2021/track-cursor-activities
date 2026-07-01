# Architecture

Understanding the CollabAi system architecture.

---

## Overview

CollabAi follows a modern JAMstack architecture:

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (React)                     │
│  React 18 + TypeScript + Tailwind CSS + shadcn/ui       │
└─────────────────────────┬───────────────────────────────┘
                          │
                          │ HTTPS
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   Supabase Platform                      │
├─────────────────┬───────────────┬───────────────────────┤
│   PostgreSQL    │  Edge Functions │    Auth + Storage   │
│   (Database)    │  (Deno Runtime) │    (Built-in)       │
└─────────────────┴───────────────┴───────────────────────┘
                          │
                          │ API Calls
                          ▼
┌─────────────────────────────────────────────────────────┐
│                 External Services                        │
│  OpenAI │ Zoom │ Google │ Microsoft │ SendGrid          │
└─────────────────────────────────────────────────────────┘
```

---

## Files in This Section

| File | Description |
|------|-------------|
| [system-overview.md](./system-overview.md) | High-level architecture |
| [data-flow.md](./data-flow.md) | How data moves through the system |
| [security.md](./security.md) | Security model and RLS policies |
| [database-schema.md](./database-schema.md) | Database tables and relationships |
| [authentication.md](./authentication.md) | Auth flows and SSO |

---

## Core Components

### Frontend
- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **shadcn/ui** component library
- **TanStack Query** for data fetching
- **React Router** for navigation

### Backend (Supabase)
- **PostgreSQL** database with Row Level Security
- **Edge Functions** (Deno) for serverless logic
- **Auth** with email, OAuth, and SSO support
- **Storage** for file uploads
- **Realtime** subscriptions (optional)

### AI Layer
- Embedding generation for semantic search
- LLM integration for chat and summaries
- Configurable provider routing

---

## Key Design Decisions

### 1. Row Level Security (RLS)
All database tables use RLS policies to ensure users only access their own data:

```sql
-- Example: Users can only see their own clients
CREATE POLICY "Users can view their clients"
ON clients FOR SELECT
USING (created_by = auth.uid());
```

### 2. Edge Functions for Sensitive Operations
API keys and sensitive logic live in edge functions, never in the browser:

```
Browser → Edge Function → External API
         (secrets here)
```

### 3. Feature Flags
Modules are toggleable via the `app_config` table:

```typescript
const { features } = useFeatureFlags();
if (features.enableAIChat) {
  // Show AI chat
}
```

### 4. Multi-Tenant Ready
The schema supports multiple organizations with proper isolation.

---

## Related Sections

- [Modules](../02-modules/) - Feature documentation
- [Edge Functions](../08-edge-functions/) - Serverless functions
- [Development](../03-development/) - Code patterns
