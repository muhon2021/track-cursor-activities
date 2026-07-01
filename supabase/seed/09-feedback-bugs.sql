-- ============================================================
-- SEED: Feedback bug reports (Sales & CRM triage)
-- Three bug reports for the Feedback dashboard. Idempotent.
-- Run after 00-platform-core (requires auth.users).
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.feedback
    WHERE subject = 'Companies page displays contacts by name instead of company listing'
    LIMIT 1
  ) THEN
    INSERT INTO public.feedback (user_id, type, subject, message, status, module) VALUES
    (
      (SELECT id FROM auth.users ORDER BY created_at LIMIT 1),
      'bug',
      'Companies page displays contacts by name instead of company listing',
      'When navigating to Sales & CRM > Companies, the page displays individual contact names instead of grouping and sorting by company. Expected behavior: the Companies view should list unique companies with their associated contacts, sorted alphabetically by company name. Currently it shows the clients table rows sorted by contact name, which makes it look identical to a contacts list.',
      'pending',
      'Sales & CRM'
    ),
    (
      (SELECT id FROM auth.users ORDER BY created_at LIMIT 1),
      'bug',
      'Contacts page shows mismatched or incorrect data',
      'The Contacts view under Sales & CRM is displaying data that does not match correctly. Contact records appear to have mismatched information. The listing should accurately show each contact with their correct associated details (name, email, phone, company, title, lead status).',
      'pending',
      'Sales & CRM'
    ),
    (
      (SELECT id FROM auth.users ORDER BY created_at LIMIT 1),
      'bug',
      'Client detail page missing information and showing unnecessary Avg Project Value metric',
      'Two issues on the Client detail page: (1) Remove the "Avg Project Value" stat card from the Clients listing page (src/pages/Clients.tsx lines 173-185) -- this dollar metric is not needed. (2) The Client detail page (src/pages/ClientDetail.tsx) is missing significant information compared to the main Control Tower dashboard. It currently only shows email, phone, company, created/updated dates, notes, and related meetings. It should match the richness of the main dashboard view with additional context like projects, deals, invoices, status, and activity history.',
      'pending',
      'Sales & CRM'
    );
  END IF;
END $$;
