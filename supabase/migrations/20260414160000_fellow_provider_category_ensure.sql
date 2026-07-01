-- Ensure Fellow stays under Meeting Providers (Integration Hub groups by category_id).
-- Fixes environments where fellow was created with the wrong category_id.

UPDATE public.integration_providers AS p
SET category_id = c.id,
    updated_at = now()
FROM public.integration_categories AS c
WHERE p.slug = 'fellow'
  AND c.slug = 'meeting-providers'
  AND p.category_id IS DISTINCT FROM c.id;
