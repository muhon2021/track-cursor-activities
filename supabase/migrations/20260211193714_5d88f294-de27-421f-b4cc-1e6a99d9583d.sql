-- Deals Module Fixes Migration (from 20260211_deals_module_fixes.sql)

-- FK Constraints
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'deals_client_id_fkey') THEN
    ALTER TABLE deals ADD CONSTRAINT deals_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
  END IF;
END $$;

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

-- Contacts: add missing columns
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS followup_status TEXT DEFAULT 'new';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_lead_follow_up BOOLEAN DEFAULT false;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_contact_date TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS next_followup_date TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_contacts_followup_status ON contacts(followup_status) WHERE is_lead_follow_up = true;

-- Tighten RLS policies
DROP POLICY IF EXISTS "Authenticated users can manage deals" ON deals;
CREATE POLICY "Deal owners and creators can manage deals" ON deals
  FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR created_by = auth.uid())
  WITH CHECK (owner_id = auth.uid() OR created_by = auth.uid());

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