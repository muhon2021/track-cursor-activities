-- 20251231172609_3aa165f4-5399-48e1-a212-5dc21af21710.sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('2d711b86-45bf-43ae-b216-7eb917668b58', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- 20251231173310_4fca1a9f-564e-4ceb-baa1-7949c233862f.sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('78657387-d518-4b2e-88d8-eca802372ad5', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- 20251231183400_create_match_embeddings_function.sql
-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Create match_embeddings function for semantic search
CREATE OR REPLACE FUNCTION match_embeddings(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  entity_type text,
  entity_id text,
  content text,
  metadata jsonb,
  user_id uuid,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.entity_type,
    e.entity_id,
    e.content,
    e.metadata,
    e.user_id,
    1 - (e.embedding <=> query_embedding) as similarity
  FROM embeddings e
  WHERE 1 - (e.embedding <=> query_embedding) > match_threshold
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Create index on embeddings for faster vector search
CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON embeddings
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Add comment
COMMENT ON FUNCTION match_embeddings IS 'Performs vector similarity search on embeddings table using cosine similarity';


-- 20251231183500_insert_test_data.sql
-- Insert test data for Clients
INSERT INTO clients (name, email, company, phone, status, metadata) VALUES
  ('John Doe', 'john.doe@example.com', 'Acme Corp', '+1-555-0101', 'active', '{"notes": "VIP client, prefers email communication"}'),
  ('Jane Smith', 'jane.smith@techstart.io', 'TechStart Inc', '+1-555-0102', 'active', '{"notes": "Interested in AI features"}'),
  ('Michael Johnson', 'mjohnson@enterprise.com', 'Enterprise Solutions', '+1-555-0103', 'active', '{"notes": "Large account, quarterly meetings"}'),
  ('Sarah Williams', 'sarah.w@startup.co', 'Startup Co', '+1-555-0104', 'prospect', '{"notes": "Potential client, sent proposal"}'),
  ('David Brown', 'dbrown@consulting.net', 'Brown Consulting', '+1-555-0105', 'active', '{"notes": "Monthly retainer client"}')
ON CONFLICT (email) DO NOTHING;

-- Insert test data for Knowledge Categories
INSERT INTO knowledge_categories (name, slug, description, icon, color, sort_order) VALUES
  ('Getting Started', 'getting-started', 'Introduction and setup guides', '🚀', '#3B82F6', 1),
  ('API Documentation', 'api-docs', 'API references and integration guides', '📚', '#10B981', 2),
  ('Best Practices', 'best-practices', 'Recommended approaches and patterns', '⭐', '#F59E0B', 3),
  ('Troubleshooting', 'troubleshooting', 'Common issues and solutions', '🔧', '#EF4444', 4),
  ('Features', 'features', 'Feature documentation and usage', '✨', '#8B5CF6', 5)
ON CONFLICT (slug) DO NOTHING;

-- Insert test knowledge entries
INSERT INTO knowledge_entries (title, content, slug, category_id, tags, summary, status, author_id)
SELECT
  'Quick Start Guide',
  E'# Quick Start Guide\n\nWelcome to CollabAI! This guide will help you get started.\n\n## Step 1: Create an Account\nSign up using your email or Google account.\n\n## Step 2: Set Up Your Profile\nComplete your profile information.\n\n## Step 3: Explore Features\nDiscover the powerful features available.',
  'quick-start-guide-' || EXTRACT(EPOCH FROM NOW())::bigint,
  (SELECT id FROM knowledge_categories WHERE slug = 'getting-started' LIMIT 1),
  ARRAY['quickstart', 'tutorial', 'beginner'],
  'A comprehensive guide to getting started with CollabAI',
  'published',
  (SELECT id FROM auth.users LIMIT 1)
WHERE EXISTS (SELECT 1 FROM auth.users LIMIT 1)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO knowledge_entries (title, content, slug, category_id, tags, summary, status, author_id)
SELECT
  'AI Chat Assistant Usage',
  E'# AI Chat Assistant\n\nLearn how to use the AI Chat Assistant feature.\n\n## Overview\nThe AI Chat Assistant helps you with various tasks using natural language.\n\n## How to Use\n1. Navigate to the AI Chat page\n2. Type your question\n3. Get instant AI-powered responses\n\n## Tips\n- Be specific in your questions\n- You can ask follow-up questions\n- The assistant has context awareness',
  'ai-chat-assistant-usage-' || EXTRACT(EPOCH FROM NOW())::bigint,
  (SELECT id FROM knowledge_categories WHERE slug = 'features' LIMIT 1),
  ARRAY['ai', 'chat', 'assistant'],
  'How to use the AI Chat Assistant feature',
  'published',
  (SELECT id FROM auth.users LIMIT 1)
WHERE EXISTS (SELECT 1 FROM auth.users LIMIT 1)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO knowledge_entries (title, content, slug, category_id, tags, summary, status, author_id)
SELECT
  'API Authentication',
  E'# API Authentication\n\n## Overview\nLearn how to authenticate with the CollabAI API.\n\n## Methods\n1. **API Key Authentication**\n   - Include your API key in the Authorization header\n   - Format: `Authorization: Bearer YOUR_API_KEY`\n\n2. **OAuth 2.0**\n   - Use OAuth for user-based authentication\n   - Supports Google OAuth\n\n## Security Best Practices\n- Never expose your API keys in client-side code\n- Rotate keys regularly\n- Use environment variables',
  'api-authentication-' || EXTRACT(EPOCH FROM NOW())::bigint,
  (SELECT id FROM knowledge_categories WHERE slug = 'api-docs' LIMIT 1),
  ARRAY['api', 'authentication', 'security'],
  'Authentication methods for the CollabAI API',
  'published',
  (SELECT id FROM auth.users LIMIT 1)
WHERE EXISTS (SELECT 1 FROM auth.users LIMIT 1)
ON CONFLICT (slug) DO NOTHING;

-- Insert test AI agents
INSERT INTO ai_agents (name, slug, description, system_prompt, category, is_enabled)
VALUES
  (
    'Email Draft Assistant',
    'email-draft-assistant',
    'Helps draft professional emails',
    'You are a professional email writing assistant. Help users compose clear, professional, and effective emails. Maintain appropriate tone and structure.',
    'communication',
    true
  ),
  (
    'Meeting Summary Generator',
    'meeting-summary',
    'Generates concise meeting summaries',
    'You are a meeting summarization expert. Create concise, well-structured summaries that capture key points, decisions, and action items.',
    'analysis',
    true
  ),
  (
    'Code Review Assistant',
    'code-review',
    'Reviews code and provides suggestions',
    'You are an experienced code reviewer. Analyze code for best practices, potential bugs, performance issues, and security concerns. Provide constructive feedback.',
    'development',
    true
  )
ON CONFLICT (slug) DO NOTHING;

-- Add comment
COMMENT ON TABLE clients IS 'Test data includes 5 sample clients';
COMMENT ON TABLE knowledge_entries IS 'Test data includes sample knowledge articles';
COMMENT ON TABLE ai_agents IS 'Test data includes 3 AI agent templates';


-- 20251231202732_799e6766-6e4e-439e-b46b-190f8d8ca6d2.sql
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

-- 20251231214712_f2e2729d-d22b-4d89-9aa5-5d5091b1068a.sql
-- Migration 1: App Config Table
CREATE TABLE IF NOT EXISTS public.app_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  category text NOT NULL DEFAULT 'general',
  description text,
  is_sensitive boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Admins can manage all config
CREATE POLICY "Admins can manage config"
  ON public.app_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Users can read non-sensitive config
CREATE POLICY "Users can read non-sensitive config"
  ON public.app_config FOR SELECT TO authenticated
  USING (is_sensitive = false);

-- Updated_at trigger
CREATE TRIGGER update_app_config_updated_at
  BEFORE UPDATE ON public.app_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Migration 2: User Invites Table
CREATE TABLE IF NOT EXISTS public.user_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  role text DEFAULT 'user',
  invited_by uuid REFERENCES public.profiles(id),
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  used_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_invites ENABLE ROW LEVEL SECURITY;

-- Admins can manage invites
CREATE POLICY "Admins can manage invites"
  ON public.user_invites FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_invites_email ON public.user_invites(email);
CREATE INDEX IF NOT EXISTS idx_user_invites_token ON public.user_invites(token);
CREATE INDEX IF NOT EXISTS idx_user_invites_expires_at ON public.user_invites(expires_at);

-- Migration 3: User Status Columns on Profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS deactivated_at timestamptz;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS deactivated_by uuid REFERENCES public.profiles(id);

-- Index for active users
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles(is_active);

-- Backfill existing users as active
UPDATE public.profiles SET is_active = true WHERE is_active IS NULL;

-- 20251231214950_d66f401d-349f-411a-b279-d94f27b357dc.sql
-- Enable RLS on meeting_transcripts table
ALTER TABLE public.meeting_transcripts ENABLE ROW LEVEL SECURITY;

-- Create policies for meeting_transcripts
-- Users can view transcripts for meetings they organized
CREATE POLICY "Users can view transcripts for their meetings"
  ON public.meeting_transcripts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.meetings 
      WHERE meetings.id = meeting_transcripts.meeting_id 
      AND meetings.organizer_id = auth.uid()
    )
  );

-- Users can insert transcripts for meetings they organized
CREATE POLICY "Users can insert transcripts for their meetings"
  ON public.meeting_transcripts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.meetings 
      WHERE meetings.id = meeting_transcripts.meeting_id 
      AND meetings.organizer_id = auth.uid()
    )
  );

-- Admins can manage all transcripts
CREATE POLICY "Admins can manage all transcripts"
  ON public.meeting_transcripts FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 20260101_activity_logs.sql
-- Activity logs table for tracking user actions
-- This table records all significant user actions for auditing and monitoring
-- Admins can view all logs, users can view their own

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  action text NOT NULL,
  resource_type text,
  resource_id text,
  details jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Create index for efficient queries
CREATE INDEX idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_action ON public.activity_logs(action);
CREATE INDEX idx_activity_logs_resource ON public.activity_logs(resource_type, resource_id);

-- Enable RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view all activity logs
CREATE POLICY "Admins can view all activity logs"
  ON public.activity_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Users can view their own activity logs
CREATE POLICY "Users can view own activity logs"
  ON public.activity_logs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Only system/backend can insert logs (users can't manually create logs)
-- This will be done through edge functions or triggers
CREATE POLICY "Service role can insert activity logs"
  ON public.activity_logs
  FOR INSERT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Helper function to log activity
CREATE OR REPLACE FUNCTION public.log_activity(
  p_user_id uuid,
  p_action text,
  p_resource_type text DEFAULT NULL,
  p_resource_id text DEFAULT NULL,
  p_details jsonb DEFAULT '{}'::jsonb,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO public.activity_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    details,
    ip_address,
    user_agent
  ) VALUES (
    p_user_id,
    p_action,
    p_resource_type,
    p_resource_id,
    p_details,
    p_ip_address,
    p_user_agent
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert some example activity logs for testing (optional - remove in production)
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Get first user ID for demo data
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.activity_logs (user_id, action, resource_type, resource_id, details, created_at) VALUES
      (v_user_id, 'user.login', NULL, NULL, '{"method": "email"}'::jsonb, now() - interval '1 hour'),
      (v_user_id, 'client.created', 'client', '123', '{"name": "Acme Corp"}'::jsonb, now() - interval '2 hours'),
      (v_user_id, 'meeting.scheduled', 'meeting', '456', '{"title": "Kickoff Meeting"}'::jsonb, now() - interval '3 hours'),
      (v_user_id, 'agent.created', 'agent', '789', '{"name": "Sales Assistant"}'::jsonb, now() - interval '5 hours'),
      (v_user_id, 'settings.updated', NULL, NULL, '{"section": "profile"}'::jsonb, now() - interval '1 day');
  END IF;
END $$;


