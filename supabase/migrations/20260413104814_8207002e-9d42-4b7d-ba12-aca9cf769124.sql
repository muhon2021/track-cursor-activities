DO $$
DECLARE
  pm_category_id UUID;
  float_provider_id UUID;
BEGIN
  SELECT id INTO pm_category_id
  FROM public.integration_categories
  WHERE slug = 'project-management'
  LIMIT 1;

  IF pm_category_id IS NULL THEN
    RAISE EXCEPTION 'integration category project-management not found';
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
    pm_category_id,
    'Float',
    'float',
    'Resource scheduling platform for people, projects, and allocations',
    'api_key',
    'https://developer.float.com',
    true,
    false,
    60
  )
  ON CONFLICT (slug) DO UPDATE SET
    category_id = EXCLUDED.category_id,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    auth_type = EXCLUDED.auth_type,
    docs_url = EXCLUDED.docs_url,
    is_available = EXCLUDED.is_available,
    is_coming_soon = EXCLUDED.is_coming_soon,
    display_order = EXCLUDED.display_order;

  SELECT id INTO float_provider_id
  FROM public.integration_providers
  WHERE slug = 'float'
  LIMIT 1;

  INSERT INTO public.integration_fields (
    provider_id,
    field_key,
    label,
    field_type,
    placeholder,
    is_required,
    is_sensitive,
    help_text,
    display_order
  )
  VALUES
    (
      float_provider_id,
      'float_api_key',
      'Float API key',
      'password',
      'Paste your Float personal access token',
      true,
      true,
      'Create in Float profile settings. Used by sync-float-schedule.',
      10
    ),
    (
      float_provider_id,
      'float_base_url',
      'Float API base URL',
      'url',
      'https://api.float.com/v3',
      false,
      false,
      'Optional override. Default is https://api.float.com/v3',
      20
    )
  ON CONFLICT (provider_id, field_key) DO UPDATE SET
    label = EXCLUDED.label,
    field_type = EXCLUDED.field_type,
    placeholder = EXCLUDED.placeholder,
    is_required = EXCLUDED.is_required,
    is_sensitive = EXCLUDED.is_sensitive,
    help_text = EXCLUDED.help_text,
    display_order = EXCLUDED.display_order;
END $$;

CREATE TABLE IF NOT EXISTS public.float_synced_people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  float_people_id TEXT NOT NULL,
  name TEXT,
  email TEXT,
  role TEXT,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT float_synced_people_unique UNIQUE (float_people_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.float_synced_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  float_project_id TEXT NOT NULL,
  name TEXT,
  client_name TEXT,
  projects_linked BOOLEAN NOT NULL DEFAULT false,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT float_synced_projects_unique UNIQUE (float_project_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.float_synced_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  float_allocation_id TEXT NOT NULL,
  float_people_id TEXT,
  float_project_id TEXT,
  starts_at DATE,
  ends_at DATE,
  hours NUMERIC,
  source_type TEXT,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT float_synced_allocations_unique UNIQUE (float_allocation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_float_people_user ON public.float_synced_people(user_id);
CREATE INDEX IF NOT EXISTS idx_float_projects_user ON public.float_synced_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_float_allocations_user ON public.float_synced_allocations(user_id);

ALTER TABLE public.float_synced_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.float_synced_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.float_synced_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read float_synced_people" ON public.float_synced_people;
DROP POLICY IF EXISTS "Authenticated users can read float_synced_projects" ON public.float_synced_projects;
DROP POLICY IF EXISTS "Authenticated users can read float_synced_allocations" ON public.float_synced_allocations;

CREATE POLICY "Authenticated users can read float_synced_people"
  ON public.float_synced_people FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read float_synced_projects"
  ON public.float_synced_projects FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read float_synced_allocations"
  ON public.float_synced_allocations FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT ON public.float_synced_people TO authenticated;
GRANT SELECT ON public.float_synced_projects TO authenticated;
GRANT SELECT ON public.float_synced_allocations TO authenticated;
REVOKE ALL ON public.float_synced_people FROM anon;
REVOKE ALL ON public.float_synced_projects FROM anon;
REVOKE ALL ON public.float_synced_allocations FROM anon;