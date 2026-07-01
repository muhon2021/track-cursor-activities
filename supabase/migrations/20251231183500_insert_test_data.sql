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
