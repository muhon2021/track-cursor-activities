# Database Migrations

This directory contains SQL migrations for the CollabAi platform.

## How to Apply Migrations

### Option 1: Supabase Dashboard (Recommended)

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **SQL Editor** in the left sidebar
4. Copy the contents of each migration file and paste into the SQL Editor
5. Click "Run" to execute the migration

### Option 2: Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Apply all migrations
supabase db push
```

## Migration Files

### 20241231_app_config.sql
**Purpose:** Creates the `app_config` table for multi-tenant platform configuration

**What it does:**
- Creates `app_config` table with key-value storage (JSONB)
- Enables RLS (Row Level Security)
- Creates policies for admin access
- Inserts default configuration values

**Required:** ✅ Yes - Required for System Settings page to work

---

### 20241231_user_invites.sql
**Purpose:** Creates the `user_invites` table for user invitation system

**What it does:**
- Creates `user_invites` table with email, role, token fields
- Enables RLS (Row Level Security)
- Creates policies for admin access
- Adds indexes for performance

**Required:** ✅ Yes - Required for user invite functionality

---

### 20241231_user_status.sql
**Purpose:** Adds user activation/deactivation functionality

**What it does:**
- Adds `is_active` column to `profiles` table
- Adds `deactivated_at` and `deactivated_by` columns
- Creates index for active users
- Sets all existing users to active

**Required:** ✅ Yes - Required for user deactivation feature

---

## Migration Order

Apply migrations in this order:

1. `20241231_app_config.sql`
2. `20241231_user_invites.sql`
3. `20241231_user_status.sql`

## Verification

After applying migrations, verify in **Supabase Dashboard → Table Editor**:

- ✅ `app_config` table exists with default rows
- ✅ `user_invites` table exists
- ✅ `profiles` table has `is_active`, `deactivated_at`, `deactivated_by` columns

## Rollback

If you need to rollback these migrations:

```sql
-- Rollback app_config
DROP TABLE IF EXISTS public.app_config CASCADE;

-- Rollback user_invites
DROP TABLE IF EXISTS public.user_invites CASCADE;

-- Rollback user status columns
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS is_active,
  DROP COLUMN IF EXISTS deactivated_at,
  DROP COLUMN IF EXISTS deactivated_by;
```

## Notes

- All tables have RLS enabled for security
- Only admins can manage configuration and invites
- The `app_config` table uses JSONB for flexible value storage
- All timestamps use `timestamptz` (timezone-aware)

---

**Last Updated:** 2024-12-31
**Platform:** [Supabase](https://supabase.com)
