-- Add user status fields to profiles table
-- Allows admins to deactivate users

-- Add is_active column
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Add deactivated_at column
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS deactivated_at timestamptz;

-- Add deactivated_by column (who deactivated the user)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS deactivated_by uuid REFERENCES public.profiles(id);

-- Add index for active users
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles(is_active);

-- Update existing users to be active
UPDATE public.profiles SET is_active = true WHERE is_active IS NULL;
