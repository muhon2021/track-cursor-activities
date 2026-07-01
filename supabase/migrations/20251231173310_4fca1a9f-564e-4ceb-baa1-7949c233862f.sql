INSERT INTO public.user_roles (user_id, role)
VALUES ('78657387-d518-4b2e-88d8-eca802372ad5', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;