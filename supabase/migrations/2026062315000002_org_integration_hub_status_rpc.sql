-- Read-only org integration hub status for all authenticated users (no credentials exposed)

CREATE OR REPLACE FUNCTION public.get_org_integration_hub_status()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT jsonb_build_object(
    'primary_by_category',
    COALESCE(
      (
        SELECT primary_by_category
        FROM public.integration_settings
        WHERE organization_id IS NULL
        LIMIT 1
      ),
      '{}'::jsonb
    ),
    'connected_providers',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'slug', ip.slug,
            'name', ip.name,
            'category_slug', ic.slug,
            'category_name', ic.name
          )
          ORDER BY ic.display_order NULLS LAST, ip.display_order NULLS LAST, ip.name
        )
        FROM (
          SELECT DISTINCT ON (ip.id)
            ip.id,
            ip.slug,
            ip.name,
            ip.category_id,
            ip.display_order
          FROM public.organization_integrations oi
          JOIN public.integration_providers ip ON ip.id = oi.provider_id
          WHERE oi.connection_status = 'connected'
            AND COALESCE(oi.enabled, true) = true
          ORDER BY ip.id, oi.updated_at DESC NULLS LAST
        ) ip
        JOIN public.integration_categories ic ON ic.id = ip.category_id
      ),
      '[]'::jsonb
    )
  );
$$;

REVOKE ALL ON FUNCTION public.get_org_integration_hub_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_org_integration_hub_status() TO authenticated;

COMMENT ON FUNCTION public.get_org_integration_hub_status IS
  'Non-sensitive org integration hub snapshot: primary_by_category + connected provider names for user settings UI';
