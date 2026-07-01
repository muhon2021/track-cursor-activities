INSERT INTO public.user_roles (user_id, role)
VALUES ('c4642966-5969-4d55-b3a6-ce850c1e2786', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;