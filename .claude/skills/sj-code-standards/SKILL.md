---
name: sj-code-standards
description: "SJ Innovation coding standards for React, TypeScript, Supabase. Apply to ALL code changes, reviews, and generation. Triggers: code, component, function, refactor, create, build, write."
---

# SJ Innovation Coding Standards

Apply these standards to ALL code written, reviewed, or generated in this project.

## TypeScript Standards

- **No `any` types** — use `unknown` + type guards, proper interfaces, or Supabase generated types
- **Explicit return types** on exported functions and hooks
- **Use Supabase generated types** from `src/integrations/supabase/types.ts`:
  ```typescript
  import { Database } from "@/integrations/supabase/types";
  type Client = Database["public"]["Tables"]["clients"]["Row"];
  type ClientInsert = Database["public"]["Tables"]["clients"]["Insert"];
  ```
- **Zod schemas** for all form validation, derive types with `z.infer<typeof schema>`
- **Interfaces** use PascalCase: `Client`, `Meeting`, `AuthContextType`
- **Type suffixes** for context types: `AuthContextType`, `BrandingContextType`

## React Standards

- **Functional components only** — no class components
- **Custom hooks for ALL data fetching** — never call Supabase directly in components
  - Hooks live in `src/hooks/` with `use*` prefix
  - Hooks use `queryKeys` from `src/lib/cache.ts`
  - Hooks use `invalidateKeys` for cache busting after mutations
- **React Query (TanStack v5)** for all server state
  - Set appropriate `staleTime` from `cacheConfig` presets
  - Use `enabled` flag for conditional queries
- **React Hook Form + Zod** for all forms
  - Schemas in `src/lib/validation.ts`
  - Always use `zodResolver(schema)`
- **Components under 200 lines** — decompose into sub-components if larger
- **Three required states** for async UI: loading, error, empty
  - Loading: `<Loader2 className="h-8 w-8 animate-spin text-primary" />`
  - Error: Toast via Sonner
  - Empty: Descriptive message, not blank screen
- **useMemo/useCallback** for expensive computations and callback props
- **No console.log** in production code — remove before commit

## Data Fetching Pattern

```typescript
// In src/hooks/useExample.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys, invalidateKeys } from "@/lib/cache";
import { toast } from "sonner";
import { logCrud } from "@/lib/activity-logger";

export function useExamples() {
  return useQuery({
    queryKey: queryKeys.examples.list(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("examples")
        .select("id, name, status, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateExample() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ExampleInsert) => {
      const { data, error } = await supabase
        .from("examples")
        .insert([input])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      invalidateKeys.examples(queryClient);
      logCrud("create", "example", data.id);
      toast.success("Example created successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create example");
    },
  });
}
```

## Naming Conventions

| Context | Convention | Example |
|---------|-----------|---------|
| React components | PascalCase file + export | `ClientForm.tsx` |
| Custom hooks | `use*` camelCase | `useClients.ts` |
| Utility files | camelCase | `validation.ts` |
| Types/Interfaces | PascalCase | `Client`, `ModuleDefinition` |
| Constants | UPPER_SNAKE_CASE | `MODULE_REGISTRY` |
| Database tables | snake_case | `knowledge_entries` |
| Database columns | snake_case | `created_at`, `user_id` |
| Edge Functions | kebab-case dirs | `ai-chat-assistant/` |
| Env vars (client) | `VITE_` prefix | `VITE_SUPABASE_URL` |

## Import Ordering

```typescript
// 1. React
import { useState, useMemo } from "react";

// 2. Third-party libraries
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";

// 3. Components (UI primitives first, then feature components)
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ClientCard } from "@/components/clients/ClientCard";

// 4. Hooks
import { useAuth } from "@/contexts/AuthContext";
import { useClients } from "@/hooks/useClients";

// 5. Types
import type { Client } from "@/hooks/useClients";

// 6. Utilities
import { cn } from "@/lib/utils";
import { queryKeys } from "@/lib/cache";
```

## Path Aliases

Always use `@/` alias — never relative paths like `../../../`:
```typescript
// CORRECT
import { supabase } from "@/integrations/supabase/client";
import { useClients } from "@/hooks/useClients";

// WRONG
import { supabase } from "../../../integrations/supabase/client";
```

## Error Handling

```typescript
// All async operations in try-catch
const onSubmit = async (data: FormData) => {
  try {
    await mutation.mutateAsync(data);
    toast.success("Saved successfully");
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "An error occurred");
  }
};
```

## Select Component Pattern

shadcn/ui `<Select>` crashes with empty string values. ALWAYS use a non-empty sentinel:

```typescript
// WRONG — crashes shadcn/ui Select
<SelectItem value="">None</SelectItem>

// CORRECT — use "none" sentinel
<SelectItem value="none">None</SelectItem>

// In form handler, map "none" back to null/undefined:
const onSubmit = (data: FormData) => {
  const payload = {
    ...data,
    category: data.category === "none" ? null : data.category,
  };
};
```

## Security

- All user-generated HTML sanitized via `sanitizeHtml()` from `src/lib/sanitize.ts`
- No `dangerouslySetInnerHTML` without DOMPurify
- All database tables have RLS enabled
- No secrets in client code — only `VITE_` prefixed env vars
- Zod validation on all form inputs
- `sanitizeSearchInput()` for search queries
- `sanitizeFilename()` for file uploads

## Git Commit Format

```
[TYPE] Brief description of change

Types: FEAT, FIX, REFACTOR, DOCS, STYLE, TEST, CHORE, PERF, SECURITY
```
