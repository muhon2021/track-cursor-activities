INSERT INTO public.user_roles (user_id, role)
SELECT '78657387-d518-4b2e-88d8-eca802372ad5'::uuid, 'admin'::public.app_role
WHERE EXISTS (
  SELECT 1 FROM auth.users WHERE id = '78657387-d518-4b2e-88d8-eca802372ad5'::uuid
)
ON CONFLICT (user_id, role) DO NOTHING;