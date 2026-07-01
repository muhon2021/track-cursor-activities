
-- Update the agency_role CHECK constraint to include 'bd'
ALTER TABLE public.user_role_preferences
  DROP CONSTRAINT IF EXISTS user_role_preferences_agency_role_check;

ALTER TABLE public.user_role_preferences
  ADD CONSTRAINT user_role_preferences_agency_role_check
  CHECK (agency_role IN ('owner', 'pm', 'ic', 'bd'));
