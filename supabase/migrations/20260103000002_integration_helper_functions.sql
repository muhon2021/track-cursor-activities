-- ============================================
-- Integration Hub Helper Functions
-- Utility functions for managing integrations
-- ============================================

-- ============================================
-- FUNCTION: get_integration_config
-- Retrieve integration configuration by provider slug
-- Returns decrypted config (note: actual encryption to be implemented)
-- ============================================
CREATE OR REPLACE FUNCTION public.get_integration_config(
  provider_slug_input TEXT,
  organization_id_input UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  integration_config JSONB;
  provider_record RECORD;
BEGIN
  -- Get provider details
  SELECT * INTO provider_record
  FROM public.integration_providers
  WHERE slug = provider_slug_input;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Provider not found: %', provider_slug_input;
  END IF;

  -- Get integration config
  SELECT config INTO integration_config
  FROM public.organization_integrations
  WHERE provider_id = provider_record.id
    AND (organization_id IS NULL OR organization_id = organization_id_input)
    AND enabled = true
  LIMIT 1;

  IF integration_config IS NULL THEN
    RAISE EXCEPTION 'Integration not configured for provider: %', provider_slug_input;
  END IF;

  -- TODO: Decrypt sensitive fields (api_key, client_secret, etc.)
  -- For now, return as-is
  RETURN integration_config;
END;
$$;

COMMENT ON FUNCTION public.get_integration_config IS 'Retrieve integration configuration by provider slug. Returns config JSONB.';

-- ============================================
-- FUNCTION: set_integration_config
-- Store integration configuration
-- ============================================
CREATE OR REPLACE FUNCTION public.set_integration_config(
  provider_slug_input TEXT,
  config_input JSONB,
  organization_id_input UUID DEFAULT NULL,
  enabled_input BOOLEAN DEFAULT true
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  provider_record RECORD;
  integration_id UUID;
BEGIN
  -- Verify user is admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can configure integrations';
  END IF;

  -- Get provider
  SELECT * INTO provider_record
  FROM public.integration_providers
  WHERE slug = provider_slug_input;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Provider not found: %', provider_slug_input;
  END IF;

  -- TODO: Encrypt sensitive fields before storing

  -- Upsert integration config
  INSERT INTO public.organization_integrations (
    organization_id,
    provider_id,
    config,
    enabled,
    connection_status,
    created_by
  ) VALUES (
    organization_id_input,
    provider_record.id,
    config_input,
    enabled_input,
    'disconnected',
    auth.uid()
  )
  ON CONFLICT (organization_id, provider_id) DO UPDATE
    SET config = EXCLUDED.config,
        enabled = EXCLUDED.enabled,
        updated_at = now()
  RETURNING id INTO integration_id;

  RETURN integration_id;
END;
$$;

COMMENT ON FUNCTION public.set_integration_config IS 'Store or update integration configuration. Returns integration ID.';

-- ============================================
-- FUNCTION: test_integration_connection
-- Update connection status after testing
-- ============================================
CREATE OR REPLACE FUNCTION public.test_integration_connection(
  provider_slug_input TEXT,
  is_valid BOOLEAN,
  message_input TEXT DEFAULT NULL,
  organization_id_input UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  provider_record RECORD;
  new_status TEXT;
BEGIN
  -- Verify user is admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can test connections';
  END IF;

  -- Get provider
  SELECT * INTO provider_record
  FROM public.integration_providers
  WHERE slug = provider_slug_input;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Provider not found: %', provider_slug_input;
  END IF;

  -- Determine new status
  IF is_valid THEN
    new_status := 'connected';
  ELSE
    new_status := 'error';
  END IF;

  -- Update integration status
  UPDATE public.organization_integrations
  SET
    connection_status = new_status,
    connection_message = message_input,
    last_tested_at = now()
  WHERE provider_id = provider_record.id
    AND (organization_id IS NULL OR organization_id = organization_id_input);

  RETURN is_valid;
END;
$$;

COMMENT ON FUNCTION public.test_integration_connection IS 'Update connection status after testing. Pass TRUE if valid, FALSE if error.';

-- ============================================
-- FUNCTION: get_enabled_integrations
-- Get all enabled integrations for an organization
-- ============================================
CREATE OR REPLACE FUNCTION public.get_enabled_integrations(
  category_slug_input TEXT DEFAULT NULL,
  organization_id_input UUID DEFAULT NULL
)
RETURNS TABLE (
  integration_id UUID,
  provider_slug TEXT,
  provider_name TEXT,
  category_slug TEXT,
  auth_type TEXT,
  connection_status TEXT,
  last_tested_at TIMESTAMPTZ,
  config JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    oi.id as integration_id,
    p.slug as provider_slug,
    p.name as provider_name,
    c.slug as category_slug,
    p.auth_type,
    oi.connection_status,
    oi.last_tested_at,
    oi.config
  FROM public.organization_integrations oi
  INNER JOIN public.integration_providers p ON oi.provider_id = p.id
  INNER JOIN public.integration_categories c ON p.category_id = c.id
  WHERE oi.enabled = true
    AND (category_slug_input IS NULL OR c.slug = category_slug_input)
    AND (organization_id_input IS NULL OR oi.organization_id = organization_id_input)
  ORDER BY c.display_order, p.display_order;
END;
$$;

COMMENT ON FUNCTION public.get_enabled_integrations IS 'Get all enabled integrations, optionally filtered by category.';

-- ============================================
-- FUNCTION: log_integration_usage
-- Convenience function for logging integration API usage
-- ============================================
CREATE OR REPLACE FUNCTION public.log_integration_usage(
  provider_slug_input TEXT,
  action_input TEXT,
  status_input TEXT DEFAULT 'success',
  request_metadata_input JSONB DEFAULT NULL,
  response_metadata_input JSONB DEFAULT NULL,
  error_message_input TEXT DEFAULT NULL,
  estimated_cost_input DECIMAL(10, 8) DEFAULT 0,
  organization_id_input UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  provider_record RECORD;
  log_id UUID;
BEGIN
  -- Get provider
  SELECT id INTO provider_record
  FROM public.integration_providers
  WHERE slug = provider_slug_input;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Provider not found: %', provider_slug_input;
  END IF;

  -- Insert usage log
  INSERT INTO public.integration_usage_logs (
    organization_id,
    provider_id,
    user_id,
    action,
    status,
    request_metadata,
    response_metadata,
    error_message,
    estimated_cost
  ) VALUES (
    organization_id_input,
    provider_record.id,
    auth.uid(),
    action_input,
    status_input,
    request_metadata_input,
    response_metadata_input,
    error_message_input,
    estimated_cost_input
  )
  RETURNING id INTO log_id;

  RETURN log_id;
END;
$$;

COMMENT ON FUNCTION public.log_integration_usage IS 'Log integration API usage for analytics and debugging.';

-- ============================================
-- FUNCTION: get_integration_usage_stats
-- Get usage statistics for a provider
-- ============================================
CREATE OR REPLACE FUNCTION public.get_integration_usage_stats(
  provider_slug_input TEXT,
  start_date TIMESTAMPTZ DEFAULT NULL,
  end_date TIMESTAMPTZ DEFAULT NULL,
  organization_id_input UUID DEFAULT NULL
)
RETURNS TABLE (
  total_calls BIGINT,
  successful_calls BIGINT,
  failed_calls BIGINT,
  success_rate NUMERIC,
  total_cost NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  provider_record RECORD;
  start_filter TIMESTAMPTZ;
  end_filter TIMESTAMPTZ;
BEGIN
  -- Verify user is admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can view usage statistics';
  END IF;

  -- Get provider
  SELECT id INTO provider_record
  FROM public.integration_providers
  WHERE slug = provider_slug_input;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Provider not found: %', provider_slug_input;
  END IF;

  -- Default to last 30 days if not specified
  start_filter := COALESCE(start_date, now() - interval '30 days');
  end_filter := COALESCE(end_date, now());

  RETURN QUERY
  SELECT
    COUNT(*) as total_calls,
    COUNT(*) FILTER (WHERE status = 'success') as successful_calls,
    COUNT(*) FILTER (WHERE status = 'error') as failed_calls,
    ROUND(
      COUNT(*) FILTER (WHERE status = 'success')::NUMERIC / NULLIF(COUNT(*), 0) * 100,
      2
    ) as success_rate,
    SUM(estimated_cost) as total_cost
  FROM public.integration_usage_logs
  WHERE provider_id = provider_record.id
    AND created_at BETWEEN start_filter AND end_filter
    AND (organization_id_input IS NULL OR organization_id = organization_id_input);
END;
$$;

COMMENT ON FUNCTION public.get_integration_usage_stats IS 'Get usage statistics for a provider over a date range.';

-- ============================================
-- FUNCTION: get_default_service
-- Get the default service for a provider
-- ============================================
CREATE OR REPLACE FUNCTION public.get_default_service(
  provider_slug_input TEXT
)
RETURNS TABLE (
  service_id UUID,
  service_name TEXT,
  service_key TEXT,
  features JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  provider_record RECORD;
BEGIN
  -- Get provider
  SELECT id INTO provider_record
  FROM public.integration_providers
  WHERE slug = provider_slug_input;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Provider not found: %', provider_slug_input;
  END IF;

  RETURN QUERY
  SELECT
    s.id as service_id,
    s.name as service_name,
    s.service_key,
    s.features
  FROM public.integration_services s
  WHERE s.provider_id = provider_record.id
    AND s.enabled = true
    AND s.is_default = true
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION public.get_default_service IS 'Get the default service for a provider (if any).';

-- ============================================
-- FUNCTION: toggle_service
-- Enable or disable a specific service
-- ============================================
CREATE OR REPLACE FUNCTION public.toggle_service(
  provider_slug_input TEXT,
  service_key_input TEXT,
  enabled_input BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  provider_record RECORD;
BEGIN
  -- Verify user is admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can toggle services';
  END IF;

  -- Get provider
  SELECT id INTO provider_record
  FROM public.integration_providers
  WHERE slug = provider_slug_input;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Provider not found: %', provider_slug_input;
  END IF;

  -- Update service
  UPDATE public.integration_services
  SET enabled = enabled_input,
      updated_at = now()
  WHERE provider_id = provider_record.id
    AND service_key = service_key_input;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service not found: % for provider: %', service_key_input, provider_slug_input;
  END IF;

  RETURN enabled_input;
END;
$$;

COMMENT ON FUNCTION public.toggle_service IS 'Enable or disable a specific service for a provider.';

-- ============================================
-- Success Message
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'Integration helper functions created successfully!';
  RAISE NOTICE 'Available functions:';
  RAISE NOTICE '  - get_integration_config(provider_slug)';
  RAISE NOTICE '  - set_integration_config(provider_slug, config, enabled)';
  RAISE NOTICE '  - test_integration_connection(provider_slug, is_valid, message)';
  RAISE NOTICE '  - get_enabled_integrations(category_slug)';
  RAISE NOTICE '  - log_integration_usage(provider_slug, action, status, ...)';
  RAISE NOTICE '  - get_integration_usage_stats(provider_slug, start_date, end_date)';
  RAISE NOTICE '  - get_default_service(provider_slug)';
  RAISE NOTICE '  - toggle_service(provider_slug, service_key, enabled)';
END $$;
