# Dashboard Migration Guide — Agency-First Rebuild

## Overview

Migration file: `supabase/migrations/20260224_dashboard_tables.sql`

Adds database support for role-specific dashboards (Owner, PM, Individual Contributor).

---

## New Tables

### `user_role_preferences`
Stores each user's agency role and dashboard preferences.

| Column | Type | Notes |
|---|---|---|
| `user_id` | uuid | FK → auth.users |
| `role` | app_role | DB auth role (admin/moderator/user) |
| `agency_role` | text | Dashboard role: `owner` / `pm` / `ic` |
| `is_eos_user` | boolean | Enables EOS-enhanced Owner dashboard |
| `dashboard_layout` | jsonb | Reserved for future card ordering |
| `primary_pod_id` | uuid | FK → pods (PM context) |
| `ai_digest_enabled` | boolean | Opt-in to AI weekly digest |
| `ai_digest_frequency` | text | `weekly` or `daily` |

**RLS:** Users manage their own row; admins can read all.

### `dashboard_widgets`
Registry of available dashboard cards. Seeded with 4 initial widgets.

| `widget_slug` | `agency_roles` | Notes |
|---|---|---|
| `health_metrics` | owner | HealthMetricsCard |
| `watch_list` | owner | WatchListCard |
| `team_capacity` | pm | TeamCapacityCard |
| `ai_digest` | owner, pm, ic | AIWeeklyDigestCard |

### `project_at_risk_flags`
Event log tracking why a project is flagged as at risk.

| `flag_type` values | Meaning |
|---|---|
| `deadline_approaching` | End date < 7 days away |
| `blocked` | Manually marked blocked |
| `over_budget` | Spend > budget |
| `no_activity` | No task/meeting updates in 14+ days |
| `feedback_pending` | Client feedback overdue |

**RLS:** Project owners and creators can read their flags; admins/moderators manage all.

### `ai_digest_logs`
Stores AI-generated digests delivered to users.

---

## Modified Tables

### `projects`
```sql
is_at_risk             boolean  DEFAULT false
risk_flags             text[]   DEFAULT '{}'
owner_notified_at      timestamptz
expected_completion_date date
```

### `meetings`
```sql
ai_summary_status          text  DEFAULT 'pending'   -- pending|completed|failed
ai_summary_generated_at    timestamptz
action_items_extracted_at  timestamptz
```
> Note: `meetings.ai_summary` (the text content) already existed.

---

## New Views

### `owner_dashboard_metrics`
Single-row aggregate for the Owner dashboard health card.
- Revenue from `deals.value` (closed last 7 days)
- Team utilization from `productivity_records` (current week)
- Project counts from `projects` + `project_statuses`
- Client count from `clients.status = 'active'`
- Team member count from `profiles.is_active`

### `project_risk_summary`
Per-project risk view for the Watch List card.
> **Schema note:** `tasks` and `meetings` lack a direct `project_id` FK in the current schema.
> Open task and meeting counts are approximated via the shared `client_id` bridge.
> These columns can be made precise when/if `project_id` is added to those tables.

### `pm_team_capacity`
Per-pod capacity rollup for the Team Capacity card.
Joins `productivity_records.employee_email → profiles.email → pod_members.user_id → pod_members.pod_id`.
> Requires `productivity_records` rows to have been imported for the current week.

---

## How to Apply

```bash
# Apply all pending migrations
npm run migrations:run

# Or via Supabase CLI
supabase db push
```

---

## Verification Queries

Run these in Supabase SQL Editor after applying the migration:

```sql
-- 1. Widgets seeded correctly
SELECT widget_slug, display_name, agency_roles FROM dashboard_widgets;
-- Expect 4 rows

-- 2. Owner metrics view works
SELECT * FROM owner_dashboard_metrics;
-- Expect 1 row with numeric values

-- 3. Project risk view works
SELECT id, name, is_at_risk, risk_flags FROM project_risk_summary LIMIT 5;

-- 4. Team capacity view works (requires productivity_records data)
SELECT * FROM pm_team_capacity LIMIT 5;

-- 5. New project columns exist
SELECT is_at_risk, risk_flags, expected_completion_date FROM projects LIMIT 1;

-- 6. New meetings columns exist
SELECT ai_summary_status, ai_summary_generated_at FROM meetings LIMIT 1;
```

---

## Setting Agency Roles (Manual — for testing)

Until the admin UI is built, set agency roles directly via SQL:

```sql
-- Make user an agency owner
INSERT INTO user_role_preferences (user_id, role, agency_role, is_eos_user)
VALUES ('your-user-uuid', 'admin', 'owner', false)
ON CONFLICT (user_id, role) DO UPDATE
  SET agency_role = 'owner', is_eos_user = false;

-- Enable EOS for an owner
UPDATE user_role_preferences
SET is_eos_user = true
WHERE user_id = 'your-user-uuid';

-- Make user a PM
INSERT INTO user_role_preferences (user_id, role, agency_role)
VALUES ('your-user-uuid', 'user', 'pm')
ON CONFLICT (user_id, role) DO UPDATE SET agency_role = 'pm';
```
