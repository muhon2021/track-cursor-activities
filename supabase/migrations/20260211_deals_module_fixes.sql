-- ============================================================================
-- Deals Module Fixes Migration
-- ============================================================================
-- 1. Add missing FK constraint: deals.client_id → clients(id)
-- 2. Add FK constraints to profiles for PostgREST relationship joins
-- 3. Add missing columns to contacts for follow-up automation
-- 4. Tighten RLS policies on deal tables (owner-based write access)
-- ============================================================================

-- ========================
-- FK Constraints
-- ========================

-- deals.client_id → clients(id) (was missing)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'deals_client_id_fkey') THEN
    ALTER TABLE deals ADD CONSTRAINT deals_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
  END IF;
END $$;

-- FK to profiles for PostgREST relationship embedding (owner/creator joins)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'deals_owner_id_profiles_fkey') THEN
    ALTER TABLE deals ADD CONSTRAINT deals_owner_id_profiles_fkey FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'deals_created_by_profiles_fkey') THEN
    ALTER TABLE deals ADD CONSTRAINT deals_created_by_profiles_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'deal_activities_user_id_profiles_fkey') THEN
    ALTER TABLE deal_activities ADD CONSTRAINT deal_activities_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'deal_comments_user_id_profiles_fkey') THEN
    ALTER TABLE deal_comments ADD CONSTRAINT deal_comments_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ========================
-- Contacts: add missing columns for follow-up automation
-- ========================
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS followup_status TEXT DEFAULT 'new';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_lead_follow_up BOOLEAN DEFAULT false;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_contact_date TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS next_followup_date TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_contacts_followup_status ON contacts(followup_status) WHERE is_lead_follow_up = true;

-- ========================
-- Tighten RLS policies
-- ========================
-- Keep SELECT policies (all authenticated users can view) but restrict
-- INSERT/UPDATE/DELETE to deal owners, creators, or the acting user.

-- Deals: drop the overly-permissive "manage" policy, add owner/creator restriction
DROP POLICY IF EXISTS "Authenticated users can manage deals" ON deals;
CREATE POLICY "Deal owners and creators can manage deals" ON deals
  FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR created_by = auth.uid())
  WITH CHECK (owner_id = auth.uid() OR created_by = auth.uid());

-- Deal activities: restrict to activity author or deal owner/creator
DROP POLICY IF EXISTS "Authenticated users can manage activities" ON deal_activities;
CREATE POLICY "Deal activity authors and deal owners can manage activities" ON deal_activities
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM deals WHERE deals.id = deal_activities.deal_id AND (deals.owner_id = auth.uid() OR deals.created_by = auth.uid()))
  )
  WITH CHECK (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM deals WHERE deals.id = deal_activities.deal_id AND (deals.owner_id = auth.uid() OR deals.created_by = auth.uid()))
  );

-- Deal comments: restrict to comment author or deal owner/creator
DROP POLICY IF EXISTS "Authenticated users can manage deal comments" ON deal_comments;
CREATE POLICY "Deal comment authors and deal owners can manage comments" ON deal_comments
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM deals WHERE deals.id = deal_comments.deal_id AND (deals.owner_id = auth.uid() OR deals.created_by = auth.uid()))
  )
  WITH CHECK (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM deals WHERE deals.id = deal_comments.deal_id AND (deals.owner_id = auth.uid() OR deals.created_by = auth.uid()))
  );
