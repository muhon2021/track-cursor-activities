-- ============================================================================
-- Seed Knowledge Base with Demo Data
-- ============================================================================
-- Adds sample categories, sources, entries, and files so the Knowledge
-- module has meaningful data out of the box for demos.
-- This migration is idempotent via ON CONFLICT on slugs.
-- ============================================================================

DO $$
BEGIN
  INSERT INTO public.knowledge_categories (name, slug, description, icon, color, sort_order, metadata)
  VALUES (
    'General Knowledge',
    'general-knowledge',
    'High-level internal documentation, FAQs, and onboarding guides.',
    'BookOpen',
    'blue',
    10,
    jsonb_build_object('demo', true)
  )
  ON CONFLICT (slug) DO UPDATE
    SET description = EXCLUDED.description,
        icon = EXCLUDED.icon,
        color = EXCLUDED.color;

  INSERT INTO public.knowledge_categories (name, slug, description, icon, color, sort_order, metadata)
  VALUES (
    'Client Playbooks',
    'client-playbooks',
    'Playbooks, SOPs, and templates for working with clients.',
    'FolderTree',
    'green',
    20,
    jsonb_build_object('demo', true)
  )
  ON CONFLICT (slug) DO UPDATE
    SET description = EXCLUDED.description,
        icon = EXCLUDED.icon,
        color = EXCLUDED.color;

  INSERT INTO public.knowledge_categories (name, slug, description, icon, color, sort_order, metadata)
  VALUES (
    'Meeting Notes',
    'meeting-notes',
    'Important meeting summaries and decision logs.',
    'Calendar',
    'purple',
    30,
    jsonb_build_object('demo', true)
  )
  ON CONFLICT (slug) DO UPDATE
    SET description = EXCLUDED.description,
        icon = EXCLUDED.icon,
        color = EXCLUDED.color;
END $$;

-- 2) Seed knowledge_sources (admin-managed) – schema has no slug; use name + WHERE NOT EXISTS
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.knowledge_sources WHERE name = 'Internal Handbook') THEN
    INSERT INTO public.knowledge_sources (name, source_type, config, is_active, last_synced_at, created_at, updated_at)
    VALUES (
      'Internal Handbook',
      'url',
      jsonb_build_object('demo', true, 'url', 'https://example.com/docs/handbook', 'description', 'Core internal handbook and company policies.'),
      true,
      NULL,
      now(),
      now()
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.knowledge_sources WHERE name = 'Client Templates') THEN
    INSERT INTO public.knowledge_sources (name, source_type, config, is_active, last_synced_at, created_at, updated_at)
    VALUES (
      'Client Templates',
      'google_drive',
      jsonb_build_object('demo', true, 'url', 'https://drive.google.com/demo-client-templates', 'description', 'Proposal, SOW, and onboarding templates.'),
      true,
      NULL,
      now(),
      now()
    );
  END IF;
END $$;

-- 3) Seed knowledge_entries (article-style KB)
SELECT
  1
WHERE NOT EXISTS (
  SELECT 1 FROM public.knowledge_entries WHERE slug = 'getting-started-control-tower'
);

DO $$
DECLARE
  v_cat_general UUID;
  v_author UUID;
BEGIN
  SELECT id INTO v_cat_general
  FROM public.knowledge_categories
  WHERE slug = 'general-knowledge';

  -- Use an existing user as author (auth.uid() is null in migration context)
  SELECT id INTO v_author
  FROM auth.users
  ORDER BY created_at
  LIMIT 1;

  IF v_cat_general IS NOT NULL AND v_author IS NOT NULL THEN
    INSERT INTO public.knowledge_entries (
      title,
      slug,
      content,
      summary,
      category_id,
      author_id,
      status,
      tags,
      metadata
    )
    VALUES (
      'Getting Started with the Control Tower',
      'getting-started-control-tower',
      'This article walks through the end-to-end flow of logging in, connecting integrations, and using the Control Tower dashboard for daily operations.',
      'End-to-end overview of how to use the Control Tower for daily work, including modules, navigation, and integrations.',
      v_cat_general,
      v_author,
      'published',
      ARRAY['onboarding', 'overview'],
      jsonb_build_object('demo', true)
    )
    ON CONFLICT (slug) DO NOTHING;
  END IF;
END $$;

-- 4) Seed knowledge_files (document-level KB)
DO $$
DECLARE
  v_cat_general UUID;
  v_cat_clients UUID;
  v_src_internal UUID;
  v_src_client_templates UUID;
BEGIN
  SELECT id INTO v_cat_general FROM public.knowledge_categories WHERE slug = 'general-knowledge';
  SELECT id INTO v_cat_clients FROM public.knowledge_categories WHERE slug = 'client-playbooks';
  SELECT id INTO v_src_internal FROM public.knowledge_sources WHERE name = 'Internal Handbook';
  SELECT id INTO v_src_client_templates FROM public.knowledge_sources WHERE name = 'Client Templates';

  IF v_cat_general IS NOT NULL AND v_src_internal IS NOT NULL THEN
    INSERT INTO public.knowledge_files (
      category_id,
      source_id,
      title,
      file_name,
      file_type,
      file_size,
      storage_path,
      processing_status,
      chunk_count,
      embedding_model,
      metadata,
      uploaded_by,
      processed_at
    )
    VALUES (
      v_cat_general,
      v_src_internal,
      'Control Tower Overview (PDF)',
      'control-tower-overview.pdf',
      'application/pdf',
      123456,
      'demo/knowledge/control-tower-overview.pdf',
      'completed',
      8,
      'text-embedding-3-small',
      jsonb_build_object('demo', true, 'description', 'High-level product overview PDF for demos.'),
      auth.uid(),
      now()
    )
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_cat_clients IS NOT NULL AND v_src_client_templates IS NOT NULL THEN
    INSERT INTO public.knowledge_files (
      category_id,
      source_id,
      title,
      file_name,
      file_type,
      file_size,
      storage_path,
      processing_status,
      chunk_count,
      embedding_model,
      metadata,
      uploaded_by,
      processed_at
    )
    VALUES (
      v_cat_clients,
      v_src_client_templates,
      'Client Onboarding Checklist',
      'client-onboarding-checklist.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      45678,
      'demo/knowledge/client-onboarding-checklist.docx',
      'completed',
      5,
      'text-embedding-3-small',
      jsonb_build_object('demo', true, 'description', 'Checklist template for onboarding new clients.'),
      auth.uid(),
      now()
    )
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

