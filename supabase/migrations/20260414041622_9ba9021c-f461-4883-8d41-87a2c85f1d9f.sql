UPDATE public.integration_providers AS p
SET category_id = c.id,
    updated_at = now()
FROM public.integration_categories AS c
WHERE p.slug = 'fellow'
  AND c.slug = 'meeting-providers'
  AND p.category_id IS DISTINCT FROM c.id;