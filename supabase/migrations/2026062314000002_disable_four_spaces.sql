-- Disable Four Spaces IA — revert to legacy Control Tower layout
UPDATE public.app_config
SET value = 'false'
WHERE key = 'features.enableFourSpaces';

INSERT INTO public.app_config (key, value, category, description)
VALUES (
  'features.enableFourSpaces',
  'false',
  'features',
  'Four Spaces IA (disabled — legacy layout)'
)
ON CONFLICT (key) DO UPDATE SET value = 'false';
