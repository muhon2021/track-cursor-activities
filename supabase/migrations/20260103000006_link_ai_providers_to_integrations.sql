-- Migration: Link AI Providers to Integration Providers
-- Date: 2026-01-03
-- Purpose: Add integration_provider_id to ai_providers table to unify AI and Integration systems

-- Add integration_provider_id column to ai_providers table
ALTER TABLE public.ai_providers
ADD COLUMN integration_provider_id UUID REFERENCES public.integration_providers(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX idx_ai_providers_integration_provider_id
ON public.ai_providers(integration_provider_id);

-- Update existing AI providers to link to their integration counterparts
-- OpenAI
UPDATE public.ai_providers
SET integration_provider_id = (
  SELECT id FROM public.integration_providers WHERE slug = 'openai' LIMIT 1
)
WHERE slug = 'openai';

-- Anthropic
UPDATE public.ai_providers
SET integration_provider_id = (
  SELECT id FROM public.integration_providers WHERE slug = 'anthropic' LIMIT 1
)
WHERE slug = 'anthropic';

-- Google AI (maps to google-gemini in integrations)
UPDATE public.ai_providers
SET integration_provider_id = (
  SELECT id FROM public.integration_providers WHERE slug = 'google-gemini' LIMIT 1
)
WHERE slug = 'google';

-- Perplexity
UPDATE public.ai_providers
SET integration_provider_id = (
  SELECT id FROM public.integration_providers WHERE slug = 'perplexity' LIMIT 1
)
WHERE slug = 'perplexity';

-- Add comment to explain the relationship
COMMENT ON COLUMN public.ai_providers.integration_provider_id IS
'Links AI provider to its corresponding integration provider for unified management';

-- Create a view that combines ai_providers with their integration status
CREATE OR REPLACE VIEW public.ai_providers_with_integration_status AS
SELECT
  ap.id,
  ap.name,
  ap.slug,
  ap.enabled AS provider_enabled,
  ap.api_key_secret_name,
  ap.description,
  ap.integration_provider_id,
  ip.name AS integration_provider_name,
  oi.id AS org_integration_id,
  oi.connection_status,
  oi.enabled AS integration_enabled,
  oi.config AS integration_config,
  CASE
    WHEN oi.connection_status = 'connected' THEN true
    ELSE false
  END AS is_connected
FROM public.ai_providers ap
LEFT JOIN public.integration_providers ip ON ap.integration_provider_id = ip.id
LEFT JOIN public.organization_integrations oi ON ip.id = oi.provider_id
ORDER BY ap.name;

-- Grant select permission on the view
GRANT SELECT ON public.ai_providers_with_integration_status TO authenticated;

-- Add RLS policy for the view (inherits from base tables)
COMMENT ON VIEW public.ai_providers_with_integration_status IS
'Combines AI providers with their integration connection status for unified display';
