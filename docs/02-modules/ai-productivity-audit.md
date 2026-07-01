# AI Productivity Audit (Cursor Self Analyser)

Team and personal AI-assisted audits of Cursor usage — session metadata and prompts only (no assistant message bodies in the UI).

## Routes

| Audience | Path |
|----------|------|
| Admins (team dashboard) | `/admin/ai/productivity-audit` |
| Admin per-user audit | `/admin/ai/productivity-audit/:userId` |
| Developers (personal) | `/profile/cursor-insights` |

## Setup (developers)

1. Log in to Control Tower → **Profile → Open Cursor Insights** → **Cursor setup** tab.
2. Create an ingest token (one active token per user).
3. Install globally under `~/.cursor` (or `%USERPROFILE%\.cursor` on Windows):
   - `hooks/csa-track.mjs` — download from `{app-origin}/csa/csa-track.mjs`
   - `hooks.json` — hook definitions (from setup panel)
   - `dct-csa.json` — `{ supabase_url, ingest_token, debug? }`
4. Use Cursor normally; hooks send prompt metadata to `csa-ingest`.
5. Regenerate your audit from the **My audit** tab (or ask an admin to regenerate team reports).

**Important:** Install hooks globally **or** per-project — not both (avoids double-counting prompts).

## Admin workflow

1. Open **Admin → Intelligence & AI → AI Productivity Audit**.
2. Pick a date range (default 7 days, max 30).
3. Click **Regenerate all audits** after new hook data arrives.
4. Open per-user audits from the team table.

## Backend

| Edge function | Purpose |
|---------------|---------|
| `csa-ingest` | Hook ingest (token auth via `x-csa-ingest-token`) |
| `csa-reports` | List, detail, team summary, token CRUD |
| `csa-generate-insights` | Build AI/heuristic audit reports |

**Database tables:** `csa_ingest_tokens`, `csa_sessions`, `csa_messages`, `csa_insights_reports`

**AI:** Reports prefer `gpt-4o` via configured `ai_models` / provider keys. Falls back to heuristics when AI is unavailable.

## Deploy

```bash
supabase functions deploy csa-ingest
supabase functions deploy csa-reports
supabase functions deploy csa-generate-insights
```

Apply migration `20260701120000_csa_self_analyser.sql` before first use.

## Manual QA checklist

- [ ] Admin creates ingest token on setup tab
- [ ] Install hook + `dct-csa.json` locally; send a few Cursor prompts
- [ ] Admin regenerates reports; verify prompt counts (not assistant doubles)
- [ ] Personal page shows own audit + date filter
- [ ] AI vs heuristic badge on audit view when OpenAI/model missing
