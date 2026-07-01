-- Add unique constraints for seed file ON CONFLICT clauses

-- clients.email unique
ALTER TABLE public.clients 
ADD CONSTRAINT clients_email_unique UNIQUE (email);

-- app_modules.slug unique
ALTER TABLE public.app_modules 
ADD CONSTRAINT app_modules_slug_unique UNIQUE (slug);

-- system_settings (category, key) unique
ALTER TABLE public.system_settings 
ADD CONSTRAINT system_settings_category_key_unique UNIQUE (category, key);

-- app_config.key unique
ALTER TABLE public.app_config 
ADD CONSTRAINT app_config_key_unique UNIQUE (key);