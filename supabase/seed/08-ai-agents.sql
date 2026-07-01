-- ============================================================
-- SEED: AI Agents Module
-- Providers, models, agents (extend existing), chat history,
-- usage logs
-- ============================================================

DO $$
DECLARE
  u1 UUID := (SELECT id FROM auth.users ORDER BY created_at LIMIT 1);
  prov_openai UUID;
  prov_anthropic UUID;
  prov_gemini UUID;
  model_gpt4 UUID;
  model_claude UUID;
  model_embed UUID;
  agent_email UUID;
  agent_meeting UUID;
  agent_ops UUID;
  session1 UUID := gen_random_uuid();
  session2 UUID := gen_random_uuid();
BEGIN

-- 1. AI Providers (description column may or may not exist depending on migration)
-- Try with description first, fall back to without
BEGIN
  INSERT INTO ai_providers (name, slug, description, api_key_secret_name, base_url, enabled) VALUES
    ('OpenAI',    'openai',    'GPT-4, GPT-3.5, and embedding models.',       'OPENAI_API_KEY',    'https://api.openai.com/v1',      true),
    ('Anthropic', 'anthropic', 'Claude Opus, Sonnet, and Haiku models.',      'ANTHROPIC_API_KEY', 'https://api.anthropic.com/v1',    true),
    ('Google',    'google',    'Gemini Pro and embedding models.',             'GOOGLE_API_KEY',    'https://generativelanguage.googleapis.com', false)
  ON CONFLICT (slug) DO NOTHING;
EXCEPTION WHEN undefined_column THEN
  INSERT INTO ai_providers (name, slug, api_key_secret_name, base_url, enabled) VALUES
    ('OpenAI',    'openai',    'OPENAI_API_KEY',    'https://api.openai.com/v1',      true),
    ('Anthropic', 'anthropic', 'ANTHROPIC_API_KEY', 'https://api.anthropic.com/v1',    true),
    ('Google',    'google',    'GOOGLE_API_KEY',    'https://generativelanguage.googleapis.com', false)
  ON CONFLICT (slug) DO NOTHING;
END;

SELECT id INTO prov_openai    FROM ai_providers WHERE slug = 'openai' LIMIT 1;
SELECT id INTO prov_anthropic FROM ai_providers WHERE slug = 'anthropic' LIMIT 1;
SELECT id INTO prov_gemini    FROM ai_providers WHERE slug = 'google' LIMIT 1;

-- 2. AI Models
INSERT INTO ai_models (provider_id, model_id, name, category, enabled, is_default, context_window, input_cost_per_1k, output_cost_per_1k) VALUES
  (prov_openai,    'gpt-4o',                    'GPT-4o',              'chat',      true, false, 128000, 0.005,  0.015),
  (prov_openai,    'gpt-4o-mini',               'GPT-4o Mini',         'chat',      true, false, 128000, 0.00015, 0.0006),
  (prov_openai,    'text-embedding-3-small',     'Embedding 3 Small',  'embedding', true, true,  8191,   0.00002, 0),
  (prov_anthropic, 'claude-sonnet-4-20250514',   'Claude Sonnet 4',    'chat',      true, true,  200000, 0.003,  0.015),
  (prov_anthropic, 'claude-haiku-3-5-20241022',  'Claude 3.5 Haiku',   'chat',      true, false, 200000, 0.001,  0.005),
  (prov_gemini,    'gemini-2.0-flash',           'Gemini 2.0 Flash',   'chat',      false, false, 1000000, 0.00035, 0.0015)
ON CONFLICT DO NOTHING;

SELECT id INTO model_gpt4  FROM ai_models WHERE model_id = 'gpt-4o' LIMIT 1;
SELECT id INTO model_claude FROM ai_models WHERE model_id = 'claude-sonnet-4-20250514' LIMIT 1;
SELECT id INTO model_embed  FROM ai_models WHERE model_id = 'text-embedding-3-small' LIMIT 1;

-- 3. Additional AI agents (3 already exist from test-data; add more)
INSERT INTO ai_agents (name, slug, description, system_prompt, category, is_enabled, memory_enabled, data_sources, required_role) VALUES
  ('Operations Advisor', 'operations-advisor',
   'Analyzes team productivity data and suggests operational improvements.',
   'You are an operations advisor for a professional services firm. You have access to productivity metrics, attendance data, and team structures. Provide data-driven recommendations for improving team efficiency, workload balance, and operational processes. Be specific and actionable.',
   'operations', true, true, '["productivity_records","departments","pods"]'::jsonb, 'admin'),

  ('Deal Coach', 'deal-coach',
   'Helps sales team with deal strategy, email drafts, and objection handling.',
   'You are a B2B sales coach specializing in SaaS sales to mid-market companies. Help with deal strategy, email drafts, discovery call prep, and objection handling. Use the MEDDPICC framework when analyzing deals. Be direct and practical.',
   'sales', true, true, '["deals","contacts","deal_activities"]'::jsonb, 'user'),

  ('Knowledge Search', 'knowledge-search',
   'Semantic search across company knowledge base articles and documents.',
   'You are a knowledge assistant with access to the company knowledge base. Answer questions by searching relevant articles and documents. Always cite your sources. If you cannot find relevant information, say so clearly.',
   'knowledge', true, false, '["knowledge_entries","knowledge_files","common_knowledge"]'::jsonb, 'user'),

  ('EOS Coach', 'eos-coach',
   'Guides teams through EOS processes — L10s, rocks, IDS, and accountability.',
   'You are an EOS (Entrepreneurial Operating System) implementation coach. Help teams run effective L10 meetings, set quarterly rocks, use the IDS process for issues, and maintain accountability charts. Reference EOS best practices from Traction by Gino Wickman.',
   'eos', true, true, '["eos_vto","okrs","eos_issues","eos_scorecards"]'::jsonb, 'user'),

  ('Project Analyst', 'project-analyst',
   'Analyzes project health, risks, and provides status summaries.',
   'You are a project management analyst. Review project data including milestones, budgets, risks, and team assignments. Provide clear status summaries, highlight risks, and suggest mitigation strategies. Use earned value management concepts when discussing budget.',
   'projects', true, false, '["projects","project_milestones","project_risks","project_billing"]'::jsonb, 'user')
ON CONFLICT (slug) DO NOTHING;

SELECT id INTO agent_email   FROM ai_agents WHERE slug = 'email-draft-assistant' LIMIT 1;
SELECT id INTO agent_meeting FROM ai_agents WHERE slug = 'meeting-summary' LIMIT 1;
SELECT id INTO agent_ops     FROM ai_agents WHERE slug = 'operations-advisor' LIMIT 1;

-- 4. Chat history (sample conversations)
IF agent_email IS NOT NULL THEN
  INSERT INTO ai_chat_history (session_id, user_id, agent_id, role, content) VALUES
    (session1, u1, agent_email, 'user',      'Help me draft a follow-up email to Tom Bradley at FinEdge after our discovery call. He is interested in productivity analytics.'),
    (session1, u1, agent_email, 'assistant', E'Subject: Great Speaking with You — Next Steps for FinEdge\n\nHi Tom,\n\nThank you for taking the time to speak with us today. It was great learning about FinEdge''s goals around team productivity analytics.\n\nBased on our conversation, I believe our Productivity module would be a strong fit for your needs. Here''s what I suggest as next steps:\n\n1. **Proof of Concept** — We can set up a focused POC with your team''s data\n2. **Technical Deep-Dive** — A 30-minute session with our engineering team\n3. **Pricing Discussion** — I''ll send over our POC pricing sheet\n\nWould Thursday at 2 PM ET work for the technical session?\n\nBest regards'),
    (session1, u1, agent_email, 'user',      'That looks good. Make it a bit shorter and more casual.'),
    (session1, u1, agent_email, 'assistant', E'Subject: Following Up — FinEdge + SJ Innovation\n\nHey Tom,\n\nGreat chatting today! Really enjoyed learning about what you''re building at FinEdge.\n\nI think our productivity analytics would be a solid fit. Quick next steps:\n- POC with your team''s data\n- 30-min technical walkthrough\n- Pricing details\n\nFree Thursday at 2 PM ET for a deeper dive?\n\nCheers');
END IF;

IF agent_ops IS NOT NULL THEN
  INSERT INTO ai_chat_history (session_id, user_id, agent_id, role, content) VALUES
    (session2, u1, agent_ops, 'user',      'What are the productivity trends for the engineering team over the last 4 weeks?'),
    (session2, u1, agent_ops, 'assistant', E'Based on the last 4 weeks of data for the Engineering department:\n\n**Utilization Trends:**\n- Shahed: 85.7% → 86.4% → 88.9% → 88.4% (steady upward)\n- Abesh: 85.0% → 87.5% → 87.8% → 87.5% (stable high)\n- Zia: 78.9% → 77.8% → 82.5% → 85.0% (recovering after dip)\n\n**Key Observations:**\n1. The team averaged 85.3% utilization this week, up from 83.2% in week 1\n2. Zia had a partial attendance week (Jan 12) but has recovered well\n3. Task completion rates are improving across the board\n\n**Recommendations:**\n- Zia is trending positively — the reduced meeting load (2/week vs Shahed''s 5) seems to be helping focus time\n- Consider redistributing some of Shahed''s 13 assigned tasks — he''s carrying the heaviest load');
END IF;

-- 5. Usage logs
IF model_claude IS NOT NULL THEN
  INSERT INTO ai_usage_logs (user_id, model_id, function_name, input_tokens, output_tokens, estimated_cost) VALUES
    (u1, model_claude, 'agent_chat',        1200, 800,  0.015),
    (u1, model_claude, 'agent_chat',        900,  600,  0.012),
    (u1, model_claude, 'meeting_summarize', 3500, 500,  0.018);
END IF;
IF model_embed IS NOT NULL THEN
  INSERT INTO ai_usage_logs (user_id, model_id, function_name, input_tokens, output_tokens, embedding_tokens, estimated_cost) VALUES
    (u1, model_embed, 'embed_knowledge', 0, 0, 5000, 0.0001),
    (u1, model_embed, 'embed_knowledge', 0, 0, 3200, 0.0001);
END IF;

END $$;
