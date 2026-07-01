-- Fix function search_path for security
CREATE OR REPLACE FUNCTION update_user_microsoft_teams_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;