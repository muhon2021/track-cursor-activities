-- Org-wide AI model policy for agent chat (default model, user choice vs locked, visibility)

ALTER TABLE public.integration_settings
  ADD COLUMN IF NOT EXISTS ai_model_policy JSONB NOT NULL DEFAULT '{
    "selection_mode": "user_choice",
    "default_chat_model_id": null,
    "default_provider_slug": null,
    "user_visible_models": "all_enabled"
  }'::jsonb;

COMMENT ON COLUMN public.integration_settings.ai_model_policy IS
  'Org-wide agent chat model policy: selection_mode (admin_locked|user_choice), default_chat_model_id, user_visible_models (all_enabled|default_only)';

-- Ensure at most one default chat model globally
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (ORDER BY updated_at DESC NULLS LAST, name ASC) AS rn
  FROM public.ai_models
  WHERE category = 'chat' AND is_default = true
)
UPDATE public.ai_models
SET is_default = false
WHERE category = 'chat'
  AND is_default = true
  AND id NOT IN (SELECT id FROM ranked WHERE rn = 1);

-- Agent chat UI needs read access to org policy for all authenticated users
CREATE POLICY "Authenticated users can read integration_settings for agent chat"
  ON public.integration_settings FOR SELECT
  TO authenticated
  USING (true);
