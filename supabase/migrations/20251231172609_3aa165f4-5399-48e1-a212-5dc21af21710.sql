INSERT INTO public.user_roles (user_id, role)
VALUES ('2d711b86-45bf-43ae-b216-7eb917668b58', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;