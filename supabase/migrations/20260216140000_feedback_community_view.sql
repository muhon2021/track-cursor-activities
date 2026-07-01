-- Migration: Allow all authenticated users to view all feedback (community view)
-- Also adds module, priority, and assigned_to columns for admin controls

-- Step 1: Drop existing SELECT policies
DROP POLICY IF EXISTS "Users can view their own feedback" ON public.feedback;
DROP POLICY IF EXISTS "Admins can view all feedback" ON public.feedback;

-- Step 2: Create new unified SELECT policy for all authenticated users
CREATE POLICY "All authenticated users can view feedback"
  ON public.feedback FOR SELECT
  TO authenticated
  USING (true);

-- Step 3: Add new columns for admin controls and detail page
ALTER TABLE public.feedback
  ADD COLUMN IF NOT EXISTS module text,
  ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id);

-- Step 4: Index new columns
CREATE INDEX IF NOT EXISTS idx_feedback_module ON public.feedback(module);
CREATE INDEX IF NOT EXISTS idx_feedback_priority ON public.feedback(priority);
CREATE INDEX IF NOT EXISTS idx_feedback_assigned_to ON public.feedback(assigned_to);
