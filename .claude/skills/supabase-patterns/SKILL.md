---
name: supabase-patterns
description: "Supabase database and backend patterns for this project. Triggers: database, table, migration, RLS, policy, Edge Function, query, supabase, schema."
---

# Supabase Patterns — SJ Control Tower Framework

## Database Conventions

### Table Structure
Every table must include:
```sql
CREATE TABLE IF NOT EXISTS public.table_name (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- user_id if user-scoped
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  -- business columns
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active',
  metadata JSONB DEFAULT '{}',
  -- timestamps (always)
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
```

### Naming
- Tables: `snake_case` — `knowledge_entries`, `user_roles`, `project_milestones`
- Columns: `snake_case` — `created_at`, `user_id`, `full_name`
- Foreign keys: `referenced_table_id` — `client_id`, `project_id`, `meeting_id`
- Indexes: `idx_table_column` — `idx_clients_user_id`
- RLS policies: Descriptive English — `"Users can view own records"`

### Foreign Key Constraints

Every column ending in `_id` that references another table MUST have an explicit FK constraint:

```sql
-- WRONG — no constraint, allows orphaned records
client_id UUID,

-- CORRECT — explicit FK with appropriate cascade
client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
meeting_id UUID REFERENCES public.meetings(id) ON DELETE CASCADE,
```

FK columns MUST also have indexes for join performance:
```sql
CREATE INDEX idx_deals_client_id ON public.deals(client_id);
CREATE INDEX idx_tasks_project_id ON public.tasks(project_id);
```

### Soft Deletes (when applicable)
```sql
is_deleted BOOLEAN DEFAULT false,
deleted_at TIMESTAMPTZ
```

## RLS Policy Template

Every table MUST have RLS enabled and policies for all operations:

```sql
-- Enable RLS
ALTER TABLE public.table_name ENABLE ROW LEVEL SECURITY;

-- User policies (scoped by user_id)
CREATE POLICY "Users can view own records"
  ON public.table_name FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own records"
  ON public.table_name FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own records"
  ON public.table_name FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own records"
  ON public.table_name FOR DELETE
  USING (auth.uid() = user_id);

-- Admin override policy
CREATE POLICY "Admins can manage all records"
  ON public.table_name FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'admin'
    )
  );
```

## Migration Naming

Format: `YYYYMMDDHHMMSS_description.sql`
```
20260201000000_create_table_name.sql
20260201000001_add_column_to_table.sql
20260201000002_create_rls_policies_for_table.sql
```

Apply migrations: `npm run migrations:run`
Repair history: `npm run migrations:repair`

## Edge Function Template

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // CORS preflight — MUST be first
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle request based on method
    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("table_name")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return new Response(
        JSON.stringify({ data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (req.method === "POST") {
      const body = await req.json();
      // Validate input
      if (!body.name) {
        return new Response(
          JSON.stringify({ error: "name is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const { data, error } = await supabase
        .from("table_name")
        .insert([{ ...body, user_id: user.id }])
        .select()
        .single();
      if (error) throw error;
      return new Response(
        JSON.stringify({ data }),
        { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[function-name] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

### JWT Config (supabase/config.toml)
```toml
# Auto-validated by Supabase gateway
[functions.function-name]
verify_jwt = true

# Validated in-code (for custom logic or ES256)
[functions.function-name]
verify_jwt = false
```

## React Query Hook Pattern (Frontend)

```typescript
// src/hooks/useTableName.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys, invalidateKeys, cacheConfig } from "@/lib/cache";
import { toast } from "sonner";
import { logCrud } from "@/lib/activity-logger";

export function useTableNames(filters?: { status?: string }) {
  return useQuery({
    queryKey: queryKeys.tableNames.list(filters),
    queryFn: async () => {
      let query = supabase
        .from("table_names")
        .select("id, name, status, created_at")
        .order("created_at", { ascending: false });

      if (filters?.status) {
        query = query.eq("status", filters.status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    staleTime: cacheConfig.staleTime.medium,
  });
}

export function useCreateTableName() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: TableNameInsert) => {
      const { data, error } = await supabase
        .from("table_names")
        .insert([input])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      invalidateKeys.tableNames(queryClient);
      logCrud("create", "table_name", data.id);
      toast.success("Created successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create");
    },
  });
}
```

## Supabase Query Patterns

### Always check error before data
```typescript
const { data, error } = await supabase.from("table").select("*");
if (error) throw error;
// Now safe to use data
```

### Joins (nested select)
```typescript
// Supabase uses nested select syntax, not SQL JOIN
const { data } = await supabase
  .from("projects")
  .select(`
    id, name, status,
    project_milestones (id, title, due_date),
    profiles:created_by (full_name, avatar_url)
  `)
  .eq("status", "active");
```

### Pagination
```typescript
const { data, count } = await supabase
  .from("activity_logs")
  .select("*", { count: "exact" })
  .range(page * pageSize, (page + 1) * pageSize - 1)
  .order("created_at", { ascending: false });
```

### Upsert
```typescript
const { data, error } = await supabase
  .from("preferences")
  .upsert({ user_id: userId, key: "theme", value: "dark" }, { onConflict: "user_id,key" })
  .select()
  .single();
```

## Core Tables in This Project

| Table | Purpose | Key Columns |
|-------|---------|------------|
| `profiles` | User profiles | id, email, full_name, avatar_url, role |
| `user_roles` | Role assignments | user_id, role_id |
| `roles` | Role definitions | id, name (admin/moderator/user) |
| `clients` | CRM contacts | id, name, email, company, status, created_by |
| `meetings` | Meeting records | id, title, date, type, status, project_id |
| `meeting_transcripts` | Transcript text | id, meeting_id, content, summary |
| `knowledge_entries` | KB articles | id, title, content, category_id, user_id |
| `embeddings` | Vector data | id, content, embedding, source_type, source_id |
| `ai_agents` | Agent configs | id, name, system_prompt, model, tools |
| `ai_chat_history` | Chat messages | id, user_id, agent_id, role, content |
| `tasks` | Task items | id, title, status, assignee_id, project_id |
| `projects` | Project records | id, name, status, client_id, start_date |
| `project_milestones` | Milestones | id, project_id, title, due_date, status |
| `app_config` | Feature flags | id, key, value, is_active |
| `app_modules` | Module toggles | id, module_id, is_enabled |
| `activity_logs` | Audit trail | id, user_id, action, resource_type, resource_id |
| `notifications` | User notifications | id, user_id, title, message, read |
| `deals` | Sales pipeline | id, title, value, stage, client_id |
| `contacts` | Contact people | id, name, email, client_id |
| `zoom_files` | Zoom recordings | id, meeting_id, file_url, file_type |
| `mcp_servers` | MCP server configs | id, name, url, api_key |

## Supabase Storage Patterns

### Store Paths, Not URLs

```typescript
// WRONG — stores full URL (breaks if bucket access changes from public to private)
const publicUrl = supabase.storage.from('bucket').getPublicUrl(path).data.publicUrl;
await supabase.from('table').update({ file_url: publicUrl });

// CORRECT — store the relative path, generate URL at render time
await supabase.from('table').update({ file_path: path });

// At render time, generate signed URL for private buckets
const { data } = await supabase.storage.from('bucket').createSignedUrl(filePath, 3600);
```

Rules:
- ALWAYS store relative file **paths** in the database, never full URLs
- Use `createSignedUrl()` for private buckets (most buckets in this project)
- Use `getPublicUrl()` only for explicitly public buckets
- Signed URLs should have appropriate expiry (3600s for display, 60s for download)

## Edge Functions in This Project (118 total)

Organized by category:

**AI**: ai-chat, ai-chat-assistant, agent-chat-stream, agent-conversation-chat, run-ai-agent, orchestrate-agent-team, deal-coach, eos-triage-assistant, suggest-okrs, analyze-okr-progress
**Knowledge**: auto-embed-knowledge-entry, auto-embed-knowledge-files, semantic-search, unified-knowledge-search, knowledge-base, generate-embeddings, gemini-rag-query, embedding-retention-cleanup, process-embedding-queue
**Meetings**: generate-meeting-summary, generate-meeting-summary-v2, compile-meeting-summary, meeting-summary-and-extract, categorize-meeting, smart-categorize-meetings, extract-meeting-tasks, extract-meeting-issues, parse-meeting-action-items, meeting-efficiency-analyzer, meeting-issue-reporter, send-meeting-efficiency-report, ai-match-meeting-client, match-meeting-to-project, discover-meeting-relationships, get-meeting-participants, sync-meeting-participants, create-meeting-review-tasks, generate-recurring-meetings, apply-meeting-rules, process-pending-meetings, send-meeting-notification
**Integrations**: oauth-authorize, oauth-exchange-token, oauth-refresh-token, oauth-revoke-token, oauth-token, oauth-userinfo, user-oauth-connect, user-oauth-callback, user-oauth-disconnect, user-oauth-refresh, google-drive-sync, google-drive-upload, user-drive-list, user-drive-download, microsoft-graph-subscribe, sync-google-meet, sync-zoom-files, zoom-cron-sync, zoom-transcript-processing, check-zoom-sync-health, classify-zoom-meetings, create-zoom-meeting, manage-zoom-account, sync-projects-activecollab, sync-projects-jira, sync-workboard-action-items, sync-action-item-to-ac
**Auth**: azure-auth-login, azure-auth-logout, api-auth, promote-first-admin, promote-to-admin, validate-sso-domain, validate-api-key
**Email**: send-email, send-email-with-tracking, email-tracking, process-scheduled-emails
**Notifications**: send-notification, send-feedback-notification
**API**: api-v1-clients, api-v1-documents, api-v1-meetings, api-v1-tasks, api-v1-zoom-files, client-dashboard-api, client-documents
**Agents**: extract-agent-memories, retrieve-agent-memories, consolidate-agent-memories, execute-mcp-tool, verify-mcp-server, enforce-guardrails, validate-guardrails, request-approval, respond-to-approval
**System**: seed-template-data, run-seed, check-environment, audit-log-writer, log-activity, sync-ai-models, import-productivity-csv, team-productivity-list, team-productivity-metrics, okr-update-reminder, quarterly-digest
**Lead Follow-up**: lead-followup-research, generate-conversation-opener, auto-update-follow-up-statuses
**User Knowledge**: user-knowledge-upload, user-knowledge-process, user-knowledge-drive-sync
