ALTER TABLE public.user_invites DROP CONSTRAINT IF EXISTS user_invites_status_check;
ALTER TABLE public.user_invites ADD CONSTRAINT user_invites_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'expired'::text, 'cancelled'::text, 'revoked'::text]));