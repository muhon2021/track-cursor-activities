INSERT INTO public.user_roles (user_id, role)
SELECT 'c4642966-5969-4d55-b3a6-ce850c1e2786'::uuid, 'admin'::public.app_role
WHERE EXISTS (
  SELECT 1 FROM auth.users WHERE id = 'c4642966-5969-4d55-b3a6-ce850c1e2786'::uuid
)
ON CONFLICT (user_id, role) DO NOTHING;