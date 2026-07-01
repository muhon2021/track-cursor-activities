-- ============================================================================
-- Seed Lead Follow-Up AI Agents
-- ============================================================================
-- Creates AI agent configurations for mood analysis, intent analysis,
-- email drafting, research, and conversation opener generation.
-- ============================================================================

-- Insert AI Agents (if ai_agents table exists)
INSERT INTO ai_agents (
  name,
  slug,
  category,
  description,
  system_prompt,
  provider_config,
  required_role,
  is_enabled,
  memory_enabled,
  created_at,
  updated_at
) VALUES
  (
    'Client Mood Analyzer',
    'client-mood-analyzer',
    'sales',
    'Analyzes contact sentiment and emotional state based on communication history',
    'You are an expert sales psychologist analyzing client emotional state and sentiment. Based on the provided communication history, meetings, and interactions, determine the client''s mood (warm, neutral, or cold) with a confidence level. Provide key signals that indicate this mood, reasoning for your assessment, and a suggested action.',
    '{"provider": "gemini", "model": "gemini-2.5-flash", "fallback_provider": "openai", "fallback_model": "gpt-4o-mini", "temperature": 0.3, "max_tokens": 1000}'::jsonb,
    'user',
    true,
    true,
    NOW(),
    NOW()
  ),
  (
    'Client Intent & Momentum Analyzer',
    'client-intent-analyzer',
    'sales',
    'Analyzes deal momentum and client purchase intent (active, stalled, or dormant)',
    'You are an expert sales analyst assessing deal momentum and purchase intent. Based on recent activities, meeting frequency, task completion, and communication patterns, determine if this opportunity is active, stalled, or dormant. Identify positive momentum signals and decay signals. Provide a momentum score (0-100), reasoning, and suggested next action.',
    '{"provider": "openai", "model": "gpt-4o", "fallback_provider": "gemini", "fallback_model": "gemini-2.5-pro", "temperature": 0.3, "max_tokens": 1200}'::jsonb,
    'user',
    true,
    true,
    NOW(),
    NOW()
  ),
  (
    'Email Draft Generator',
    'email-draft-generator',
    'sales',
    'Generates professional, personalized email drafts for follow-ups',
    'You are an expert email copywriter specializing in sales outreach. Generate a professional, personalized email draft based on the provided context including contact information, communication history, meetings, and the specified intent (regular, sales, upsell, reengage, or thank you). The email should be concise (150-250 words), personalized, and include a clear call-to-action.',
    '{"provider": "openai", "model": "gpt-4o", "fallback_provider": "anthropic", "fallback_model": "claude-opus-4-6", "temperature": 0.7, "max_tokens": 800}'::jsonb,
    'user',
    true,
    true,
    NOW(),
    NOW()
  ),
  (
    'LinkedIn Research Agent',
    'linkedin-research-agent',
    'sales',
    'Researches contact and company information via LinkedIn and web sources',
    'You are an expert researcher conducting LinkedIn and web research. Research the provided contact information and provide insights on recent activity, job changes, company news, and relevant business context.',
    '{"provider": "perplexity", "model": "sonar", "temperature": 0.2, "max_tokens": 1500}'::jsonb,
    'user',
    true,
    true,
    NOW(),
    NOW()
  ),
  (
    'Conversation Opener Generator',
    'conversation-opener-generator',
    'sales',
    'Generates contextual conversation starters based on contact intelligence',
    'You are an expert sales conversation strategist. Based on all available contact intelligence including profile, recent activities, meetings, deals, and industry context, generate 3-5 compelling conversation openers. Each opener should be personalized, context-aware, and include a brief explanation of why it works.',
    '{"provider": "gemini", "model": "gemini-2.5-flash", "fallback_provider": "openai", "fallback_model": "gpt-4o-mini", "temperature": 0.8, "max_tokens": 1000}'::jsonb,
    'user',
    true,
    true,
    NOW(),
    NOW()
  )
ON CONFLICT (slug) DO UPDATE SET
  description = EXCLUDED.description,
  system_prompt = EXCLUDED.system_prompt,
  provider_config = EXCLUDED.provider_config,
  updated_at = NOW();
