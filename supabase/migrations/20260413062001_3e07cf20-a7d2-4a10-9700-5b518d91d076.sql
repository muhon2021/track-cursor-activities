DO $$
DECLARE
  jid UUID;
BEGIN
  SELECT id INTO jid FROM public.integration_providers WHERE slug = 'jira' LIMIT 1;
  IF jid IS NULL THEN
    RAISE NOTICE 'jira provider not found; skip integration_fields';
    RETURN;
  END IF;

  INSERT INTO public.integration_fields (
    provider_id,
    field_key,
    label,
    field_type,
    placeholder,
    is_required,
    is_sensitive,
    help_text,
    display_order
  )
  SELECT
    jid,
    v.field_key,
    v.label,
    v.field_type::text,
    v.placeholder,
    v.is_required,
    v.is_sensitive,
    v.help_text,
    v.display_order
  FROM (VALUES
    ('jira_host', 'Jira site URL', 'url', 'https://your-domain.atlassian.net', true, false,
     'Your Jira Cloud site base URL (with or without https://). Must match JIRA_HOST secret for sync.', 10),
    ('jira_email', 'Atlassian account email', 'email', 'you@company.com', true, false,
     'Email for the Atlassian account used to create the API token. Same as JIRA_EMAIL secret.', 20),
    ('jira_api_token', 'API token', 'password', 'API token from id.atlassian.com', true, true,
     'Create at https://id.atlassian.com/manage-profile/security/api-tokens — also set as JIRA_API_TOKEN secret for Edge sync.', 30)
  ) AS v(field_key, label, field_type, placeholder, is_required, is_sensitive, help_text, display_order)
  ON CONFLICT (provider_id, field_key) DO UPDATE SET
    label = EXCLUDED.label,
    field_type = EXCLUDED.field_type,
    placeholder = EXCLUDED.placeholder,
    is_required = EXCLUDED.is_required,
    is_sensitive = EXCLUDED.is_sensitive,
    help_text = EXCLUDED.help_text,
    display_order = EXCLUDED.display_order;
END $$;