-- =============================================
-- DEMO DATA FOR SJ INNOVATION (All Constraints Fixed)
-- =============================================

-- 1. UPDATE PROFILES
UPDATE profiles SET full_name = 'Shahed Islam', avatar_url = 'https://api.dicebear.com/7.x/initials/svg?seed=SI' WHERE id = '2d711b86-45bf-43ae-b216-7eb917668b58';
UPDATE profiles SET full_name = 'Alex Morgan', avatar_url = 'https://api.dicebear.com/7.x/initials/svg?seed=AM' WHERE id = '78657387-d518-4b2e-88d8-eca802372ad5';
UPDATE profiles SET full_name = 'Jordan Taylor', avatar_url = 'https://api.dicebear.com/7.x/initials/svg?seed=JT' WHERE id = 'e46a6d4e-d69e-4bf5-9341-ba998e8da243';

-- 2. CLIENTS (14 Total)
INSERT INTO clients (name, email, company, phone, status, metadata, created_by) VALUES
('Michael Richardson', 'mrichardson@richardson-lawgroup.com', 'Richardson Law Group LLP', '+1-555-0101', 'active', '{"notes": "Enterprise client", "industry": "Law Firm", "practice_area": "Corporate Law", "firm_size": "45 attorneys", "deal_size": "$150,000"}', '2d711b86-45bf-43ae-b216-7eb917668b58'),
('Sarah Chen', 'schen@chenandpartners.com', 'Chen & Partners', '+1-555-0102', 'active', '{"notes": "Immigration law specialists", "industry": "Law Firm", "practice_area": "Immigration Law", "firm_size": "18 attorneys", "deal_size": "$85,000"}', '2d711b86-45bf-43ae-b216-7eb917668b58'),
('James Thompson', 'jthompson@thompson-legal.com', 'Thompson Legal Associates', '+1-555-0103', 'active', '{"notes": "Personal injury firm", "industry": "Law Firm", "practice_area": "Personal Injury", "firm_size": "12 attorneys", "deal_size": "$65,000"}', '2d711b86-45bf-43ae-b216-7eb917668b58'),
('Elizabeth Warren', 'ewarren@warrendefense.com', 'Warren Defense Law', '+1-555-0104', 'prospect', '{"notes": "Initial discovery", "industry": "Law Firm", "practice_area": "Criminal Defense", "firm_size": "8 attorneys", "deal_size": "$45,000"}', '2d711b86-45bf-43ae-b216-7eb917668b58'),
('Robert Martinez', 'rmartinez@martinez-family-law.com', 'Martinez Family Law', '+1-555-0105', 'active', '{"notes": "Family law boutique", "industry": "Law Firm", "practice_area": "Family Law", "firm_size": "6 attorneys", "deal_size": "$55,000"}', '2d711b86-45bf-43ae-b216-7eb917668b58'),
('Patricia Williams', 'pwilliams@williams-ip.com', 'Williams Intellectual Property', '+1-555-0106', 'inactive', '{"notes": "Contract paused", "industry": "Law Firm", "practice_area": "Intellectual Property", "firm_size": "22 attorneys", "deal_size": "$95,000"}', '2d711b86-45bf-43ae-b216-7eb917668b58'),
('David Kim', 'dkim@kimrealestate-law.com', 'Kim Real Estate Law', '+1-555-0107', 'prospect', '{"notes": "New inquiry", "industry": "Law Firm", "practice_area": "Real Estate Law", "firm_size": "10 attorneys", "deal_size": "$70,000"}', '2d711b86-45bf-43ae-b216-7eb917668b58'),
('Jennifer Adams', 'jadams@adams-cpa.com', 'Adams & Associates CPA', '+1-555-0201', 'active', '{"notes": "Tax season automation", "industry": "CPA Firm", "practice_area": "Tax Preparation", "firm_size": "35 CPAs", "deal_size": "$120,000"}', '2d711b86-45bf-43ae-b216-7eb917668b58'),
('William Foster', 'wfoster@fosteraccounting.com', 'Foster Accounting Group', '+1-555-0202', 'active', '{"notes": "Full-service firm", "industry": "Accounting Firm", "practice_area": "Full Service", "firm_size": "50 staff", "deal_size": "$175,000"}', '2d711b86-45bf-43ae-b216-7eb917668b58'),
('Amanda Rodriguez', 'arodriguez@rodriguez-tax.com', 'Rodriguez Tax Services', '+1-555-0203', 'active', '{"notes": "Tax-focused practice", "industry": "CPA Firm", "practice_area": "Tax Services", "firm_size": "15 CPAs", "deal_size": "$75,000"}', '2d711b86-45bf-43ae-b216-7eb917668b58'),
('Christopher Lee', 'clee@lee-audit.com', 'Lee Audit & Assurance', '+1-555-0204', 'active', '{"notes": "Audit specialists", "industry": "Accounting Firm", "practice_area": "Audit & Assurance", "firm_size": "28 staff", "deal_size": "$95,000"}', '2d711b86-45bf-43ae-b216-7eb917668b58'),
('Michelle Brown', 'mbrown@brownbookkeeping.com', 'Brown Bookkeeping Solutions', '+1-555-0205', 'prospect', '{"notes": "Growing firm", "industry": "Accounting Firm", "practice_area": "Bookkeeping", "firm_size": "8 staff", "deal_size": "$35,000"}', '2d711b86-45bf-43ae-b216-7eb917668b58'),
('Thomas Anderson', 'tanderson@anderson-advisory.com', 'Anderson Advisory Services', '+1-555-0206', 'active', '{"notes": "CFO advisory", "industry": "Accounting Firm", "practice_area": "CFO Advisory", "firm_size": "12 consultants", "deal_size": "$85,000"}', '2d711b86-45bf-43ae-b216-7eb917668b58'),
('Nancy Wilson', 'nwilson@wilson-forensic.com', 'Wilson Forensic Accounting', '+1-555-0207', 'inactive', '{"notes": "Project on hold", "industry": "Accounting Firm", "practice_area": "Forensic Accounting", "firm_size": "6 specialists", "deal_size": "$65,000"}', '2d711b86-45bf-43ae-b216-7eb917668b58');

-- 3. MEETINGS (18 Total)
INSERT INTO meetings (title, description, scheduled_at, duration_minutes, status, meeting_type, organizer_id, client_id) VALUES
('Case Management System Demo - Richardson Law', 'Present custom case management solution.', '2025-01-03 10:00:00-05', 90, 'scheduled', 'virtual', '2d711b86-45bf-43ae-b216-7eb917668b58', (SELECT id FROM clients WHERE company = 'Richardson Law Group LLP' LIMIT 1)),
('Tax Workflow Sprint Planning - Adams CPA', 'Sprint planning for tax season automation.', '2025-01-06 14:00:00-05', 60, 'scheduled', 'virtual', '2d711b86-45bf-43ae-b216-7eb917668b58', (SELECT id FROM clients WHERE company = 'Adams & Associates CPA' LIMIT 1)),
('Document Processing Review - Chen Partners', 'Review immigration form automation.', '2025-01-07 11:00:00-05', 45, 'scheduled', 'virtual', '2d711b86-45bf-43ae-b216-7eb917668b58', (SELECT id FROM clients WHERE company = 'Chen & Partners' LIMIT 1)),
('Practice Management Implementation - Foster', 'Phase 2 kickoff.', '2025-01-08 09:00:00-05', 60, 'scheduled', 'virtual', '2d711b86-45bf-43ae-b216-7eb917668b58', (SELECT id FROM clients WHERE company = 'Foster Accounting Group' LIMIT 1)),
('Discovery Call - Warren Defense', 'Initial discovery meeting.', '2025-01-09 15:00:00-05', 45, 'scheduled', 'virtual', '2d711b86-45bf-43ae-b216-7eb917668b58', (SELECT id FROM clients WHERE company = 'Warren Defense Law' LIMIT 1)),
('Audit Workpaper Demo - Lee Audit', 'Demonstrate audit workpaper system.', '2025-01-10 10:00:00-05', 60, 'scheduled', 'virtual', '2d711b86-45bf-43ae-b216-7eb917668b58', (SELECT id FROM clients WHERE company = 'Lee Audit & Assurance' LIMIT 1)),
('Client Portal Training - Martinez Family Law', 'Training session for client portal.', '2025-01-13 14:00:00-05', 90, 'scheduled', 'virtual', '2d711b86-45bf-43ae-b216-7eb917668b58', (SELECT id FROM clients WHERE company = 'Martinez Family Law' LIMIT 1)),
('Discovery Call - Kim Real Estate', 'New prospect call.', '2025-01-15 11:00:00-05', 30, 'scheduled', 'virtual', '2d711b86-45bf-43ae-b216-7eb917668b58', (SELECT id FROM clients WHERE company = 'Kim Real Estate Law' LIMIT 1)),
('Q4 Review - Thompson Legal', 'Quarterly review.', '2024-12-20 10:00:00-05', 60, 'completed', 'virtual', '2d711b86-45bf-43ae-b216-7eb917668b58', (SELECT id FROM clients WHERE company = 'Thompson Legal Associates' LIMIT 1)),
('Tax Season Prep - Rodriguez Tax', 'Preparation meeting.', '2024-12-18 14:00:00-05', 45, 'completed', 'virtual', '2d711b86-45bf-43ae-b216-7eb917668b58', (SELECT id FROM clients WHERE company = 'Rodriguez Tax Services' LIMIT 1)),
('CFO Dashboard Launch - Anderson Advisory', 'Successful launch.', '2024-12-16 11:00:00-05', 60, 'completed', 'virtual', '2d711b86-45bf-43ae-b216-7eb917668b58', (SELECT id FROM clients WHERE company = 'Anderson Advisory Services' LIMIT 1)),
('Contract Review - Williams IP', 'Contract pause discussion.', '2024-12-12 09:00:00-05', 45, 'completed', 'virtual', '2d711b86-45bf-43ae-b216-7eb917668b58', (SELECT id FROM clients WHERE company = 'Williams Intellectual Property' LIMIT 1)),
('Year-End Review - Richardson Law', 'Annual review.', '2024-12-10 10:00:00-05', 90, 'completed', 'in-person', '2d711b86-45bf-43ae-b216-7eb917668b58', (SELECT id FROM clients WHERE company = 'Richardson Law Group LLP' LIMIT 1)),
('Forensic Tools Demo - Wilson', 'Postponed.', '2024-12-22 14:00:00-05', 60, 'cancelled', 'virtual', '2d711b86-45bf-43ae-b216-7eb917668b58', (SELECT id FROM clients WHERE company = 'Wilson Forensic Accounting' LIMIT 1)),
('Cloud Platform Demo - Brown Bookkeeping', 'Rescheduled.', '2024-12-28 11:00:00-05', 45, 'cancelled', 'virtual', '2d711b86-45bf-43ae-b216-7eb917668b58', (SELECT id FROM clients WHERE company = 'Brown Bookkeeping Solutions' LIMIT 1)),
('Phase 3 Planning - Foster Accounting', 'Plan features.', '2025-01-22 10:00:00-05', 60, 'scheduled', 'virtual', '2d711b86-45bf-43ae-b216-7eb917668b58', (SELECT id FROM clients WHERE company = 'Foster Accounting Group' LIMIT 1)),
('Go-Live Review - Chen Partners', 'Final review.', '2025-01-24 14:00:00-05', 90, 'scheduled', 'virtual', '2d711b86-45bf-43ae-b216-7eb917668b58', (SELECT id FROM clients WHERE company = 'Chen & Partners' LIMIT 1)),
('Tax Season Kickoff', 'Group webinar.', '2025-01-28 11:00:00-05', 60, 'scheduled', 'virtual', '2d711b86-45bf-43ae-b216-7eb917668b58', (SELECT id FROM clients WHERE company = 'Adams & Associates CPA' LIMIT 1));

-- 4. AI AGENTS (6 Specialized Agents)
INSERT INTO ai_agents (slug, name, description, system_prompt, category, is_enabled, memory_enabled, provider_config) VALUES
('legal-research', 'Legal Research Assistant', 'Research case law and legal precedents.', 'You are an expert legal research assistant. Always cite sources. Never provide legal advice.', 'legal', true, true, '{"model": "gpt-4", "temperature": 0.3}'),
('contract-analyzer', 'Contract Analyzer', 'Analyze contracts and identify risks.', 'You are a contract analysis specialist.', 'legal', true, true, '{"model": "gpt-4", "temperature": 0.2}'),
('tax-advisor', 'Tax Research Assistant', 'Research tax regulations and IRS guidance.', 'You are a tax research assistant. Cite IRC sections.', 'accounting', true, true, '{"model": "gpt-4", "temperature": 0.3}'),
('financial-analyst', 'Financial Analysis Assistant', 'Analyze financial statements.', 'You are a financial analysis assistant.', 'accounting', true, true, '{"model": "gpt-4", "temperature": 0.4}'),
('client-communicator', 'Client Email Composer', 'Draft professional communications.', 'You are an expert at drafting professional client communications.', 'productivity', true, false, '{"model": "gpt-4", "temperature": 0.5}'),
('meeting-prep', 'Meeting Preparation Assistant', 'Prepare meeting agendas.', 'You are a meeting preparation specialist.', 'productivity', true, true, '{"model": "gpt-4", "temperature": 0.4}');

-- 5. KNOWLEDGE BASE ENTRIES
INSERT INTO knowledge_entries (title, slug, content, summary, status, category_id, tags, view_count, author_id) VALUES
('Welcome to SJ Innovation', 'welcome-sj-innovation', '# Welcome\n\nManage your software project here.', 'Introduction to the portal.', 'published', 'a02b8ff1-8432-465f-9801-81c228419a8a', ARRAY['onboarding'], 245, '2d711b86-45bf-43ae-b216-7eb917668b58'),
('API Integration Guide', 'api-integration-law-firms', '# API Guide\n\nIntegrating with legal software.', 'Technical integration guide.', 'published', 'e241fe6d-b52f-4945-a6c2-de74035f581c', ARRAY['api', 'integration'], 156, '2d711b86-45bf-43ae-b216-7eb917668b58'),
('Legal Research Assistant Guide', 'legal-research-guide', '# Legal Research\n\nEffective prompts for research.', 'Guide to legal research AI.', 'published', '200d7c6f-d21e-44a5-9e65-bd6e829331de', ARRAY['ai-assistant'], 312, '2d711b86-45bf-43ae-b216-7eb917668b58'),
('Tax Research Best Practices', 'tax-research-guide', '# Tax Research\n\nIRS guidance and regulations.', 'Tax research best practices.', 'published', '200d7c6f-d21e-44a5-9e65-bd6e829331de', ARRAY['tax-research'], 278, '2d711b86-45bf-43ae-b216-7eb917668b58'),
('Billing FAQ', 'billing-faq', '# Billing FAQ\n\nProject billing explained.', 'Billing and subscription FAQ.', 'published', '83567036-4743-414d-ae98-e5db1cc32265', ARRAY['billing', 'faq'], 367, '2d711b86-45bf-43ae-b216-7eb917668b58'),
('Security FAQ', 'security-faq', '# Security FAQ\n\nSOC 2 and encryption info.', 'Data security FAQ.', 'published', '83567036-4743-414d-ae98-e5db1cc32265', ARRAY['security', 'faq'], 412, '2d711b86-45bf-43ae-b216-7eb917668b58');

-- 6. NOTIFICATIONS (types: info, success, warning, error)
INSERT INTO notifications (user_id, title, message, type, link, is_read) VALUES
('2d711b86-45bf-43ae-b216-7eb917668b58', 'Meeting in 1 Hour', 'Case Management Demo starts at 10:00 AM', 'warning', '/meetings', false),
('2d711b86-45bf-43ae-b216-7eb917668b58', 'New Prospect Added', 'Warren Defense Law added', 'success', '/clients', false),
('2d711b86-45bf-43ae-b216-7eb917668b58', 'Meeting Notes Ready', 'Q4 Review notes available', 'info', '/meetings', true),
('2d711b86-45bf-43ae-b216-7eb917668b58', 'Client Status Changed', 'Williams IP now inactive', 'warning', '/clients', true),
('2d711b86-45bf-43ae-b216-7eb917668b58', 'Tax Season Alert', 'Adams CPA testing due', 'warning', '/clients', false),
('2d711b86-45bf-43ae-b216-7eb917668b58', 'Knowledge Updated', 'New article published', 'info', '/knowledge', true),
('2d711b86-45bf-43ae-b216-7eb917668b58', 'AI Agent Improved', 'Tax Assistant updated', 'success', '/ai-chat', true),
('2d711b86-45bf-43ae-b216-7eb917668b58', 'Weekly Report', 'Activity report ready', 'info', '/dashboard', false),
('78657387-d518-4b2e-88d8-eca802372ad5', 'System Update', 'Maintenance Sunday 2am', 'info', '/admin', false);

-- 7. FEEDBACK (types: bug, feature, improvement, general | status: pending, reviewed, resolved, closed)
INSERT INTO feedback (user_id, type, subject, message, rating, status) VALUES
('2d711b86-45bf-43ae-b216-7eb917668b58', 'general', 'Excellent Legal Research Assistant', 'Saved hours of research time. Citation format is perfect.', 5, 'reviewed'),
('2d711b86-45bf-43ae-b216-7eb917668b58', 'feature', 'Court Calendar Integration', 'Integration with court filing systems for deadline population.', null, 'pending'),
('2d711b86-45bf-43ae-b216-7eb917668b58', 'general', 'Tax Research Feedback', 'Very helpful for IRS guidance lookups.', 4, 'reviewed'),
('2d711b86-45bf-43ae-b216-7eb917668b58', 'feature', 'Mobile App', 'Attorneys want project status on mobile.', null, 'pending'),
('2d711b86-45bf-43ae-b216-7eb917668b58', 'bug', 'Timezone Display Issue', 'EST meetings show wrong time for West Coast.', 3, 'pending'),
('2d711b86-45bf-43ae-b216-7eb917668b58', 'general', 'Excellent Client Portal', 'Secure messaging works great for family law.', 5, 'reviewed');

-- 8. AI CHAT HISTORY
INSERT INTO ai_chat_history (user_id, session_id, agent_id, role, content, metadata) VALUES
('2d711b86-45bf-43ae-b216-7eb917668b58', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', (SELECT id FROM ai_agents WHERE slug = 'legal-research' LIMIT 1), 'user', 'Find 2nd Circuit cases on trademark infringement in e-commerce', '{}'),
('2d711b86-45bf-43ae-b216-7eb917668b58', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', (SELECT id FROM ai_agents WHERE slug = 'legal-research' LIMIT 1), 'assistant', '**Tiffany v. eBay (2010)**: Online marketplaces not liable without specific knowledge.\n**Gucci v. Frontline (2010)**: Payment processor liability.', '{"citations": 2}'),
('2d711b86-45bf-43ae-b216-7eb917668b58', 'b2c3d4e5-f6a7-8901-bcde-f12345678901', (SELECT id FROM ai_agents WHERE slug = 'tax-advisor' LIMIT 1), 'user', 'Section 199A QBI deduction limits for SSTBs in 2024?', '{}'),
('2d711b86-45bf-43ae-b216-7eb917668b58', 'b2c3d4e5-f6a7-8901-bcde-f12345678901', (SELECT id FROM ai_agents WHERE slug = 'tax-advisor' LIMIT 1), 'assistant', '**2024 Thresholds**: Single $191,950-$241,950, MFJ $383,900-$483,900. Citations: IRC § 199A(d)(2), Treas. Reg. § 1.199A-5.', '{"citations": 2}');