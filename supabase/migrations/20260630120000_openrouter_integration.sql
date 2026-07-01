-- OpenRouter AI provider integration (Integration Hub catalog + credential fields).
-- Runtime: organization_integrations.config stores encrypted api_key via integration-config Edge Function.
-- AI routing is not wired yet; ai_providers row links the integration for future phases.

-- Environments may have ai_providers without the link column from 20260103_link_ai_providers_to_integrations.
ALTER TABLE public.ai_providers
  ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE public.ai_providers
  ADD COLUMN IF NOT EXISTS integration_provider_id UUID
  REFERENCES public.integration_providers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ai_providers_integration_provider_id
  ON public.ai_providers(integration_provider_id);

DO $$
DECLARE
  ai_category_id UUID;
  openrouter_provider_id UUID;
  dup_category_id UUID;
BEGIN
  -- Use the SAME category tab as OpenAI / Anthropic / Gemini / Perplexity (do not create a second AI tab).
  SELECT ip.category_id INTO ai_category_id
  FROM public.integration_providers ip
  WHERE ip.slug IN ('openai', 'anthropic', 'google-gemini', 'perplexity')
  ORDER BY CASE ip.slug
    WHEN 'openai' THEN 1
    WHEN 'anthropic' THEN 2
    WHEN 'google-gemini' THEN 3
    ELSE 4
  END
  LIMIT 1;

  IF ai_category_id IS NULL THEN
    INSERT INTO public.integration_categories (name, slug, description, icon, display_order, enabled)
    VALUES (
      'AI Providers',
      'ai-providers',
      'AI models for chat, embeddings, and analysis',
      'Brain',
      10,
      true
    )
    ON CONFLICT (slug) DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      icon = EXCLUDED.icon,
      display_order = EXCLUDED.display_order,
      enabled = true,
      updated_at = now();

    SELECT id INTO ai_category_id
    FROM public.integration_categories
    WHERE slug = 'ai-providers'
    LIMIT 1;
  END IF;

  IF ai_category_id IS NULL THEN
    RAISE EXCEPTION 'Could not resolve AI Providers integration category';
  END IF;

  INSERT INTO public.integration_providers (
    category_id,
    name,
    slug,
    description,
    auth_type,
    docs_url,
    is_available,
    is_coming_soon,
    display_order
  )
  VALUES (
    ai_category_id,
    'OpenRouter',
    'openrouter',
    'Access 300+ AI models through a single API.',
    'api_key',
    'https://openrouter.ai/docs',
    true,
    false,
    50
  )
  ON CONFLICT (slug) DO UPDATE SET
    category_id = EXCLUDED.category_id,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    auth_type = EXCLUDED.auth_type,
    docs_url = EXCLUDED.docs_url,
    is_available = EXCLUDED.is_available,
    is_coming_soon = EXCLUDED.is_coming_soon,
    display_order = EXCLUDED.display_order,
    updated_at = now();

  SELECT id INTO openrouter_provider_id
  FROM public.integration_providers
  WHERE slug = 'openrouter'
  LIMIT 1;

  INSERT INTO public.integration_fields (
    provider_id,
    field_key,
    label,
    field_type,
    placeholder,
    default_value,
    is_required,
    is_sensitive,
    help_text,
    display_order
  )
  VALUES
    (
      openrouter_provider_id,
      'api_key',
      'API Key',
      'password',
      'sk-or-...',
      NULL,
      true,
      true,
      'Your OpenRouter API key from openrouter.ai/keys',
      10
    ),
    (
      openrouter_provider_id,
      'default_model',
      'Default Model (optional)',
      'text',
      'deepseek/deepseek-r1',
      'deepseek/deepseek-r1',
      false,
      false,
      'Optional default model slug for future OpenRouter-powered features.',
      20
    )
  ON CONFLICT (provider_id, field_key) DO UPDATE SET
    label = EXCLUDED.label,
    field_type = EXCLUDED.field_type,
    placeholder = EXCLUDED.placeholder,
    default_value = EXCLUDED.default_value,
    is_required = EXCLUDED.is_required,
    is_sensitive = EXCLUDED.is_sensitive,
    help_text = EXCLUDED.help_text,
    display_order = EXCLUDED.display_order;

  INSERT INTO public.ai_providers (
    name,
    slug,
    description,
    api_key_secret_name,
    base_url,
    enabled,
    integration_provider_id
  )
  VALUES (
    'OpenRouter',
    'openrouter',
    'Unified API gateway for 300+ AI models',
    'OPENROUTER_API_KEY',
    'https://openrouter.ai/api/v1',
    true,
    openrouter_provider_id
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    api_key_secret_name = EXCLUDED.api_key_secret_name,
    base_url = EXCLUDED.base_url,
    enabled = EXCLUDED.enabled,
    integration_provider_id = EXCLUDED.integration_provider_id;

  -- Remove duplicate empty "AI Providers" tabs created when openrouter was assigned to a new category.
  FOR dup_category_id IN
    SELECT ic.id
    FROM public.integration_categories ic
    WHERE ic.id <> ai_category_id
      AND (
        lower(trim(ic.name)) IN ('ai providers', 'ai provider')
        OR ic.slug IN ('ai-providers', 'ai-provider')
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.integration_providers ip
        WHERE ip.category_id = ic.id
          AND ip.slug <> 'openrouter'
      )
  LOOP
    DELETE FROM public.integration_categories WHERE id = dup_category_id;
  END LOOP;
END $$;
