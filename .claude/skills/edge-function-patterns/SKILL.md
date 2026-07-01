---
name: edge-function-patterns
description: "Supabase Edge Function best practices and error prevention. Load when creating, editing, debugging, or reviewing ANY Edge Function. Triggers: edge function, Deno.serve, supabase.functions.invoke, non-2xx, CORS, 500 error, 503 error, 504 error, function deployment, _shared, cors headers."
---

# Supabase Edge Function Patterns — SJ Control Tower Framework

## Project-Specific Setup

- **CORS file**: `supabase/cors.ts` — NOT in `_shared/`, one level above `functions/`
- **Import path**: `import { corsHeaders } from '../cors.ts'` or `import { getCorsHeaders } from '../cors.ts'`
- **Auth middleware**: `supabase/auth-middleware.ts` — `validateAuth(req, supabase)`, `authErrorResponse(error, corsHeaders)`
- **Shared AI routing**: `supabase/functions/_shared/ai-provider-routing.ts`
- **Shared meeting providers**: `supabase/functions/_shared/meeting-providers.ts`
- **118 Edge Functions** deployed, 112 with `verify_jwt = false`
- **Deno runtime**: `Deno.serve()`, `Deno.env.get()`

## The Non-Negotiable Rules

These rules prevent 95% of Edge Function non-2xx errors. Violate any one and the function WILL break in production.

### Rule 1: OPTIONS First, Always

```typescript
Deno.serve(async (req) => {
  // THIS MUST BE THE FIRST LINE INSIDE Deno.serve
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  // everything else goes after
})
```

WHY: Browser sends OPTIONS preflight before POST/PUT/DELETE. If you parse body or check auth before this, the function crashes on preflight → CORS error → "non-2xx status code."

### Rule 2: CORS on EVERY Response (Including Errors)

```typescript
// WRONG — CORS headers only on success
try {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
} catch (error) {
  return new Response(JSON.stringify({ error: error.message }), {
    status: 500  // NO CORS HEADERS → browser blocks the error response too!
  })
}

// CORRECT — CORS headers on ALL responses
try {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
} catch (error) {
  return new Response(JSON.stringify({ error: error.message }), {
    status: 500,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}
```

WHY: When an error response lacks CORS headers, the browser blocks even the error message. The frontend only sees "non-2xx status code" with no details.

### Rule 3: Never Parse Body Before OPTIONS Check

```typescript
// WRONG — crashes on OPTIONS request (no body)
Deno.serve(async (req) => {
  const { name } = await req.json()  // OPTIONS has no body → CRASH
  if (req.method === 'OPTIONS') { ... }
})

// CORRECT — check method first
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  const { name } = await req.json()  // safe — only POST/PUT/DELETE reach here
})
```

### Rule 4: Wrap Body Parsing in Its Own Try-Catch

```typescript
let body
try {
  body = await req.json()
} catch {
  return new Response(
    JSON.stringify({ error: 'Invalid JSON' }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
```

WHY: Malformed JSON from the client crashes the entire function if not caught separately.

### Rule 5: Always Check .error Before .data

```typescript
const { data, error } = await supabase.from('table').select('*')

// WRONG
return new Response(JSON.stringify(data))  // data might be null if error exists

// CORRECT
if (error) {
  console.error('DB error:', error)
  return new Response(
    JSON.stringify({ error: error.message }),
    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
return new Response(
  JSON.stringify(data),
  { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
)
```

### Rule 6: Global Try-Catch Wraps Everything

The outermost try-catch is your safety net. Even if you handle specific errors above, this catches anything you missed and returns a proper Response instead of an unhandled exception (which Supabase turns into a 500).

### Rule 7: Import CORS from the Right Place

```typescript
// This project's CORS file is at supabase/cors.ts (NOT in _shared/)
import { corsHeaders } from '../cors.ts'

// For origin-validated CORS (preferred for security):
import { getCorsHeaders } from '../cors.ts'
const origin = req.headers.get('origin')
const corsHeaders = getCorsHeaders(origin)

// For preflight handling:
import { handleCorsPreflight } from '../cors.ts'
if (req.method === 'OPTIONS') {
  return handleCorsPreflight(req.headers.get('origin'))
}
```

### Rule 8: Check Environment Variables

```typescript
const supabaseUrl = Deno.env.get('SUPABASE_URL')
if (!supabaseUrl) {
  console.error('SUPABASE_URL not configured')
  return new Response(
    JSON.stringify({ error: 'Server misconfigured' }),
    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
```

## Common Error → Root Cause Map

| Error You See | Actual Cause | Fix |
|---|---|---|
| "Edge Function returned a non-2xx status code" | Missing CORS on error response | Add corsHeaders to ALL `Response()` calls |
| CORS error on POST but not GET | Missing OPTIONS handler | Add OPTIONS check as first line |
| 500 Internal Server Error | Uncaught exception | Wrap in try-catch, check Supabase dashboard logs |
| 503 Service Unavailable | Function failed to boot | Bad imports, syntax error, check locally with `supabase functions serve` |
| 504 Gateway Timeout | Function too slow | Optimize queries, add timeouts to external calls |
| 546 Resource Limit | Memory or CPU exceeded | Reduce data in memory, optimize computation |
| 401 Unauthorized | Missing/invalid JWT | Check Authorization header, verify token not expired |
| "supabaseKey is required" | Env var name wrong | Use `SUPABASE_SERVICE_ROLE_KEY` not custom name |
| Function works locally but not deployed | Env vars not set in production | Set secrets via Dashboard or `supabase secrets set` |
| Function works then stops | Stale routing/caching | Redeploy, or rename function if persistent |

## Client-Side Invocation Pattern

```typescript
import { FunctionsHttpError, FunctionsRelayError, FunctionsFetchError } from '@supabase/supabase-js'

const { data, error } = await supabase.functions.invoke('function-name', {
  body: { key: 'value' },
})

if (error) {
  if (error instanceof FunctionsHttpError) {
    const errorData = await error.context.json()
    toast.error(errorData.error || 'Something went wrong')
  } else if (error instanceof FunctionsRelayError) {
    toast.error('Network error. Try again.')
  } else if (error instanceof FunctionsFetchError) {
    toast.error('Cannot reach server.')
  }
  return
}
```

## Edge Function File Structure (This Project)

```
supabase/
├── config.toml                    ← function-level settings (verify_jwt, import_map)
├── cors.ts                        ← shared CORS headers (getCorsHeaders, corsHeaders, handleCorsPreflight)
├── auth-middleware.ts              ← shared auth validation (validateAuth, authErrorResponse)
└── functions/
    ├── _shared/
    │   ├── ai-provider-routing.ts ← multi-provider AI abstraction (OpenAI, Anthropic, Google, Perplexity)
    │   └── meeting-providers.ts   ← meeting provider detection (Zoom, Google Meet, Teams)
    ├── ai-chat-assistant/
    │   └── index.ts
    ├── api-v1-clients/
    │   └── index.ts
    └── ... (118 functions total)
```

## Gold Standard Template (Project-Specific)

```typescript
// supabase/functions/function-name/index.ts

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../cors.ts'

Deno.serve(async (req) => {
  // 1. CORS PREFLIGHT — ALWAYS FIRST
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 2. AUTH CHECK (skip if not needed)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. SUPABASE CLIENT
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 4. PARSE BODY (with its own try-catch)
    let body
    try {
      body = await req.json()
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 5. BUSINESS LOGIC
    const { data, error } = await supabase
      .from('table_name')
      .select('*')
      .limit(100)

    if (error) {
      console.error('Database error:', error)
      return new Response(
        JSON.stringify({ error: 'Database operation failed', details: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 6. SUCCESS
    return new Response(
      JSON.stringify({ success: true, data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    // 7. GLOBAL ERROR HANDLER
    console.error('Unhandled error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
```

### Rule 9: Register in config.toml BEFORE Writing Code

Every Edge Function MUST have a `[functions.function-name]` entry in `supabase/config.toml`. Add this entry **FIRST** — before creating the function directory or writing any code.

```toml
# Add to supabase/config.toml BEFORE creating the function
[functions.my-new-function]
verify_jwt = false
```

Functions without config.toml entries will return **401 in production** even if they work locally. This is the **#1 source of production bugs** in this project (4 bugs in the last 10 days).

## Deployment Checklist

Before deploying any Edge Function:

1. Test locally: `supabase functions serve`
2. Verify CORS by calling from browser (not just curl/Postman — they skip CORS)
3. Check all env vars are set in Dashboard → Project Settings → Edge Functions
4. Verify `config.toml` has correct `verify_jwt` setting
5. Deploy: `supabase functions deploy function-name`
6. Test deployed function from browser
7. Check logs in Dashboard → Edge Functions → Logs
