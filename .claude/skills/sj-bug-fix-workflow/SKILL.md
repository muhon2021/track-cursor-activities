---
name: sj-bug-fix-workflow
description: "8-step bug fix process. Follow for EVERY bug, error, crash. Triggers: bug, error, fix, broken, not working, crash, blank screen, failing, issue, problem."
---

# SJ Innovation Bug Fix Workflow

Follow this 8-step process for EVERY bug fix. Do not skip steps.

## Step 1: Reproduce

- Identify the exact steps to trigger the bug
- Note the expected behavior vs. actual behavior
- Capture the error message, stack trace, or visual symptom
- Check which user role experiences it (admin, user, unauthenticated)
- Check the browser console for errors
- Check the network tab for failed requests

## Step 2: Isolate

Determine which layer the bug originates from:

| Layer | Symptoms | Where to Look |
|-------|----------|--------------|
| **Frontend (React)** | Blank screen, wrong data displayed, UI crash, "Cannot read properties of null" | `src/pages/`, `src/components/`, `src/hooks/` |
| **State (React Query)** | Stale data, missing data, infinite loading | `src/hooks/`, `src/lib/cache.ts`, React Query DevTools |
| **Auth** | 401 errors, redirect to login, "JWT expired" | `src/contexts/AuthContext.tsx`, `src/components/auth/` |
| **Backend (Edge Functions)** | 500 errors, CORS errors, timeout | `supabase/functions/`, `supabase/config.toml` |
| **Database (Supabase)** | Empty results, "permission denied", "RLS violation" | RLS policies in `supabase/migrations/` |
| **Config** | Features not visible, wrong behavior | `src/shared/config/env.ts`, `src/shared/config/modules.ts`, `.env` |

## Step 3: Read the Error

### Common Supabase/PostgreSQL Error Codes
| Code | Meaning | Common Cause |
|------|---------|-------------|
| `PGRST301` | JWT required | Missing or expired auth token |
| `PGRST204` | No rows returned | RLS policy blocking access |
| `42501` | Insufficient privilege | RLS policy or missing permissions |
| `23505` | Unique violation | Duplicate key (id, email, etc.) |
| `23503` | Foreign key violation | Referenced row doesn't exist |
| `42P01` | Undefined table | Table doesn't exist or wrong schema |

### Common React Error Patterns
| Error | Cause |
|-------|-------|
| `Cannot read properties of undefined/null` | Data not loaded yet, missing null check |
| `Too many re-renders` | State update in render body, unstable deps |
| `Invalid hook call` | Hook called conditionally or outside component |
| `Objects are not valid as a React child` | Rendering raw object instead of property |

### Network Error Patterns
| Error | Cause |
|-------|-------|
| CORS error | Edge Function missing OPTIONS handler or wrong CORS config |
| 405 Method Not Allowed | Edge Function doesn't handle this HTTP method |
| 500 Internal Server Error | Unhandled exception in Edge Function |

## Step 4: Root Cause Analysis

**Check these common causes in order (most frequent first for this project):**

1. **RLS policy missing or misconfigured** — most common issue
   - Check if the table has RLS enabled
   - Check if policies exist for the operation (SELECT/INSERT/UPDATE/DELETE)
   - Check if the policy correctly references `auth.uid()`
   - Check if admin override policy exists when needed

2. **Hook dependency array stale** — causes stale closures
   - Check `useEffect` dependency arrays
   - Check `useMemo`/`useCallback` dependency arrays
   - Look for variables used inside the hook but missing from deps

3. **Stale Supabase types** — schema changed but types not regenerated
   - Column added/removed in migration but `types.ts` is outdated
   - Symptoms: `as any` casts, `never` type errors, type mismatch on insert/update
   - Fix: Regenerate types with `supabase gen types typescript --project-id <id> > src/integrations/supabase/types.ts`
   - Prevention: ALWAYS regenerate types after any migration

4. **Type mismatch** — data shape doesn't match expectation
   - Supabase returns `null` but code expects array
   - Hook returns different shape than component expects
   - Form data shape doesn't match mutation input type

5. **Null/undefined check missing** — optional chaining needed
   - `data.field` when `data` could be `null`
   - Array method called on `undefined`
   - Object property access on potentially null query result

6. **Race condition** — async timing issues
   - Data not loaded before component renders
   - Multiple mutations competing
   - Auth session not ready when query fires

7. **Edge Function timeout** — function takes too long
   - External API calls (OpenAI, Google, Zoom) timing out
   - Large database queries without limits
   - Missing pagination on large result sets

8. **CORS misconfiguration** — origin not in allowlist
   - Check `supabase/cors.ts` for origin patterns
   - Check if Edge Function handles OPTIONS preflight

9. **OAuth token expiry** — external provider tokens go stale
   - Azure AD, Google, Zoom tokens have short lifetimes (often 5 minutes)
   - Token acquired at login may expire by the time it's used for an API call
   - Always acquire a fresh token immediately before the API call that needs it
   - Check `src/lib/azureAuth.ts`, integration hooks for token refresh patterns

10. **Missing config.toml entry** — Edge Function returns 401 in production
    - Every Edge Function directory MUST have a `[functions.name]` entry in `supabase/config.toml`
    - Functions work locally without this but fail in production
    - This is the #1 source of Edge Function bugs in this project

## Step 5: Write a Failing Test (if test infra exists)

- Before fixing, write a test that reproduces the bug
- This becomes the regression test
- If no test infrastructure exists, document the manual reproduction steps

## Step 6: Apply the Fix

- **Minimal fix only** — change as little code as possible
- Do NOT refactor surrounding code while fixing a bug
- Do NOT add features while fixing a bug
- Do NOT "improve" code that isn't broken
- Follow the project's existing patterns (see sj-code-standards skill)

### Fix Verification
```bash
# After applying fix, verify the build succeeds
npm run build

# Run lint
npm run lint
```

## Step 7: Verify the Fix

1. **Original reproduction steps** — confirm the bug no longer occurs
2. **Side effects check** — test related functionality still works
3. **Other roles** — test with different user roles (admin, user)
4. **Edge cases** — empty data, large data, rapid clicks
5. **Run the test** (if written in Step 5) — confirm it passes

## Step 8: Document

Record the fix in the commit message:
```
[FIX] Brief description of what was fixed

Root cause: [1-sentence explanation]
Fix: [1-sentence description of the change]
Files changed: [list of modified files]
```

## Key Files for Debugging in This Project

| Area | Files to Check |
|------|---------------|
| Auth | `src/contexts/AuthContext.tsx`, `src/components/auth/ProtectedRoute.tsx` |
| Data fetching | `src/hooks/use*.ts`, `src/lib/cache.ts` |
| Supabase client | `src/integrations/supabase/client.ts` |
| Edge Functions | `supabase/functions/*/index.ts` |
| RLS policies | `supabase/migrations/*.sql` |
| Auth middleware | `supabase/auth-middleware.ts` |
| CORS | `supabase/cors.ts` |
| Config | `src/shared/config/env.ts`, `src/shared/config/modules.ts` |
| Routing | `src/App.tsx`, `src/modules/*/routes.tsx` |
