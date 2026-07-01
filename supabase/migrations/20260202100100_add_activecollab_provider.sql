-- Add ActiveCollab to Project Management integration providers
DO $$
DECLARE
  cat_pm UUID;
BEGIN
  SELECT id INTO cat_pm FROM public.integration_categories WHERE slug = 'project-management' LIMIT 1;
  IF cat_pm IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.integration_providers WHERE slug = 'activecollab') THEN
    INSERT INTO public.integration_providers (category_id, name, slug, description, auth_type, docs_url, is_available, is_coming_soon, display_order)
    VALUES (cat_pm, 'ActiveCollab', 'activecollab', 'Project management and task tracking with time tracking and invoicing', 'api_key', 'https://developers.activecollab.com/', false, true, 5);
  END IF;
END $$;
