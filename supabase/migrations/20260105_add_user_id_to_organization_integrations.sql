-- ============================================
-- Add user_id to organization_integrations table
-- Allows per-user integration configurations
-- ============================================

-- Add user_id column
ALTER TABLE public.organization_integrations
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for user_id lookups
CREATE INDEX IF NOT EXISTS idx_organization_integrations_user_id
ON public.organization_integrations(user_id);

-- Drop the old unique constraint and add a new one that includes user_id
ALTER TABLE public.organization_integrations
DROP CONSTRAINT IF EXISTS organization_integrations_organization_id_provider_id_key;

-- Add new unique constraint: one integration per provider per user
ALTER TABLE public.organization_integrations
ADD CONSTRAINT organization_integrations_user_provider_key
UNIQUE(user_id, provider_id);

-- ============================================
-- Update RLS Policies
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view all organization integrations" ON public.organization_integrations;
DROP POLICY IF EXISTS "Admins can manage organization integrations" ON public.organization_integrations;

-- Users can view their own integrations
CREATE POLICY "Users can view own integrations"
  ON public.organization_integrations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own integrations
CREATE POLICY "Users can create own integrations"
  ON public.organization_integrations FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own integrations
CREATE POLICY "Users can update own integrations"
  ON public.organization_integrations FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own integrations
CREATE POLICY "Users can delete own integrations"
  ON public.organization_integrations FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can view all integrations
CREATE POLICY "Admins can view all integrations"
  ON public.organization_integrations FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can manage all integrations
CREATE POLICY "Admins can manage all integrations"
  ON public.organization_integrations FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- Update existing rows to set user_id from created_by
-- ============================================
UPDATE public.organization_integrations
SET user_id = created_by
WHERE user_id IS NULL AND created_by IS NOT NULL;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'user_id column added and RLS policies updated for organization_integrations!';
END $$;
