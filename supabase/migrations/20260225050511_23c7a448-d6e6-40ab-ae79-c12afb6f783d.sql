
-- Seed HubSpot demo data for Sales Hub (all records in one migration)

-- 2 HubSpot Clients
INSERT INTO public.clients (id, name, company, email, phone, status, data_source, external_id, external_url, last_synced_at, created_at, updated_at)
VALUES
  ('a1b2c3d4-1111-4000-8000-000000000001', 'Acme Corp', 'Acme Corporation', 'info@acmecorp.com', '+1-555-100-2000', 'active', 'hubspot', 'hs-company-90210001', 'https://app.hubspot.com/contacts/12345678/company/90210001', now() - interval '2 hours', now() - interval '30 days', now() - interval '2 hours'),
  ('a1b2c3d4-1111-4000-8000-000000000002', 'NovaTech Solutions', 'NovaTech Solutions Inc.', 'hello@novatech.io', '+1-555-300-4000', 'active', 'hubspot', 'hs-company-90210002', 'https://app.hubspot.com/contacts/12345678/company/90210002', now() - interval '45 minutes', now() - interval '14 days', now() - interval '45 minutes')
ON CONFLICT (id) DO NOTHING;

-- 4 HubSpot Contacts
INSERT INTO public.contacts (id, first_name, last_name, email, phone, title, company, client_id, data_source, external_id, external_url, last_synced_at, linkedin_url, source, created_at, updated_at)
VALUES
  ('b2c3d4e5-2222-4000-8000-000000000001', 'Marcus', 'Chen', 'marcus.chen@acmecorp.com', '+1-555-101-0001', 'VP of Engineering', 'Acme Corporation', 'a1b2c3d4-1111-4000-8000-000000000001', 'hubspot', 'hs-contact-80110001', 'https://app.hubspot.com/contacts/12345678/contact/80110001', now() - interval '2 hours', 'https://linkedin.com/in/marcus-chen', 'hubspot', now() - interval '28 days', now() - interval '2 hours'),
  ('b2c3d4e5-2222-4000-8000-000000000002', 'Sarah', 'Winters', 'sarah.winters@acmecorp.com', '+1-555-101-0002', 'Head of Product', 'Acme Corporation', 'a1b2c3d4-1111-4000-8000-000000000001', 'hubspot', 'hs-contact-80110002', 'https://app.hubspot.com/contacts/12345678/contact/80110002', now() - interval '2 hours', 'https://linkedin.com/in/sarah-winters', 'hubspot', now() - interval '21 days', now() - interval '2 hours'),
  ('b2c3d4e5-2222-4000-8000-000000000003', 'Derek', 'Patel', 'derek.patel@novatech.io', '+1-555-301-0001', 'CTO', 'NovaTech Solutions Inc.', 'a1b2c3d4-1111-4000-8000-000000000002', 'hubspot', 'hs-contact-80110003', 'https://app.hubspot.com/contacts/12345678/contact/80110003', now() - interval '45 minutes', 'https://linkedin.com/in/derek-patel', 'hubspot', now() - interval '10 days', now() - interval '45 minutes'),
  ('b2c3d4e5-2222-4000-8000-000000000004', 'Emily', 'Nakamura', 'emily.nakamura@novatech.io', '+1-555-301-0002', 'Director of Operations', 'NovaTech Solutions Inc.', 'a1b2c3d4-1111-4000-8000-000000000002', 'hubspot', 'hs-contact-80110004', 'https://app.hubspot.com/contacts/12345678/contact/80110004', now() - interval '45 minutes', 'https://linkedin.com/in/emily-nakamura', 'hubspot', now() - interval '7 days', now() - interval '45 minutes')
ON CONFLICT (id) DO NOTHING;

-- 3 HubSpot Deals
INSERT INTO public.deals (id, title, slug, stage, value, currency, probability, expected_close_date, description, client_id, contact_id, data_source, external_id, external_url, last_synced_at, source, created_at, updated_at)
VALUES
  ('c3d4e5f6-3333-4000-8000-000000000001', 'Acme — Enterprise Platform License', 'acme-enterprise-platform-license', 'proposal', 120000, 'USD', 60, (now() + interval '45 days')::date, 'Full enterprise platform license for Acme Corp engineering team.', 'a1b2c3d4-1111-4000-8000-000000000001', 'b2c3d4e5-2222-4000-8000-000000000001', 'hubspot', 'hs-deal-70330001', 'https://app.hubspot.com/contacts/12345678/deal/70330001', now() - interval '2 hours', 'hubspot', now() - interval '20 days', now() - interval '2 hours'),
  ('c3d4e5f6-3333-4000-8000-000000000002', 'NovaTech — Pilot Program', 'novatech-pilot-program', 'estimation', 36000, 'USD', 40, (now() + interval '30 days')::date, '3-month pilot program for NovaTech operations team. 25 seats.', 'a1b2c3d4-1111-4000-8000-000000000002', 'b2c3d4e5-2222-4000-8000-000000000003', 'hubspot', 'hs-deal-70330002', 'https://app.hubspot.com/contacts/12345678/deal/70330002', now() - interval '45 minutes', 'hubspot', now() - interval '8 days', now() - interval '45 minutes'),
  ('c3d4e5f6-3333-4000-8000-000000000003', 'Acme — AI Analytics Module', 'acme-ai-analytics-module', 'discovery', 45000, 'USD', 25, (now() + interval '90 days')::date, 'Add-on AI analytics module for Acme Corp.', 'a1b2c3d4-1111-4000-8000-000000000001', 'b2c3d4e5-2222-4000-8000-000000000002', 'hubspot', 'hs-deal-70330003', 'https://app.hubspot.com/contacts/12345678/deal/70330003', now() - interval '2 hours', 'hubspot', now() - interval '5 days', now() - interval '2 hours')
ON CONFLICT (id) DO NOTHING;
