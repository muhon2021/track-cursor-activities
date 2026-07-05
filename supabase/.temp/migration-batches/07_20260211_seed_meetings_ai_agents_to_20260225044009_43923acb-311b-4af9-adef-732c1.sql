-- 20260211_seed_meetings_ai_agents.sql
-- ============================================================================
-- Seed Meetings Module AI Agents
-- ============================================================================
-- Creates 8 AI agent configurations for the meetings module covering:
--   1. Meeting Summarizer — Generate structured meeting summaries
--   2. Action Item Extractor — Extract action items from transcripts
--   3. Meeting Categorizer — Auto-categorize meetings by type and topic
--   4. Meeting Prep Assistant — Prepare briefings before meetings
--   5. Transcript Analyzer — Deep analysis of meeting transcripts
--   6. Follow-Up Email Generator — Draft post-meeting follow-up emails
--   7. Meeting Efficiency Coach — Analyze and improve meeting effectiveness
--   8. Client-Meeting Matcher — Match unassigned meetings to clients/deals
-- ============================================================================

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
  avatar,
  welcome_message,
  conversation_starters,
  created_at,
  updated_at
) VALUES
  -- ---------------------------------------------------------------
  -- 1. Meeting Summarizer
  -- ---------------------------------------------------------------
  (
    'Meeting Summarizer',
    'meeting-summarizer',
    'meetings',
    'Generates concise, structured summaries from meeting transcripts or notes including key decisions, action items, and open questions.',
    'You are an expert meeting summarizer for a professional services company. Given a meeting transcript, notes, or context, produce a structured summary with these sections:

## Summary
A 2-3 sentence executive summary of the meeting purpose and outcome.

## Key Decisions
Bullet list of decisions made during the meeting. Mark each with who decided and any conditions.

## Action Items
Numbered list of action items with:
- **What**: Clear description of the task
- **Who**: Person responsible (use name or email)
- **When**: Due date or timeframe if mentioned
- **Priority**: High/Medium/Low based on urgency signals

## Discussion Highlights
Key discussion points, concerns raised, and interesting insights.

## Open Questions
Any unresolved questions or items that need follow-up.

## Next Steps
What was agreed for the next meeting or follow-up.

Rules:
- Be factual — only include information from the provided content
- Use names when speakers are identified
- Flag any unclear or ambiguous items with [UNCLEAR]
- Keep the summary concise but complete
- If the meeting is client-facing, note client sentiment (positive/neutral/negative)',
    '{"provider": "openai", "model": "gpt-4o", "fallback_provider": "anthropic", "fallback_model": "claude-sonnet-4-20250514", "temperature": 0.2, "max_tokens": 2000}'::jsonb,
    'user',
    true,
    true,
    '📝',
    'I can help you create structured summaries from your meeting transcripts and notes. Share a transcript or meeting details to get started.',
    '["Summarize my last meeting", "What were the key decisions from this meeting?", "Extract action items from this transcript", "Create a meeting summary I can share with stakeholders"]'::jsonb,
    NOW(),
    NOW()
  ),

  -- ---------------------------------------------------------------
  -- 2. Action Item Extractor
  -- ---------------------------------------------------------------
  (
    'Action Item Extractor',
    'meeting-action-extractor',
    'meetings',
    'Extracts actionable tasks from meeting transcripts with assignees, due dates, and priority levels. Provides confidence scores for each extraction.',
    'You are an AI assistant specialized in extracting actionable tasks from meeting transcripts and notes. Your goal is to identify every commitments, to-do, follow-up, and deliverable mentioned.

For each action item, provide:
1. **task**: Clear, concise description of what needs to be done
2. **assignee**: Name or email of the person responsible (null if unassigned)
3. **assignee_email**: Email if mentioned (null otherwise)
4. **due_date**: Specific date in YYYY-MM-DD format, or relative timeframe
5. **priority**: "high" | "medium" | "low" based on:
   - High: Explicit urgency, blocking other work, client-facing deadline
   - Medium: Important but not urgent, mentioned as follow-up
   - Low: Nice-to-have, informational, no deadline pressure
6. **confidence**: 0.0 to 1.0 indicating how confident you are this is a real action item
   - 0.9+: Explicitly stated commitment ("I will do X by Friday")
   - 0.7-0.9: Implied commitment ("We should look into X")
   - 0.5-0.7: Possible action item, needs confirmation
   - Below 0.5: Unlikely to be an action item

Return a JSON array of action items. Example:
```json
[
  {
    "task": "Send pricing proposal to TechStart",
    "assignee": "John Smith",
    "assignee_email": "john@company.com",
    "due_date": "2026-01-20",
    "priority": "high",
    "confidence": 0.95
  }
]
```

Rules:
- Only extract genuine commitments, not general discussion
- Prefer specific over vague descriptions
- If a due date is relative ("next week", "by Friday"), calculate from the meeting date
- Group related sub-tasks under the main action item
- Flag dependencies between action items',
    '{"provider": "openai", "model": "gpt-4o", "fallback_provider": "gemini", "fallback_model": "gemini-2.5-pro", "temperature": 0.1, "max_tokens": 1500}'::jsonb,
    'user',
    true,
    false,
    '✅',
    'I extract action items from meeting transcripts with assignees, due dates, and confidence scores. Paste a transcript to get started.',
    '["Extract action items from this transcript", "Who committed to what in this meeting?", "What are the high-priority follow-ups?", "Find all tasks with deadlines from this meeting"]'::jsonb,
    NOW(),
    NOW()
  ),

  -- ---------------------------------------------------------------
  -- 3. Meeting Categorizer
  -- ---------------------------------------------------------------
  (
    'Meeting Categorizer',
    'meeting-categorizer',
    'meetings',
    'Automatically categorizes meetings by type, topic, and related entities. Suggests client/project/deal associations.',
    'You are an AI meeting categorizer for a business management platform. Given meeting details (title, description, participants, transcript excerpt), classify the meeting.

Provide a JSON response with:

```json
{
  "primary_category": "client_engagement | internal | sales | strategic | operational | training",
  "meeting_type": "kickoff | discovery | demo | review | standup | retro | planning | all_hands | 1on1 | workshop | other",
  "confidence": 0.0-1.0,
  "tags": ["tag1", "tag2"],
  "suggested_entities": {
    "clients": [{"name": "...", "confidence": 0.0-1.0, "reasoning": "..."}],
    "projects": [{"name": "...", "confidence": 0.0-1.0, "reasoning": "..."}],
    "deals": [{"name": "...", "confidence": 0.0-1.0, "reasoning": "..."}]
  },
  "sentiment": "positive | neutral | negative | mixed",
  "key_topics": ["topic1", "topic2", "topic3"]
}
```

Category definitions:
- **client_engagement**: Any meeting with external clients (reviews, check-ins, support)
- **internal**: Team meetings without client participation (standups, retros, planning)
- **sales**: Discovery calls, demos, proposal reviews, deal-related meetings
- **strategic**: High-level planning, roadmap, business strategy
- **operational**: Process improvement, tooling, infrastructure
- **training**: Onboarding, skill development, knowledge sharing

Rules:
- A meeting can have one primary_category but multiple tags
- Use participant emails to identify if meeting is client-facing
- Consider meeting title patterns (e.g., "L10" = EOS meeting, "Sprint" = agile)
- Confidence should reflect how certain you are about the classification
- Suggest entity matches only when confidence > 0.5',
    '{"provider": "gemini", "model": "gemini-2.5-flash", "fallback_provider": "openai", "fallback_model": "gpt-4o-mini", "temperature": 0.2, "max_tokens": 1000}'::jsonb,
    'user',
    true,
    true,
    '🏷️',
    'I categorize meetings by type, topic, and related entities. Share meeting details for automatic classification.',
    '["Categorize this meeting", "What type of meeting is this?", "Which client does this meeting relate to?", "Classify all my uncategorized meetings"]'::jsonb,
    NOW(),
    NOW()
  ),

  -- ---------------------------------------------------------------
  -- 4. Meeting Prep Assistant
  -- ---------------------------------------------------------------
  (
    'Meeting Prep Assistant',
    'meeting-prep-assistant',
    'meetings',
    'Prepares comprehensive briefing documents before meetings, pulling context from past meetings, client history, and deal pipeline.',
    'You are a meeting preparation assistant for a professional services company. Before a meeting, you compile relevant context to help the attendee be fully prepared.

Given meeting details and available context (past meetings, client info, deal data, action items), create a prep document:

## Meeting Briefing: [Meeting Title]
**Date/Time**: ...
**Participants**: ...
**Objective**: What this meeting aims to achieve

## Background
- Who the participants are and their roles
- Relationship history (how long, key milestones)
- Any recent relevant events or changes

## Previous Meeting Recap
- Last meeting date and key outcomes
- Outstanding action items from previous meetings
- Commitments that were made and their status

## Key Topics to Address
Prioritized list of items to discuss based on:
- Open action items from last meeting
- Recent client/project developments
- Upcoming deadlines or milestones

## Talking Points
Suggested conversation points and questions to ask.

## Things to Watch For
- Potential concerns or objections
- Opportunities to explore
- Sensitive topics to handle carefully

## Preparation Checklist
- [ ] Review latest metrics/data
- [ ] Prepare any demos or materials
- [ ] Check if any commitments are overdue

Rules:
- Be specific — reference actual names, dates, and figures from the context
- Prioritize the most relevant and actionable information
- Flag any gaps in information that the user should fill before the meeting
- Keep the tone professional but practical',
    '{"provider": "openai", "model": "gpt-4o", "fallback_provider": "anthropic", "fallback_model": "claude-sonnet-4-20250514", "temperature": 0.3, "max_tokens": 2000}'::jsonb,
    'user',
    true,
    true,
    '📋',
    'I help you prepare for meetings by compiling relevant context, past history, and suggested talking points. Tell me about your upcoming meeting.',
    '["Prep me for my next client meeting", "What should I know before meeting with TechStart?", "Create a briefing for the quarterly review", "What action items are pending from the last meeting?"]'::jsonb,
    NOW(),
    NOW()
  ),

  -- ---------------------------------------------------------------
  -- 5. Transcript Analyzer
  -- ---------------------------------------------------------------
  (
    'Transcript Analyzer',
    'meeting-transcript-analyzer',
    'meetings',
    'Performs deep analysis of meeting transcripts: speaker patterns, sentiment tracking, topic modeling, engagement metrics, and risk identification.',
    'You are an expert meeting transcript analyst. You perform deep analysis on meeting transcripts to provide actionable insights beyond basic summarization.

Analyze the transcript and provide:

## Speaker Analysis
For each identified speaker:
- **Talk time**: Approximate percentage of total speaking time
- **Contribution type**: Primarily asking questions / presenting / facilitating / observing
- **Engagement level**: High / Medium / Low
- **Sentiment**: Overall tone (positive, neutral, negative, mixed)

## Conversation Flow
- How the discussion progressed through topics
- Key inflection points where the conversation shifted
- Areas where the conversation stalled or went off-track

## Sentiment Timeline
Track sentiment shifts throughout the meeting:
- Opening mood
- Points where sentiment improved or declined
- Closing mood

## Risk Signals
Flag any concerning patterns:
- Unresolved disagreements
- Scope creep indicators
- Unclear ownership of critical items
- Signs of disengagement from key participants
- Unrealistic commitments or timelines

## Engagement Metrics
- Questions asked vs. answered ratio
- Participation balance (is one person dominating?)
- Decision velocity (how quickly were decisions made?)

## Recommendations
Based on the analysis, suggest:
- Communication improvements
- Process adjustments for future meetings
- Follow-up actions for relationship management

Rules:
- Base all analysis strictly on transcript content
- Use quantitative measures where possible
- Flag speculative assessments clearly
- Consider cultural and contextual nuances in sentiment analysis',
    '{"provider": "anthropic", "model": "claude-sonnet-4-20250514", "fallback_provider": "openai", "fallback_model": "gpt-4o", "temperature": 0.3, "max_tokens": 2500}'::jsonb,
    'user',
    true,
    true,
    '🔍',
    'I perform deep analysis on meeting transcripts — speaker patterns, sentiment tracking, risk signals, and engagement metrics. Share a transcript to analyze.',
    '["Analyze this transcript for engagement patterns", "What are the risk signals in this meeting?", "How balanced was the participation?", "Track sentiment changes through this meeting"]'::jsonb,
    NOW(),
    NOW()
  ),

  -- ---------------------------------------------------------------
  -- 6. Follow-Up Email Generator
  -- ---------------------------------------------------------------
  (
    'Meeting Follow-Up Generator',
    'meeting-followup-generator',
    'meetings',
    'Drafts professional follow-up emails after meetings, summarizing key points, action items, and next steps for all participants.',
    'You are a professional email writer specializing in meeting follow-ups. Based on meeting context (summary, action items, participants, decisions), draft a follow-up email.

Generate the email with:

**Subject line**: Concise, descriptive (under 60 chars)
**Tone**: Professional but warm. Match formality to the meeting type:
- Client meetings: More formal, appreciative
- Internal meetings: Direct, casual-professional
- Sales meetings: Energetic, forward-looking

**Structure**:
1. **Opening**: Thank participants, reference meeting date/topic (1-2 sentences)
2. **Summary**: Brief recap of key discussion points (2-3 bullets)
3. **Decisions Made**: Any decisions that were agreed upon
4. **Action Items**: Clear table or list with:
   - Task description
   - Owner
   - Due date
5. **Next Steps**: What happens next, when the next meeting is
6. **Closing**: Appropriate sign-off

Rules:
- Keep emails under 300 words for maximum readability
- Use bullet points and bold for scanability
- Include specific names for action item ownership
- If this is a client meeting, be extra careful with tone and professionalism
- Never include internal-only information in client-facing follow-ups
- Offer to answer questions or clarify any points
- If there is a next meeting scheduled, confirm the date/time',
    '{"provider": "openai", "model": "gpt-4o", "fallback_provider": "anthropic", "fallback_model": "claude-sonnet-4-20250514", "temperature": 0.6, "max_tokens": 1000}'::jsonb,
    'user',
    true,
    true,
    '✉️',
    'I draft professional follow-up emails after your meetings, including summaries, action items, and next steps. Tell me about the meeting.',
    '["Draft a follow-up email for my last client meeting", "Write a meeting recap email for the team", "Create a follow-up for the TechStart proposal review", "Send a thank-you email after the discovery call"]'::jsonb,
    NOW(),
    NOW()
  ),

  -- ---------------------------------------------------------------
  -- 7. Meeting Efficiency Coach
  -- ---------------------------------------------------------------
  (
    'Meeting Efficiency Coach',
    'meeting-efficiency-coach',
    'meetings',
    'Analyzes meeting patterns and provides data-driven recommendations to improve meeting effectiveness, reduce unnecessary meetings, and optimize schedules.',
    'You are a meeting efficiency consultant with expertise in organizational productivity. Analyze meeting data and provide actionable recommendations.

When given meeting data (schedules, durations, types, outcomes, efficiency scores), evaluate:

## Meeting Health Score
Overall score (0-100) based on:
- **Time efficiency**: Actual vs. scheduled duration, agenda completion rate
- **Decision velocity**: Decisions made per meeting hour
- **Action completion**: % of action items completed before next meeting
- **Participant engagement**: Attendance rate, participation balance
- **Meeting necessity**: Could this have been an email or async?

## Pattern Analysis
- Most common meeting types and their effectiveness
- Day/time patterns (are Monday meetings more productive than Friday?)
- Duration optimization (are 60-min meetings completing in 40 min?)
- Series health (are recurring meetings still valuable?)

## Improvement Recommendations
Prioritized list of specific, actionable changes:
1. Meetings to eliminate or make async
2. Duration adjustments (e.g., "30-min standup → 15-min")
3. Schedule optimization (best days/times)
4. Agenda improvements
5. Participant list optimization

## Meeting Cost Analysis
If team size/costs are available:
- Estimated hourly meeting cost
- Monthly meeting time investment
- Potential time savings from recommendations

## Quick Wins
3-5 changes that can be implemented immediately.

Rules:
- Base recommendations on data, not opinions
- Consider team dynamics and company culture
- Distinguish between meetings that need improvement vs. elimination
- Provide specific metrics and targets for each recommendation
- Acknowledge that some "inefficient" meetings serve important cultural purposes',
    '{"provider": "openai", "model": "gpt-4o", "fallback_provider": "gemini", "fallback_model": "gemini-2.5-pro", "temperature": 0.4, "max_tokens": 2000}'::jsonb,
    'user',
    true,
    true,
    '📊',
    'I analyze your meeting patterns and provide data-driven recommendations to improve effectiveness. Share your meeting data or ask about specific areas.',
    '["How efficient are my meetings?", "Which meetings should I eliminate?", "How can I optimize my meeting schedule?", "What is the ROI of my recurring meetings?"]'::jsonb,
    NOW(),
    NOW()
  ),

  -- ---------------------------------------------------------------
  -- 8. Client-Meeting Matcher
  -- ---------------------------------------------------------------
  (
    'Client-Meeting Matcher',
    'meeting-client-matcher',
    'meetings',
    'Intelligently matches unassigned meetings to clients, deals, and projects using participant data, meeting content, and historical patterns.',
    'You are an AI system that matches meetings to the correct business entities (clients, deals, projects). Given meeting details and a list of available entities, determine the best matches.

For each potential match, provide:

```json
{
  "matches": [
    {
      "entity_type": "client | deal | project",
      "entity_id": "...",
      "entity_name": "...",
      "confidence": 0.0-1.0,
      "reasoning": "Why this match was identified",
      "evidence": ["Signal 1", "Signal 2"]
    }
  ]
}
```

Matching signals (in order of reliability):
1. **Email domain match** (0.9+): Participant email matches client domain
2. **Name match in title** (0.85+): Client/company name appears in meeting title
3. **Contact match** (0.8+): Known contact is a participant
4. **Historical pattern** (0.7+): Same organizer + time pattern as previous client meetings
5. **Content analysis** (0.6+): Meeting description or transcript mentions client-related terms
6. **Deal stage match** (0.5+): Meeting type aligns with deal stage (discovery call + lead deal)

Confidence thresholds:
- **Auto-assign** (≥0.80): High confidence, can be auto-applied
- **Suggest for review** (0.50-0.79): Needs human confirmation
- **Skip** (<0.50): Too uncertain to suggest

Rules:
- A meeting can match multiple entities (e.g., a client AND a deal)
- Prefer the most specific entity (deal > project > client)
- Consider the meeting type when matching (discovery calls → deals, reviews → projects)
- Always explain your reasoning
- If no match exceeds 0.50 confidence, return an empty array',
    '{"provider": "gemini", "model": "gemini-2.5-flash", "fallback_provider": "openai", "fallback_model": "gpt-4o-mini", "temperature": 0.1, "max_tokens": 1200}'::jsonb,
    'user',
    true,
    true,
    '🔗',
    'I match unassigned meetings to the right clients, deals, and projects. Share meeting details or ask me to process unmatched meetings.',
    '["Match this meeting to a client", "Which client does this meeting belong to?", "Process all unassigned meetings", "Review pending meeting assignments"]'::jsonb,
    NOW(),
    NOW()
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  system_prompt = EXCLUDED.system_prompt,
  provider_config = EXCLUDED.provider_config,
  avatar = EXCLUDED.avatar,
  welcome_message = EXCLUDED.welcome_message,
  conversation_starters = EXCLUDED.conversation_starters,
  updated_at = NOW();


-- 20260215_meetings_v2_standalone.sql
-- ============================================================================
-- Meetings Module V2 Standalone Implementation
-- ============================================================================
-- Creates meetings_v2 table and supporting tables as specified in the
-- standalone implementation plan. This is a complete, self-contained schema.
-- ============================================================================

-- ========================
-- Enums
-- ========================
CREATE TYPE meeting_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');
CREATE TYPE meeting_type AS ENUM ('internal', 'client', 'project', 'l10', 'one_on_one');

-- ========================
-- Table: meetings_v2
-- ========================
CREATE TABLE IF NOT EXISTS meetings_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  type meeting_type NOT NULL DEFAULT 'internal',
  description TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  location TEXT,
  timezone TEXT DEFAULT 'UTC',
  status meeting_status NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  notify_participants BOOLEAN DEFAULT false,
  -- Recurrence
  recurrence_pattern TEXT,          -- 'daily', 'weekly', 'biweekly', 'monthly', 'none'
  recurrence_interval INTEGER DEFAULT 1,
  recurrence_days_of_week INTEGER[],
  recurrence_day_of_month INTEGER,
  recurrence_end_date DATE,
  parent_meeting_id UUID REFERENCES meetings_v2(id),
  -- Relationships
  client_id UUID,                   -- FK to clients
  project_id UUID,                  -- FK to projects
  deal_id UUID,                     -- FK to deals
  -- Content
  recording_url TEXT,
  transcript_content JSONB,
  transcript_text TEXT,
  ai_summary JSONB,
  categorization_confidence NUMERIC,
  is_categorized BOOLEAN DEFAULT false,
  -- Metadata
  slug TEXT UNIQUE,
  created_by UUID,                  -- FK to auth.users
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================
-- Table: meeting_participants_v2
-- ========================
CREATE TABLE IF NOT EXISTS meeting_participants_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings_v2(id) ON DELETE CASCADE,
  user_id UUID,                     -- FK to profiles (NULL for external)
  external_email TEXT,              -- For non-system participants
  external_name TEXT,
  role TEXT NOT NULL DEFAULT 'required',  -- 'organizer', 'required', 'optional'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'declined', 'tentative'
  attended BOOLEAN DEFAULT false,
  notes TEXT,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Table: meeting_agenda_items
-- ========================
CREATE TABLE IF NOT EXISTS meeting_agenda_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings_v2(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_completed BOOLEAN DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Table: meeting_takeaways
-- ========================
CREATE TABLE IF NOT EXISTS meeting_takeaways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings_v2(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  assigned_to UUID,
  due_date DATE,
  status TEXT DEFAULT 'open',      -- 'open', 'in_progress', 'completed'
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Table: meeting_categorizations
-- ========================
CREATE TABLE IF NOT EXISTS meeting_categorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_file_id UUID REFERENCES meeting_files(id),
  category TEXT,
  confidence NUMERIC,
  is_verified BOOLEAN DEFAULT false,
  verified_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========================
-- Indexes
-- ========================
CREATE INDEX IF NOT EXISTS idx_meetings_v2_slug ON meetings_v2(slug);
CREATE INDEX IF NOT EXISTS idx_meetings_v2_scheduled ON meetings_v2(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_meetings_v2_status ON meetings_v2(status);
CREATE INDEX IF NOT EXISTS idx_meetings_v2_type ON meetings_v2(type);
CREATE INDEX IF NOT EXISTS idx_meetings_v2_client ON meetings_v2(client_id);
CREATE INDEX IF NOT EXISTS idx_meetings_v2_project ON meetings_v2(project_id);
CREATE INDEX IF NOT EXISTS idx_meetings_v2_created_by ON meetings_v2(created_by);
CREATE INDEX IF NOT EXISTS idx_meetings_v2_parent ON meetings_v2(parent_meeting_id);

CREATE INDEX IF NOT EXISTS idx_participants_v2_meeting ON meeting_participants_v2(meeting_id);
CREATE INDEX IF NOT EXISTS idx_participants_v2_user ON meeting_participants_v2(user_id);

-- Add attended column if it doesn't exist (for existing installations)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'meeting_participants_v2' AND column_name = 'attended'
  ) THEN
    ALTER TABLE meeting_participants_v2 ADD COLUMN attended BOOLEAN DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_agenda_items_meeting ON meeting_agenda_items(meeting_id);
CREATE INDEX IF NOT EXISTS idx_agenda_items_order ON meeting_agenda_items(meeting_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_takeaways_meeting ON meeting_takeaways(meeting_id);
CREATE INDEX IF NOT EXISTS idx_takeaways_assigned ON meeting_takeaways(assigned_to);

CREATE INDEX IF NOT EXISTS idx_categorizations_file ON meeting_categorizations(meeting_file_id);

-- ========================
-- RLS Policies
-- ========================
ALTER TABLE meetings_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all meetings" ON meetings_v2
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can create meetings" ON meetings_v2
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own meetings" ON meetings_v2
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete own meetings" ON meetings_v2
  FOR DELETE USING (auth.uid() = created_by);

ALTER TABLE meeting_participants_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all participants" ON meeting_participants_v2
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage participants" ON meeting_participants_v2
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

ALTER TABLE meeting_agenda_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all agenda items" ON meeting_agenda_items
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage agenda items" ON meeting_agenda_items
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

ALTER TABLE meeting_takeaways ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all takeaways" ON meeting_takeaways
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage takeaways" ON meeting_takeaways
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

ALTER TABLE meeting_categorizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all categorizations" ON meeting_categorizations
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage categorizations" ON meeting_categorizations
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- ========================
-- Update meeting_files table (add missing columns if needed)
-- ========================
DO $$
BEGIN
  -- Add columns to meeting_files if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'slug') THEN
    ALTER TABLE meeting_files ADD COLUMN slug TEXT UNIQUE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'zoom_meeting_id') THEN
    ALTER TABLE meeting_files ADD COLUMN zoom_meeting_id BIGINT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'zoom_meeting_uuid') THEN
    ALTER TABLE meeting_files ADD COLUMN zoom_meeting_uuid TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'meeting_topic') THEN
    ALTER TABLE meeting_files ADD COLUMN meeting_topic TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'meeting_start_time') THEN
    ALTER TABLE meeting_files ADD COLUMN meeting_start_time TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'host_email') THEN
    ALTER TABLE meeting_files ADD COLUMN host_email TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'host_name') THEN
    ALTER TABLE meeting_files ADD COLUMN host_name TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'participants_count') THEN
    ALTER TABLE meeting_files ADD COLUMN participants_count INTEGER;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'duration_minutes') THEN
    ALTER TABLE meeting_files ADD COLUMN duration_minutes INTEGER;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'meeting_category') THEN
    ALTER TABLE meeting_files ADD COLUMN meeting_category TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'categorization_status') THEN
    ALTER TABLE meeting_files ADD COLUMN categorization_status TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'categorization_confidence') THEN
    ALTER TABLE meeting_files ADD COLUMN categorization_confidence NUMERIC;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'categorized_at') THEN
    ALTER TABLE meeting_files ADD COLUMN categorized_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'transcript_summary') THEN
    ALTER TABLE meeting_files ADD COLUMN transcript_summary TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'summary_overview') THEN
    ALTER TABLE meeting_files ADD COLUMN summary_overview TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'next_steps') THEN
    ALTER TABLE meeting_files ADD COLUMN next_steps TEXT[];
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'ai_processing_status') THEN
    ALTER TABLE meeting_files ADD COLUMN ai_processing_status TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'ai_suggestions') THEN
    ALTER TABLE meeting_files ADD COLUMN ai_suggestions JSONB;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'processing_error') THEN
    ALTER TABLE meeting_files ADD COLUMN processing_error TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'last_processed_at') THEN
    ALTER TABLE meeting_files ADD COLUMN last_processed_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'project_id') THEN
    ALTER TABLE meeting_files ADD COLUMN project_id UUID;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'project_name') THEN
    ALTER TABLE meeting_files ADD COLUMN project_name TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'project_manager') THEN
    ALTER TABLE meeting_files ADD COLUMN project_manager TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'client_name') THEN
    ALTER TABLE meeting_files ADD COLUMN client_name TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'client_id') THEN
    ALTER TABLE meeting_files ADD COLUMN client_id UUID;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'project_match_confidence') THEN
    ALTER TABLE meeting_files ADD COLUMN project_match_confidence NUMERIC;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'assignment_status') THEN
    ALTER TABLE meeting_files ADD COLUMN assignment_status TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'assignment_confidence') THEN
    ALTER TABLE meeting_files ADD COLUMN assignment_confidence NUMERIC;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'suggested_client_id') THEN
    ALTER TABLE meeting_files ADD COLUMN suggested_client_id UUID;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'suggested_project_id') THEN
    ALTER TABLE meeting_files ADD COLUMN suggested_project_id UUID;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'assignment_reasoning') THEN
    ALTER TABLE meeting_files ADD COLUMN assignment_reasoning TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'reviewed_by') THEN
    ALTER TABLE meeting_files ADD COLUMN reviewed_by UUID;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'reviewed_at') THEN
    ALTER TABLE meeting_files ADD COLUMN reviewed_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'embedding_status') THEN
    ALTER TABLE meeting_files ADD COLUMN embedding_status TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'embedding_generated_at') THEN
    ALTER TABLE meeting_files ADD COLUMN embedding_generated_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'embedding_chunks_count') THEN
    ALTER TABLE meeting_files ADD COLUMN embedding_chunks_count INTEGER;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'meeting_id_v2') THEN
    ALTER TABLE meeting_files ADD COLUMN meeting_id_v2 UUID REFERENCES meetings_v2(id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'meeting_type') THEN
    ALTER TABLE meeting_files ADD COLUMN meeting_type TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'zoom_account_name') THEN
    ALTER TABLE meeting_files ADD COLUMN zoom_account_name TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'zoom_account_id') THEN
    ALTER TABLE meeting_files ADD COLUMN zoom_account_id TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meeting_files' AND column_name = 'deleted_at') THEN
    ALTER TABLE meeting_files ADD COLUMN deleted_at TIMESTAMPTZ;
  END IF;
END $$;

-- Add indexes for meeting_files new columns
CREATE INDEX IF NOT EXISTS idx_meeting_files_slug ON meeting_files(slug);
CREATE INDEX IF NOT EXISTS idx_meeting_files_zoom_meeting_id ON meeting_files(zoom_meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_files_meeting_id_v2 ON meeting_files(meeting_id_v2);
CREATE INDEX IF NOT EXISTS idx_meeting_files_category ON meeting_files(meeting_category);
CREATE INDEX IF NOT EXISTS idx_meeting_files_categorization_status ON meeting_files(categorization_status);
CREATE INDEX IF NOT EXISTS idx_meeting_files_assignment_status ON meeting_files(assignment_status);
CREATE INDEX IF NOT EXISTS idx_meeting_files_embedding_status ON meeting_files(embedding_status);

-- Ensure meeting_files RLS allows authenticated users to read all
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'meeting_files' 
    AND policyname = 'Users can read all transcripts'
  ) THEN
    ALTER TABLE meeting_files ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Users can read all transcripts" ON meeting_files
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
END $$;



-- 20260216114709_9470ab13-0ee0-4d61-8ead-551910e96c07.sql
ALTER TABLE public.sendgrid_config ADD COLUMN IF NOT EXISTS api_key TEXT;

-- 20260216115418_ab283c64-6f78-42fa-ba02-77f2d6857b8a.sql
UPDATE public.sendgrid_config SET is_enabled = true WHERE id = '37fc656d-d24f-467d-9d6f-4f129797bf0d';

-- 20260216120000_sendgrid_admin_integration.sql
-- ============================================================================
-- SendGrid Admin Integration
-- integrations table for status tracking, sendgrid_config cleanup (no API key in DB)
-- ============================================================================

-- Simple integrations table for status (slug, name, status, last_sync)
-- Used by dedicated SendGrid admin page - not the generic Integration Hub
CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'disconnected'
    CHECK (status IN ('connected', 'disconnected', 'error')),
  last_sync TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integrations_slug ON integrations(slug);

CREATE TRIGGER set_integrations_updated_at
  BEFORE UPDATE ON integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view integrations"
  ON integrations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage integrations"
  ON integrations FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed SendGrid integration row
INSERT INTO integrations (slug, name, status)
VALUES ('sendgrid', 'SendGrid', 'disconnected')
ON CONFLICT (slug) DO NOTHING;

-- API key: support UI submission for now (optional; also supports Supabase secrets)
-- Remove old encrypted column if present, add plain api_key for UI
ALTER TABLE sendgrid_config DROP COLUMN IF EXISTS api_key_encrypted;
ALTER TABLE sendgrid_config ADD COLUMN IF NOT EXISTS api_key TEXT;

-- Update get_or_create_sendgrid_config
CREATE OR REPLACE FUNCTION get_or_create_sendgrid_config()
RETURNS sendgrid_config AS $$
DECLARE config sendgrid_config;
BEGIN
  SELECT * INTO config FROM sendgrid_config LIMIT 1;
  IF config IS NULL THEN
    INSERT INTO sendgrid_config (from_email, from_name, is_enabled, webhook_url, webhook_secret, enable_open_tracking, enable_click_tracking)
    VALUES ('noreply@sjinnovation.com', 'SJ Innovation', false, NULL, NULL, true, true)
    RETURNING * INTO config;
  END IF;
  RETURN config;
END;
$$ LANGUAGE plpgsql;


-- 20260216140000_feedback_community_view.sql
-- Migration: Allow all authenticated users to view all feedback (community view)
-- Also adds module, priority, and assigned_to columns for admin controls

-- Step 1: Drop existing SELECT policies
DROP POLICY IF EXISTS "Users can view their own feedback" ON public.feedback;
DROP POLICY IF EXISTS "Admins can view all feedback" ON public.feedback;

-- Step 2: Create new unified SELECT policy for all authenticated users
CREATE POLICY "All authenticated users can view feedback"
  ON public.feedback FOR SELECT
  TO authenticated
  USING (true);

-- Step 3: Add new columns for admin controls and detail page
ALTER TABLE public.feedback
  ADD COLUMN IF NOT EXISTS module text,
  ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id);

-- Step 4: Index new columns
CREATE INDEX IF NOT EXISTS idx_feedback_module ON public.feedback(module);
CREATE INDEX IF NOT EXISTS idx_feedback_priority ON public.feedback(priority);
CREATE INDEX IF NOT EXISTS idx_feedback_assigned_to ON public.feedback(assigned_to);


-- 20260217_admin_eos_scorecards.sql
-- ============================================================================
-- Admin EOS Scorecards — RLS, pod linkage, triggers
-- ============================================================================
-- Implements admin-only management for scorecards per implementation plan.
-- - Admin-only INSERT/UPDATE/DELETE on scorecards and scorecard_metrics
-- - Add pod_id to eos_scorecards for template–pod linkage
-- - Add updated_at triggers
-- ============================================================================

-- Add pod_id to eos_scorecards (optional template–pod linkage)
ALTER TABLE eos_scorecards
  ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES eos_pods(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_eos_scorecards_pod_id ON eos_scorecards(pod_id);

-- Triggers for updated_at (uses update_updated_at_column from earlier migrations)
DROP TRIGGER IF EXISTS update_eos_scorecards_updated_at ON eos_scorecards;
CREATE TRIGGER update_eos_scorecards_updated_at
  BEFORE UPDATE ON eos_scorecards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_eos_scorecard_metrics_updated_at ON eos_scorecard_metrics;
CREATE TRIGGER update_eos_scorecard_metrics_updated_at
  BEFORE UPDATE ON eos_scorecard_metrics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- RLS: Admin-only management for scorecards
-- ============================================================================

-- Drop permissive "authenticated can manage" policies
DROP POLICY IF EXISTS "Authenticated users can manage scorecards" ON eos_scorecards;
DROP POLICY IF EXISTS "Authenticated users can manage metrics" ON eos_scorecard_metrics;

-- Scorecards: SELECT for authenticated; INSERT/UPDATE/DELETE for admins only
CREATE POLICY "Admins can manage scorecards"
  ON eos_scorecards
  FOR ALL
  TO authenticated
  USING (
    (auth.uid() IS NOT NULL)
    AND (
      -- SELECT: any authenticated user
      (TG_OP IS NULL OR current_setting('request.jwt.claim.role', true) IS NOT NULL)
      OR public.is_admin()
    )
  )
  WITH CHECK (public.is_admin());

-- Simpler approach: separate SELECT (authenticated) from INSERT/UPDATE/DELETE (admin)
-- Re-create: SELECT for authenticated (keep existing)
-- The existing "Authenticated users can view scorecards" handles SELECT.
-- We only need to replace the "manage" with admin-only for INSERT/UPDATE/DELETE.

-- Drop the complex policy we just created and do it properly:
DROP POLICY IF EXISTS "Admins can manage scorecards" ON eos_scorecards;

CREATE POLICY "Admins can insert scorecards"
  ON eos_scorecards FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update scorecards"
  ON eos_scorecards FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete scorecards"
  ON eos_scorecards FOR DELETE TO authenticated
  USING (public.is_admin());

-- Scorecard metrics: SELECT for authenticated; INSERT/UPDATE/DELETE for admins
CREATE POLICY "Admins can insert scorecard metrics"
  ON eos_scorecard_metrics FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update scorecard metrics"
  ON eos_scorecard_metrics FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete scorecard metrics"
  ON eos_scorecard_metrics FOR DELETE TO authenticated
  USING (public.is_admin());


-- 20260217_eos_scorecard_metrics_notes.sql
-- Add notes column to eos_scorecard_metrics for pod/role/commentary (JSON string)
ALTER TABLE eos_scorecard_metrics
  ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN eos_scorecard_metrics.notes IS 'JSON string: { podId?, role?, commentary? }';


-- 20260217_eos_sla_targets.sql
-- ============================================================================
-- EOS SLA Targets — Approval rate and cycle time targets by pod/role
-- ============================================================================
-- Used by Admin EOS Accountability: SLA targets configuration and analytics.
-- One fallback row (pod_id and role_name both null); per-pod and per-role rows.
-- ============================================================================

CREATE TABLE IF NOT EXISTS eos_sla_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id UUID REFERENCES eos_pods(id) ON DELETE CASCADE,
  role_name TEXT,
  approval_rate_pct NUMERIC(5,2) NOT NULL DEFAULT 90 CHECK (approval_rate_pct >= 0 AND approval_rate_pct <= 100),
  cycle_time_days NUMERIC(5,2) NOT NULL DEFAULT 5 CHECK (cycle_time_days >= 0),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT eos_sla_targets_pod_or_role_or_fallback CHECK (
    (pod_id IS NOT NULL AND role_name IS NULL) OR
    (pod_id IS NULL AND role_name IS NOT NULL) OR
    (pod_id IS NULL AND role_name IS NULL)
  )
);

-- One fallback (null,null), one row per pod (pod_id, null), one per role (null, role_name)
CREATE UNIQUE INDEX IF NOT EXISTS idx_eos_sla_targets_entity_unique
  ON eos_sla_targets (pod_id, role_name) NULLS NOT DISTINCT;

CREATE INDEX IF NOT EXISTS idx_eos_sla_targets_pod ON eos_sla_targets (pod_id);
CREATE INDEX IF NOT EXISTS idx_eos_sla_targets_role ON eos_sla_targets (role_name);

ALTER TABLE eos_sla_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view SLA targets" ON eos_sla_targets
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage SLA targets" ON eos_sla_targets
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed single fallback row if none exists
INSERT INTO eos_sla_targets (pod_id, role_name, approval_rate_pct, cycle_time_days)
SELECT NULL, NULL, 90, 5
WHERE NOT EXISTS (SELECT 1 FROM eos_sla_targets WHERE pod_id IS NULL AND role_name IS NULL);


-- 20260218000000_pods_add_color.sql
-- Add color to pods for POD Management UI (Create/Edit POD)
ALTER TABLE public.pods
ADD COLUMN IF NOT EXISTS color TEXT;

COMMENT ON COLUMN public.pods.color IS 'Hex or preset color key for POD display (e.g. #3b82f6 or blue)';


-- 20260218000000_prompt_templates.sql
-- ============================================================================
-- Create Prompt Templates Table (AI Hub - Admin)
-- ============================================================================
-- Reusable AI prompt templates with placeholders (e.g. {{recipient_name}}).
-- Used for email generation, deal coaching, and other AI agent prompts.
-- ============================================================================

CREATE TABLE IF NOT EXISTS prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'General Purpose',
  template_content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prompt_templates_slug ON prompt_templates(slug);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_category ON prompt_templates(category);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_active ON prompt_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_usage ON prompt_templates(usage_count DESC);

ALTER TABLE prompt_templates ENABLE ROW LEVEL SECURITY;

-- Admin / authenticated users can manage (restrict to admin in app or add role check)
CREATE POLICY "Authenticated users can view prompt templates"
  ON prompt_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert prompt templates"
  ON prompt_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update prompt templates"
  ON prompt_templates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete prompt templates"
  ON prompt_templates FOR DELETE TO authenticated USING (true);

-- Seed example templates
INSERT INTO prompt_templates (name, slug, description, category, template_content, is_active) VALUES
  (
    'Professional Email',
    'professional-email',
    'Standard professional email template.',
    'Email Generation',
    'Write a professional email to {{recipient_name}} about {{topic}}. Keep the tone {{tone}} and length {{length}}.',
    true
  ),
  (
    'Follow-up Email',
    'follow-up-email',
    'Follow-up after initial contact.',
    'Email Generation',
    'Draft a brief follow-up email to {{recipient_name}} regarding {{subject}}. Be polite and include a clear next step.',
    true
  ),
  (
    'Meeting Summary',
    'meeting-summary',
    'Summarize meeting notes into bullet points.',
    'General Purpose',
    'Summarize the following meeting notes into clear bullet points. Include: attendees, decisions, and action items.',
    true
  ),
  (
    'Deal Update',
    'deal-update',
    'Structured update for deal progress.',
    'General Purpose',
    'Write a concise deal update for {{deal_name}}. Include: current stage, next steps, and any blockers.',
    true
  )
ON CONFLICT (slug) DO NOTHING;


-- 20260218120000_ai_agent_categories.sql
-- AI Agent Categories: organize AI agents into named categories (slug links to ai_agents.category)
CREATE TABLE IF NOT EXISTS public.ai_agent_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_agent_categories_slug ON public.ai_agent_categories(slug);
CREATE INDEX idx_ai_agent_categories_is_active ON public.ai_agent_categories(is_active);

ALTER TABLE public.ai_agent_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage ai_agent_categories"
  ON public.ai_agent_categories FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_ai_agent_categories_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER ai_agent_categories_updated_at
  BEFORE UPDATE ON public.ai_agent_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_ai_agent_categories_updated_at();

-- Seed from distinct ai_agents.category values (slug: lowercase, spaces/special to underscore)
INSERT INTO public.ai_agent_categories (name, slug, description, is_active)
SELECT sub.name, sub.slug, NULL, true
FROM (
  SELECT
    TRIM(cat) AS name,
    LOWER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(cat), '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '_', 'g')) AS slug
  FROM (
    SELECT DISTINCT category AS cat
    FROM public.ai_agents
    WHERE category IS NOT NULL AND TRIM(category) <> ''
  ) d
) sub
WHERE sub.slug <> ''
ON CONFLICT (slug) DO NOTHING;

-- If no categories from agents, insert a default so the page has something
INSERT INTO public.ai_agent_categories (name, slug, description, is_active)
VALUES ('General', 'general', 'General purpose agents', true)
ON CONFLICT (slug) DO NOTHING;


-- 20260218122031_7f91b1f5-ac31-4791-9f36-9fe9546f5c55.sql

CREATE TABLE public.ai_agent_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  icon VARCHAR(100) DEFAULT 'FolderOpen',
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.ai_agent_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read categories"
  ON public.ai_agent_categories FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert categories"
  ON public.ai_agent_categories FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update categories"
  ON public.ai_agent_categories FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete categories"
  ON public.ai_agent_categories FOR DELETE
  USING (auth.role() = 'authenticated');

CREATE TRIGGER update_ai_agent_categories_updated_at
  BEFORE UPDATE ON public.ai_agent_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


-- 20260218130000_ai_agent_categories_icon_display_order.sql
-- Add icon and display_order to ai_agent_categories (Create New Category modal)
ALTER TABLE public.ai_agent_categories
  ADD COLUMN IF NOT EXISTS icon TEXT,
  ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_ai_agent_categories_display_order
  ON public.ai_agent_categories(display_order);


-- 20260218133215_77373985-b978-4349-b1e9-7f2367deed9a.sql

CREATE TABLE public.prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  category VARCHAR(100) NOT NULL DEFAULT 'general',
  template_content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.prompt_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select prompt templates"
  ON public.prompt_templates FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert prompt templates"
  ON public.prompt_templates FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update prompt templates"
  ON public.prompt_templates FOR UPDATE TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete prompt templates"
  ON public.prompt_templates FOR DELETE TO authenticated
  USING (auth.role() = 'authenticated');

CREATE TRIGGER update_prompt_templates_updated_at
  BEFORE UPDATE ON public.prompt_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


-- 20260219000000_pod_management_complete.sql
-- ============================================================================
-- Pod Management -- Complete Implementation
-- ============================================================================
-- Creates comprehensive pod management system with HR sync, Resource Projection,
-- module permissions, and health tracking capabilities.
-- ============================================================================

-- ========================
-- 1. Update pods table
-- ========================
-- Add missing columns to existing pods table
ALTER TABLE IF EXISTS pods
  ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#3b82f6',
  ADD COLUMN IF NOT EXISTS show_in_resource_projection BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- ========================
-- 2. pod_employees table
-- ========================
-- Members with login/profile info (used for Resource Projection and module access)
CREATE TABLE IF NOT EXISTS pod_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id UUID NOT NULL REFERENCES pods(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  employee_id UUID, -- FK to Employee table (if exists) or employee_profiles
  has_login BOOLEAN DEFAULT false,
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'synced')),
  is_active BOOLEAN DEFAULT true,
  role TEXT CHECK (role IN ('manager', 'member')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (pod_id, employee_id),
  UNIQUE (pod_id, user_id)
);

-- Indexes for pod_employees
CREATE INDEX IF NOT EXISTS idx_pod_employees_pod_id ON pod_employees(pod_id);
CREATE INDEX IF NOT EXISTS idx_pod_employees_user_id ON pod_employees(user_id);
CREATE INDEX IF NOT EXISTS idx_pod_employees_employee_id ON pod_employees(employee_id);
CREATE INDEX IF NOT EXISTS idx_pod_employees_is_active ON pod_employees(is_active);

-- ========================
-- 3. employee_pods table
-- ========================
-- HR-synced pod membership (read-only from HR system)
CREATE TABLE IF NOT EXISTS employee_pods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL, -- FK to Employee or employee_profiles
  pod_id UUID NOT NULL REFERENCES pods(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  synced_from_hr BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (pod_id, employee_id)
);

-- Indexes for employee_pods
CREATE INDEX IF NOT EXISTS idx_employee_pods_pod_id ON employee_pods(pod_id);
CREATE INDEX IF NOT EXISTS idx_employee_pods_employee_id ON employee_pods(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_pods_synced_from_hr ON employee_pods(synced_from_hr);

-- ========================
-- 4. pod_permissions table
-- ========================
-- Module access per pod
CREATE TABLE IF NOT EXISTS pod_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id UUID NOT NULL REFERENCES pods(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES app_modules(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (pod_id, module_id)
);

-- Indexes for pod_permissions
CREATE INDEX IF NOT EXISTS idx_pod_permissions_pod_id ON pod_permissions(pod_id);
CREATE INDEX IF NOT EXISTS idx_pod_permissions_module_id ON pod_permissions(module_id);

-- ========================
-- 5. Update app_modules if needed
-- ========================
-- Ensure app_modules has page_route column for pod permissions
ALTER TABLE IF EXISTS app_modules
  ADD COLUMN IF NOT EXISTS page_route TEXT;

-- ========================
-- 6. RLS Policies
-- ========================

-- Enable RLS on all tables
ALTER TABLE pods ENABLE ROW LEVEL SECURITY;
ALTER TABLE pod_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_pods ENABLE ROW LEVEL SECURITY;
ALTER TABLE pod_permissions ENABLE ROW LEVEL SECURITY;

-- Pods policies
DROP POLICY IF EXISTS "Admins can manage pods" ON pods;
CREATE POLICY "Admins can manage pods"
  ON pods FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can view active pods" ON pods;
CREATE POLICY "Users can view active pods"
  ON pods FOR SELECT
  USING (is_active = true);

-- pod_employees policies
DROP POLICY IF EXISTS "Admins can manage pod_employees" ON pod_employees;
CREATE POLICY "Admins can manage pod_employees"
  ON pod_employees FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can view own pod membership" ON pod_employees;
CREATE POLICY "Users can view own pod membership"
  ON pod_employees FOR SELECT
  USING (user_id = auth.uid() OR user_id IS NULL);

-- employee_pods policies (read-only for non-admins)
DROP POLICY IF EXISTS "Admins can manage employee_pods" ON employee_pods;
CREATE POLICY "Admins can manage employee_pods"
  ON employee_pods FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can view employee_pods" ON employee_pods;
CREATE POLICY "Users can view employee_pods"
  ON employee_pods FOR SELECT
  USING (true);

-- pod_permissions policies
DROP POLICY IF EXISTS "Admins can manage pod_permissions" ON pod_permissions;
CREATE POLICY "Admins can manage pod_permissions"
  ON pod_permissions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can view pod_permissions" ON pod_permissions;
CREATE POLICY "Users can view pod_permissions"
  ON pod_permissions FOR SELECT
  USING (true);

-- ========================
-- 7. Sync Function
-- ========================
-- Copies HR-synced members from employee_pods into pod_employees
-- Resolves user_id via email matching against profiles table
CREATE OR REPLACE FUNCTION sync_pod_employees_from_hr()
RETURNS TABLE (
  pod_id UUID,
  employees_synced INTEGER,
  employees_with_login INTEGER,
  employees_without_login INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pod RECORD;
  v_employee RECORD;
  v_user_id UUID;
  v_synced_count INTEGER;
  v_with_login_count INTEGER;
  v_without_login_count INTEGER;
BEGIN
  -- Loop through each pod
  FOR v_pod IN SELECT id FROM pods WHERE is_active = true
  LOOP
    v_synced_count := 0;
    v_with_login_count := 0;
    v_without_login_count := 0;

    -- Get all HR-synced employees for this pod
    FOR v_employee IN
      SELECT DISTINCT ep.employee_id, ep.pod_id
      FROM employee_pods ep
      WHERE ep.pod_id = v_pod.id
        AND ep.synced_from_hr = true
    LOOP
      -- Try to find matching user_id via email
      -- First try employee_profiles
      SELECT user_id INTO v_user_id
      FROM employee_profiles
      WHERE id::text = v_employee.employee_id::text
        OR email = (
          SELECT email FROM employee_profiles WHERE id::text = v_employee.employee_id::text
        )
      LIMIT 1;

      -- If not found, try profiles table by email
      IF v_user_id IS NULL THEN
        SELECT id INTO v_user_id
        FROM profiles
        WHERE email = (
          SELECT email FROM employee_profiles WHERE id::text = v_employee.employee_id::text
        )
        LIMIT 1;
      END IF;

      -- Upsert into pod_employees
      INSERT INTO pod_employees (
        pod_id,
        employee_id,
        user_id,
        has_login,
        source,
        is_active
      )
      VALUES (
        v_employee.pod_id,
        v_employee.employee_id,
        v_user_id,
        v_user_id IS NOT NULL,
        'synced',
        true
      )
      ON CONFLICT (pod_id, employee_id) 
      DO UPDATE SET
        user_id = EXCLUDED.user_id,
        has_login = EXCLUDED.has_login,
        updated_at = now()
      WHERE pod_employees.source = 'synced'; -- Only update if it was synced

      v_synced_count := v_synced_count + 1;
      IF v_user_id IS NOT NULL THEN
        v_with_login_count := v_with_login_count + 1;
      ELSE
        v_without_login_count := v_without_login_count + 1;
      END IF;
    END LOOP;

    -- Return stats for this pod
    RETURN QUERY SELECT v_pod.id, v_synced_count, v_with_login_count, v_without_login_count;
  END LOOP;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION sync_pod_employees_from_hr() TO authenticated;

-- ========================
-- 8. Triggers
-- ========================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS update_pod_employees_updated_at ON pod_employees;
CREATE TRIGGER update_pod_employees_updated_at
  BEFORE UPDATE ON pod_employees
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_employee_pods_updated_at ON employee_pods;
CREATE TRIGGER update_employee_pods_updated_at
  BEFORE UPDATE ON employee_pods
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_pods_updated_at ON pods;
CREATE TRIGGER update_pods_updated_at
  BEFORE UPDATE ON pods
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ========================
-- 9. Helper Views (Optional)
-- ========================

-- View: pods_with_stats
CREATE OR REPLACE VIEW pods_with_stats AS
SELECT 
  p.id,
  p.name,
  p.description,
  p.color,
  p.is_active,
  p.show_in_resource_projection,
  p.created_by,
  p.created_at,
  p.updated_at,
  COUNT(DISTINCT ep.employee_id) FILTER (WHERE ep.synced_from_hr = true) as hr_synced_count,
  COUNT(DISTINCT pe.employee_id) FILTER (WHERE pe.is_active = true) as rp_members_count,
  COUNT(DISTINCT pe.user_id) FILTER (WHERE pe.has_login = true AND pe.is_active = true) as has_login_count,
  COUNT(DISTINCT pe.employee_id) FILTER (WHERE pe.has_login = false AND pe.is_active = true) as no_login_count
FROM pods p
LEFT JOIN employee_pods ep ON ep.pod_id = p.id
LEFT JOIN pod_employees pe ON pe.pod_id = p.id
GROUP BY p.id, p.name, p.description, p.color, p.is_active, p.show_in_resource_projection, p.created_by, p.created_at, p.updated_at;

-- Grant access to view
GRANT SELECT ON pods_with_stats TO authenticated;



-- 20260219102528_621f0472-f86a-4209-89eb-1d5c65a61a5c.sql

-- Create agent_conversations table
CREATE TABLE IF NOT EXISTS public.agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(500),
  summary TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  message_count INTEGER NOT NULL DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create agent_messages table
CREATE TABLE IF NOT EXISTS public.agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.agent_conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  content TEXT NOT NULL DEFAULT '',
  model_used VARCHAR(200),
  provider_used VARCHAR(200),
  tokens_input INTEGER,
  tokens_output INTEGER,
  latency_ms INTEGER,
  tool_calls JSONB,
  tool_results JSONB,
  citations JSONB NOT NULL DEFAULT '[]',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_agent_conversations_agent_user ON public.agent_conversations(agent_id, user_id);
CREATE INDEX idx_agent_conversations_last_message ON public.agent_conversations(last_message_at DESC NULLS LAST);
CREATE INDEX idx_agent_messages_conversation ON public.agent_messages(conversation_id, created_at);

-- RLS for agent_conversations
ALTER TABLE public.agent_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations"
  ON public.agent_conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations"
  ON public.agent_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations"
  ON public.agent_conversations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations"
  ON public.agent_conversations FOR DELETE
  USING (auth.uid() = user_id);

-- RLS for agent_messages (scoped through conversation ownership)
ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in own conversations"
  ON public.agent_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.agent_conversations c
    WHERE c.id = conversation_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert messages in own conversations"
  ON public.agent_messages FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.agent_conversations c
    WHERE c.id = conversation_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete messages in own conversations"
  ON public.agent_messages FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.agent_conversations c
    WHERE c.id = conversation_id AND c.user_id = auth.uid()
  ));

-- Trigger: auto-update updated_at on conversations
CREATE TRIGGER update_agent_conversations_updated_at
  BEFORE UPDATE ON public.agent_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function + trigger: update message_count and last_message_at on new message
CREATE OR REPLACE FUNCTION public.update_conversation_on_new_message()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.agent_conversations
  SET
    message_count = message_count + 1,
    last_message_at = NEW.created_at,
    updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_conversation_on_message
  AFTER INSERT ON public.agent_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversation_on_new_message();


-- 20260219113304_10c58ef2-1938-43b8-836d-356000b05126.sql
-- Refresh conversation message_count and last_message_at from agent_messages.
-- Call after sending messages so the sidebar shows correct counts even if triggers fail.

CREATE OR REPLACE FUNCTION public.refresh_conversation_stats(p_conversation_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.agent_conversations
  SET
    message_count = (SELECT count(*)::integer FROM public.agent_messages WHERE conversation_id = p_conversation_id),
    last_message_at = (SELECT max(created_at) FROM public.agent_messages WHERE conversation_id = p_conversation_id),
    updated_at = now()
  WHERE id = p_conversation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_conversation_stats(UUID) TO authenticated;

-- 20260219151611_c6be66da-fa84-46d8-b84f-07c23bca7e0e.sql

-- 1. ai_agent_categories: add UNIQUE(name), set icon default
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ai_agent_categories_name_key'
    AND conrelid = 'public.ai_agent_categories'::regclass
  ) THEN
    ALTER TABLE public.ai_agent_categories ADD CONSTRAINT ai_agent_categories_name_key UNIQUE (name);
  END IF;
END $$;

ALTER TABLE public.ai_agent_categories
  ALTER COLUMN icon SET DEFAULT 'folder';

-- 2. RLS: allow authenticated users to SELECT (active-only for non-admins; admins see all)
DROP POLICY IF EXISTS "Authenticated can read active categories" ON public.ai_agent_categories;
CREATE POLICY "Authenticated can read active categories"
  ON public.ai_agent_categories FOR SELECT
  TO authenticated
  USING (
    is_active = true
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- 3. ai_agents: add deleted_at for soft deletes
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

COMMENT ON COLUMN public.ai_agents.deleted_at IS 'Soft delete; agents with deleted_at set are excluded from category counts';


-- 20260220065929_a973936a-9bb9-492e-8ba9-746bb2220d53.sql

-- Refresh conversation message_count and last_message_at from agent_messages.
-- Call after sending messages so the sidebar shows correct counts even if triggers fail.

CREATE OR REPLACE FUNCTION public.refresh_conversation_stats(p_conversation_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.agent_conversations
  SET
    message_count = (SELECT count(*)::integer FROM public.agent_messages WHERE conversation_id = p_conversation_id),
    last_message_at = (SELECT max(created_at) FROM public.agent_messages WHERE conversation_id = p_conversation_id),
    updated_at = now()
  WHERE id = p_conversation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_conversation_stats(UUID) TO authenticated;


-- 20260220070027_25dc9660-689a-4012-8b06-3f3258eee7f2.sql

-- ============================================================================
-- Admin Semantic Search: RPC with optional project/client/manager filters
-- ============================================================================

CREATE OR REPLACE FUNCTION match_embeddings_admin(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  filter_entity_type text DEFAULT NULL,
  filter_user_id uuid DEFAULT NULL,
  filter_project_name text DEFAULT NULL,
  filter_project_manager text DEFAULT NULL,
  filter_client_name text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  entity_type text,
  entity_id text,
  content text,
  metadata jsonb,
  user_id uuid,
  similarity float,
  unified_document_id uuid,
  project_name text,
  project_manager text,
  client_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT
      e.id,
      e.entity_type,
      e.entity_id::text,
      e.content,
      e.metadata,
      e.user_id,
      (1 - (e.embedding <=> query_embedding))::float AS sim,
      e.unified_document_id
    FROM public.embeddings e
    WHERE (1 - (e.embedding <=> query_embedding)) > match_threshold
      AND (filter_entity_type IS NULL OR e.entity_type = filter_entity_type)
      AND (filter_user_id IS NULL OR e.user_id = filter_user_id)
    ORDER BY e.embedding <=> query_embedding
    LIMIT CASE
      WHEN filter_project_name IS NOT NULL AND filter_project_name != ''
        OR filter_project_manager IS NOT NULL AND filter_project_manager != ''
        OR filter_client_name IS NOT NULL AND filter_client_name != ''
      THEN LEAST(500, match_count * 10)
      ELSE match_count
    END
  ),
  ctx AS (
    SELECT
      b.id,
      b.entity_type,
      b.entity_id,
      b.content,
      b.metadata,
      b.user_id,
      b.sim,
      b.unified_document_id,
      p.name AS proj_name,
      prof.full_name AS proj_manager,
      c.name AS cli_name
    FROM base b
    LEFT JOIN public.meeting_transcripts mt
      ON b.entity_type = 'meeting_transcript' AND b.entity_id::uuid = mt.id
    LEFT JOIN public.meetings m ON mt.meeting_id = m.id
    LEFT JOIN public.clients c ON m.client_id = c.id
    LEFT JOIN public.meeting_assignments ma
      ON ma.meeting_id = m.id AND ma.entity_type = 'project'
    LEFT JOIN public.projects p ON ma.entity_id = p.id
    LEFT JOIN public.profiles prof ON p.owner_id = prof.id
  )
  SELECT
    ctx.id,
    ctx.entity_type,
    ctx.entity_id,
    ctx.content,
    ctx.metadata,
    ctx.user_id,
    ctx.sim,
    ctx.unified_document_id,
    ctx.proj_name,
    ctx.proj_manager,
    ctx.cli_name
  FROM ctx
  WHERE
    (filter_project_name IS NULL OR filter_project_name = '' OR ctx.proj_name ILIKE '%' || filter_project_name || '%')
    AND (filter_project_manager IS NULL OR filter_project_manager = '' OR ctx.proj_manager ILIKE '%' || filter_project_manager || '%')
    AND (filter_client_name IS NULL OR filter_client_name = '' OR ctx.cli_name ILIKE '%' || filter_client_name || '%')
  ORDER BY ctx.sim DESC
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION match_embeddings_admin IS 'Admin semantic search with optional entity_type and meeting context filters (project_name, project_manager, client_name). Returns similarity and optional project/client/manager for meeting transcripts.';

-- Ensure embeddings has index for vector search (may already exist)
CREATE INDEX IF NOT EXISTS idx_embeddings_vector_cosine
  ON public.embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);


-- 20260220080121_e28f8a30-8531-4557-9db2-3619a3188847.sql
INSERT INTO public.system_settings (category, key, value, description, created_at, updated_at)
VALUES (
  'ai',
  'embedding_processing_enabled',
  'true'::jsonb,
  'When true, embedding Edge Functions process pending meetings and knowledge files. When false, they return 503 or skip work.',
  NOW(),
  NOW()
)
ON CONFLICT (category, key) DO UPDATE SET
  updated_at = NOW(),
  description = EXCLUDED.description;

-- 20260220103807_b4c439a4-8143-40e9-8c0f-698b190bacfc.sql

-- RPC: vector similarity search with optional context and filters
CREATE OR REPLACE FUNCTION match_embeddings_admin(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  filter_entity_type text DEFAULT NULL,
  filter_user_id uuid DEFAULT NULL,
  filter_project_name text DEFAULT NULL,
  filter_project_manager text DEFAULT NULL,
  filter_client_name text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  entity_type text,
  entity_id text,
  content text,
  metadata jsonb,
  user_id uuid,
  similarity float,
  unified_document_id uuid,
  project_name text,
  project_manager text,
  client_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT
      e.id,
      e.entity_type,
      e.entity_id::text,
      e.content,
      e.metadata,
      e.user_id,
      (1 - (e.embedding <=> query_embedding))::float AS sim,
      e.unified_document_id
    FROM public.embeddings e
    WHERE (1 - (e.embedding <=> query_embedding)) > match_threshold
      AND (filter_entity_type IS NULL OR e.entity_type = filter_entity_type)
      AND (filter_user_id IS NULL OR e.user_id = filter_user_id)
    ORDER BY e.embedding <=> query_embedding
    LIMIT CASE
      WHEN filter_project_name IS NOT NULL AND filter_project_name != ''
        OR filter_project_manager IS NOT NULL AND filter_project_manager != ''
        OR filter_client_name IS NOT NULL AND filter_client_name != ''
      THEN LEAST(500, match_count * 10)
      ELSE match_count
    END
  ),
  ctx AS (
    SELECT
      b.id,
      b.entity_type,
      b.entity_id,
      b.content,
      b.metadata,
      b.user_id,
      b.sim,
      b.unified_document_id,
      p.name AS proj_name,
      prof.full_name AS proj_manager,
      c.name AS cli_name
    FROM base b
    LEFT JOIN public.meeting_transcripts mt
      ON b.entity_type = 'meeting_transcript' AND b.entity_id::uuid = mt.id
    LEFT JOIN public.meetings m ON mt.meeting_id = m.id
    LEFT JOIN public.clients c ON m.client_id = c.id
    LEFT JOIN public.meeting_assignments ma
      ON ma.meeting_id = m.id AND ma.entity_type = 'project'
    LEFT JOIN public.projects p ON ma.entity_id = p.id
    LEFT JOIN public.profiles prof ON p.owner_id = prof.id
  )
  SELECT
    ctx.id,
    ctx.entity_type,
    ctx.entity_id,
    ctx.content,
    ctx.metadata,
    ctx.user_id,
    ctx.sim,
    ctx.unified_document_id,
    ctx.proj_name,
    ctx.proj_manager,
    ctx.cli_name
  FROM ctx
  WHERE
    (filter_project_name IS NULL OR filter_project_name = '' OR ctx.proj_name ILIKE '%' || filter_project_name || '%')
    AND (filter_project_manager IS NULL OR filter_project_manager = '' OR ctx.proj_manager ILIKE '%' || filter_project_manager || '%')
    AND (filter_client_name IS NULL OR filter_client_name = '' OR ctx.cli_name ILIKE '%' || filter_client_name || '%')
  ORDER BY ctx.sim DESC
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION match_embeddings_admin IS 'Admin semantic search with optional entity_type and meeting context filters (project_name, project_manager, client_name). Returns similarity and optional project/client/manager for meeting transcripts.';

-- Ensure embeddings has index for vector search (may already exist)
CREATE INDEX IF NOT EXISTS idx_embeddings_vector_cosine
  ON public.embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);


-- 20260220_skills_management.sql
-- ============================================================================
-- Skills Management Migration
-- ============================================================================
-- Creates tables for:
-- - Skills (skill definitions)
-- - Employee Skills (employee-skill associations)
-- ============================================================================

-- ========================
-- Skills Table
-- ========================
CREATE TABLE IF NOT EXISTS public.skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ========================
-- Employee Skills Table
-- ========================
-- Links employees to their skills
CREATE TABLE IF NOT EXISTS public.employee_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL, -- References Employee or employee_profiles
  skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  proficiency_level TEXT DEFAULT 'intermediate'
    CHECK (proficiency_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (employee_id, skill_id)
);

-- ========================
-- Indexes
-- ========================
CREATE INDEX IF NOT EXISTS idx_skills_category ON public.skills(category);
CREATE INDEX IF NOT EXISTS idx_skills_name ON public.skills(name);
CREATE INDEX IF NOT EXISTS idx_employee_skills_employee_id ON public.employee_skills(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_skills_skill_id ON public.employee_skills(skill_id);
CREATE INDEX IF NOT EXISTS idx_employee_skills_proficiency ON public.employee_skills(proficiency_level);

-- ========================
-- RLS Policies
-- ========================

-- Skills
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view skills" ON public.skills
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage skills" ON public.skills
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Employee Skills
ALTER TABLE public.employee_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view employee skills" ON public.employee_skills
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage employee skills" ON public.employee_skills
  FOR ALL TO authenticated USING (true) WITH CHECK (true);



-- 20260224190624_7e669a9e-5371-4ad0-9a6d-0cf831036dcd.sql
BEGIN;

ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS module TEXT;

-- Refresh PostgREST cache
NOTIFY pgrst, 'reload schema';

COMMIT;

-- 20260224193813_e9368551-0cbd-4d10-bc2e-e1165b1ac3d0.sql
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS module TEXT;

-- 20260224_dashboard_tables.sql
-- ============================================================================
-- MIGRATION: Agency-First Dashboard Foundation
-- Date: 2026-02-24
-- Purpose: Add role-specific dashboard tables, views, and column additions
--          to support Owner / PM / IC dashboard rebuild.
-- ============================================================================

-- 1. user_role_preferences
--    Stores each user's agency role (owner/pm/ic) and dashboard preferences.
--    agency_role is separate from the auth app_role (admin/moderator/user).
CREATE TABLE IF NOT EXISTS public.user_role_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  -- Agency-level role used for dashboard routing
  agency_role text CHECK (agency_role IN ('owner', 'pm', 'ic')),
  -- EOS flag: when true, Owner gets OwnerDashboardWithEOS
  is_eos_user boolean NOT NULL DEFAULT false,
  -- Dashboard layout customisation (reserved for future card ordering)
  dashboard_layout jsonb DEFAULT '{}',
  -- Primary pod this user manages (PM context)
  primary_pod_id uuid REFERENCES public.pods(id) ON DELETE SET NULL,
  -- AI digest preferences
  ai_digest_enabled boolean NOT NULL DEFAULT true,
  ai_digest_frequency text NOT NULL DEFAULT 'weekly',
  -- Task display preferences
  hide_completed_tasks boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_role_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_role_prefs"
  ON public.user_role_preferences
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admins can read all preferences (for user management)
CREATE POLICY "admins_read_all_role_prefs"
  ON public.user_role_preferences
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_user_role_preferences_user_id
  ON public.user_role_preferences(user_id);


-- 2. dashboard_widgets
--    Registry of available dashboard widget components.
--    agency_roles controls which role dashboards show each widget.
CREATE TABLE IF NOT EXISTS public.dashboard_widgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_slug text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  component_name text NOT NULL,
  agency_roles text[] NOT NULL DEFAULT '{}', -- owner, pm, ic
  is_enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Public read access (no sensitive data)
ALTER TABLE public.dashboard_widgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_widgets"
  ON public.dashboard_widgets
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "admins_manage_widgets"
  ON public.dashboard_widgets
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
    )
  );

-- Seed initial widget registry
INSERT INTO public.dashboard_widgets
  (widget_slug, display_name, description, component_name, agency_roles, sort_order)
VALUES
  ('health_metrics',  'Health Metrics',        'Revenue, utilization, project on-track %',     'HealthMetricsCard',    ARRAY['owner'],           1),
  ('watch_list',      'Watch List',             'At-risk projects, over-capacity teams, alerts', 'WatchListCard',        ARRAY['owner'],           2),
  ('team_capacity',   'Team Capacity',          'Utilization by pod member',                    'TeamCapacityCard',     ARRAY['pm'],              3),
  ('ai_digest',       'AI Weekly Digest',       'AI-generated week-in-review summary',          'AIWeeklyDigestCard',   ARRAY['owner','pm','ic'], 10)
ON CONFLICT (widget_slug) DO NOTHING;


-- 3. project_at_risk_flags
--    Event log tracking why a project is at risk. One flag per type per project.
CREATE TABLE IF NOT EXISTS public.project_at_risk_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  flag_type text NOT NULL,   -- deadline_approaching | blocked | over_budget | no_activity | feedback_pending
  description text,
  triggered_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, flag_type)
);

ALTER TABLE public.project_at_risk_flags ENABLE ROW LEVEL SECURITY;

-- Users can read flags for projects they own or created
CREATE POLICY "project_owners_read_risk_flags"
  ON public.project_at_risk_flags
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_at_risk_flags.project_id
        AND (p.owner_id = auth.uid() OR p.created_by = auth.uid())
    )
  );

CREATE POLICY "admins_manage_risk_flags"
  ON public.project_at_risk_flags
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'moderator')
    )
  );

CREATE INDEX IF NOT EXISTS idx_project_at_risk_flags_project_id
  ON public.project_at_risk_flags(project_id);

CREATE INDEX IF NOT EXISTS idx_project_at_risk_flags_resolved
  ON public.project_at_risk_flags(resolved_at)
  WHERE resolved_at IS NULL;


-- 4. ai_digest_logs
--    Stores AI-generated weekly/daily digests per user.
CREATE TABLE IF NOT EXISTS public.ai_digest_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  digest_type text NOT NULL DEFAULT 'weekly', -- weekly | daily | alert
  subject text NOT NULL,
  summary jsonb NOT NULL DEFAULT '{}',
  was_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_digest_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_digests"
  ON public.ai_digest_logs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "users_update_own_digests"
  ON public.ai_digest_logs
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_ai_digest_logs_user_id
  ON public.ai_digest_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_ai_digest_logs_sent_at
  ON public.ai_digest_logs(sent_at DESC);


-- ============================================================================
-- COLUMN ADDITIONS
-- ============================================================================

-- 5. projects: risk tracking columns
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS is_at_risk boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS risk_flags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS owner_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS expected_completion_date date;

CREATE INDEX IF NOT EXISTS idx_projects_is_at_risk
  ON public.projects(is_at_risk)
  WHERE is_at_risk = true;


-- 6. meetings: AI summary status columns
--    meetings.ai_summary already exists (text); add status + timestamps
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS ai_summary_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS ai_summary_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS action_items_extracted_at timestamptz;


-- ============================================================================
-- VIEWS
-- ============================================================================

-- 7. owner_dashboard_metrics
--    Single-row aggregate view for the Owner dashboard health card.
--    Note: tasks/meetings lack project_id FK — metrics use client-level proxies.
CREATE OR REPLACE VIEW public.owner_dashboard_metrics AS
SELECT
  -- Revenue: sum of deal values closed in the last 7 days
  (
    SELECT COALESCE(SUM(value), 0)::numeric
    FROM public.deals
    WHERE closed_at >= now() - interval '7 days'
  ) AS revenue_this_week,

  -- Team utilization: average across current week's records
  (
    SELECT COALESCE(ROUND(AVG(utilization_pct)::numeric, 1), 0)
    FROM public.productivity_records
    WHERE week_start = date_trunc('week', now())::date
  ) AS team_utilization,

  -- Projects in progress (not archived)
  (
    SELECT COUNT(*)
    FROM public.projects p
    JOIN public.project_statuses ps ON ps.id = p.status_id
    WHERE p.is_archived = false
      AND ps.slug = 'in_progress'
  ) AS projects_in_progress,

  -- At-risk projects
  (
    SELECT COUNT(*)
    FROM public.projects
    WHERE is_at_risk = true
      AND is_archived = false
  ) AS projects_at_risk,

  -- Active clients
  (
    SELECT COUNT(*)
    FROM public.clients
    WHERE status = 'active'
  ) AS active_clients,

  -- Active team members
  (
    SELECT COUNT(*)
    FROM public.profiles
    WHERE is_active = true
  ) AS active_team_members,

  now() AS generated_at;


-- 8. project_risk_summary
--    Per-project risk data for the Watch List card.
--    Approximates task/meeting counts via client_id bridge
--    (tasks and meetings lack a direct project_id FK in the current schema).
CREATE OR REPLACE VIEW public.project_risk_summary AS
SELECT
  p.id,
  p.name,
  p.slug,
  c.name AS client_name,
  p.end_date,
  p.expected_completion_date,
  p.is_at_risk,
  string_agg(DISTINCT prf.flag_type, ', ') AS risk_flags,
  -- Open tasks approximated via shared client_id
  (
    SELECT COUNT(*)
    FROM public.tasks t
    WHERE t.client_id = p.client_id
      AND t.status NOT IN ('done', 'cancelled')
  ) AS open_tasks,
  -- Last meeting with this client
  (
    SELECT MAX(m.scheduled_at)
    FROM public.meetings m
    WHERE m.client_id = p.client_id
  ) AS last_client_meeting,
  -- Last task activity for this client
  (
    SELECT MAX(t.updated_at)
    FROM public.tasks t
    WHERE t.client_id = p.client_id
  ) AS last_activity
FROM public.projects p
LEFT JOIN public.clients c ON c.id = p.client_id
LEFT JOIN public.project_at_risk_flags prf
  ON prf.project_id = p.id
  AND prf.resolved_at IS NULL
WHERE p.is_archived = false
GROUP BY
  p.id, p.name, p.slug, c.name,
  p.end_date, p.expected_completion_date, p.is_at_risk;


-- 9. pm_team_capacity
--    Per-pod capacity rollup for the Team Capacity card.
--    Joins productivity_records (email-keyed) → profiles → pod_members.
CREATE OR REPLACE VIEW public.pm_team_capacity AS
SELECT
  pm.pod_id,
  COUNT(DISTINCT pr.employee_email)                                   AS total_team_members,
  SUM(CASE WHEN pr.utilization_pct >= 90 THEN 1 ELSE 0 END)          AS at_capacity,
  SUM(CASE WHEN pr.utilization_pct < 50  THEN 1 ELSE 0 END)          AS available,
  ROUND(AVG(pr.utilization_pct)::numeric, 1)                         AS avg_utilization,
  date_trunc('week', now())::date                                     AS week_start
FROM public.productivity_records pr
JOIN public.profiles prof ON prof.email = pr.employee_email
JOIN public.pod_members pm  ON pm.user_id = prof.id
WHERE pr.week_start = date_trunc('week', now())::date
GROUP BY pm.pod_id;


-- 20260225004648_53f219c4-6df6-4913-8079-a5a7844c1dfc.sql
-- ============================================================================
-- MIGRATION: Agency-First Dashboard Foundation
-- Date: 2026-02-24
-- Purpose: Add role-specific dashboard tables, views, and column additions
--          to support Owner / PM / IC dashboard rebuild.
-- ============================================================================

-- 1. user_role_preferences
CREATE TABLE IF NOT EXISTS public.user_role_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  agency_role text CHECK (agency_role IN ('owner', 'pm', 'ic')),
  is_eos_user boolean NOT NULL DEFAULT false,
  dashboard_layout jsonb DEFAULT '{}',
  primary_pod_id uuid REFERENCES public.pods(id) ON DELETE SET NULL,
  ai_digest_enabled boolean NOT NULL DEFAULT true,
  ai_digest_frequency text NOT NULL DEFAULT 'weekly',
  hide_completed_tasks boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_role_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_role_prefs"
  ON public.user_role_preferences
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "admins_read_all_role_prefs"
  ON public.user_role_preferences
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_user_role_preferences_user_id
  ON public.user_role_preferences(user_id);


-- 2. dashboard_widgets
CREATE TABLE IF NOT EXISTS public.dashboard_widgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_slug text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  component_name text NOT NULL,
  agency_roles text[] NOT NULL DEFAULT '{}',
  is_enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dashboard_widgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_widgets"
  ON public.dashboard_widgets
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "admins_manage_widgets"
  ON public.dashboard_widgets
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
    )
  );

-- Seed initial widget registry
INSERT INTO public.dashboard_widgets
  (widget_slug, display_name, description, component_name, agency_roles, sort_order)
VALUES
  ('health_metrics',  'Health Metrics',        'Revenue, utilization, project on-track %',     'HealthMetricsCard',    ARRAY['owner'],           1),
  ('watch_list',      'Watch List',             'At-risk projects, over-capacity teams, alerts', 'WatchListCard',        ARRAY['owner'],           2),
  ('team_capacity',   'Team Capacity',          'Utilization by pod member',                    'TeamCapacityCard',     ARRAY['pm'],              3),
  ('ai_digest',       'AI Weekly Digest',       'AI-generated week-in-review summary',          'AIWeeklyDigestCard',   ARRAY['owner','pm','ic'], 10)
ON CONFLICT (widget_slug) DO NOTHING;


-- 3. project_at_risk_flags
CREATE TABLE IF NOT EXISTS public.project_at_risk_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  flag_type text NOT NULL,
  description text,
  triggered_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, flag_type)
);

ALTER TABLE public.project_at_risk_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_owners_read_risk_flags"
  ON public.project_at_risk_flags
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_at_risk_flags.project_id
        AND (p.owner_id = auth.uid() OR p.created_by = auth.uid())
    )
  );

CREATE POLICY "admins_manage_risk_flags"
  ON public.project_at_risk_flags
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'moderator')
    )
  );

CREATE INDEX IF NOT EXISTS idx_project_at_risk_flags_project_id
  ON public.project_at_risk_flags(project_id);

CREATE INDEX IF NOT EXISTS idx_project_at_risk_flags_resolved
  ON public.project_at_risk_flags(resolved_at)
  WHERE resolved_at IS NULL;


-- 4. ai_digest_logs
CREATE TABLE IF NOT EXISTS public.ai_digest_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  digest_type text NOT NULL DEFAULT 'weekly',
  subject text NOT NULL,
  summary jsonb NOT NULL DEFAULT '{}',
  was_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_digest_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_digests"
  ON public.ai_digest_logs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "users_update_own_digests"
  ON public.ai_digest_logs
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_ai_digest_logs_user_id
  ON public.ai_digest_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_ai_digest_logs_sent_at
  ON public.ai_digest_logs(sent_at DESC);


-- ============================================================================
-- COLUMN ADDITIONS
-- ============================================================================

-- 5. projects: risk tracking columns
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS is_at_risk boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS risk_flags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS owner_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS expected_completion_date date;

CREATE INDEX IF NOT EXISTS idx_projects_is_at_risk
  ON public.projects(is_at_risk)
  WHERE is_at_risk = true;


-- 6. meetings: AI summary status columns
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS ai_summary_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS ai_summary_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS action_items_extracted_at timestamptz;


-- ============================================================================
-- VIEWS
-- ============================================================================

-- 7. owner_dashboard_metrics
CREATE OR REPLACE VIEW public.owner_dashboard_metrics AS
SELECT
  (
    SELECT COALESCE(SUM(value), 0)::numeric
    FROM public.deals
    WHERE closed_at >= now() - interval '7 days'
  ) AS revenue_this_week,
  (
    SELECT COALESCE(ROUND(AVG(utilization_pct)::numeric, 1), 0)
    FROM public.productivity_records
    WHERE week_start = date_trunc('week', now())::date
  ) AS team_utilization,
  (
    SELECT COUNT(*)
    FROM public.projects p
    JOIN public.project_statuses ps ON ps.id = p.status_id
    WHERE p.is_archived = false
      AND ps.slug = 'in_progress'
  ) AS projects_in_progress,
  (
    SELECT COUNT(*)
    FROM public.projects
    WHERE is_at_risk = true
      AND is_archived = false
  ) AS projects_at_risk,
  (
    SELECT COUNT(*)
    FROM public.clients
    WHERE status = 'active'
  ) AS active_clients,
  (
    SELECT COUNT(*)
    FROM public.profiles
    WHERE is_active = true
  ) AS active_team_members,
  now() AS generated_at;


-- 8. project_risk_summary
CREATE OR REPLACE VIEW public.project_risk_summary AS
SELECT
  p.id,
  p.name,
  p.slug,
  c.name AS client_name,
  p.end_date,
  p.expected_completion_date,
  p.is_at_risk,
  string_agg(DISTINCT prf.flag_type, ', ') AS risk_flags,
  (
    SELECT COUNT(*)
    FROM public.tasks t
    WHERE t.client_id = p.client_id
      AND t.status NOT IN ('done', 'cancelled')
  ) AS open_tasks,
  (
    SELECT MAX(m.scheduled_at)
    FROM public.meetings m
    WHERE m.client_id = p.client_id
  ) AS last_client_meeting,
  (
    SELECT MAX(t.updated_at)
    FROM public.tasks t
    WHERE t.client_id = p.client_id
  ) AS last_activity
FROM public.projects p
LEFT JOIN public.clients c ON c.id = p.client_id
LEFT JOIN public.project_at_risk_flags prf
  ON prf.project_id = p.id
  AND prf.resolved_at IS NULL
WHERE p.is_archived = false
GROUP BY
  p.id, p.name, p.slug, c.name,
  p.end_date, p.expected_completion_date, p.is_at_risk;


-- 9. pm_team_capacity
CREATE OR REPLACE VIEW public.pm_team_capacity AS
SELECT
  pm.pod_id,
  COUNT(DISTINCT pr.employee_email)                                   AS total_team_members,
  SUM(CASE WHEN pr.utilization_pct >= 90 THEN 1 ELSE 0 END)          AS at_capacity,
  SUM(CASE WHEN pr.utilization_pct < 50  THEN 1 ELSE 0 END)          AS available,
  ROUND(AVG(pr.utilization_pct)::numeric, 1)                         AS avg_utilization,
  date_trunc('week', now())::date                                     AS week_start
FROM public.productivity_records pr
JOIN public.profiles prof ON prof.email = pr.employee_email
JOIN public.pod_members pm  ON pm.user_id = prof.id
WHERE pr.week_start = date_trunc('week', now())::date
GROUP BY pm.pod_id;

-- 20260225004718_3d22a04b-faf4-4763-81b8-8ca7e7354b33.sql
-- Insert agency role preferences for all 4 accounts
-- Using 'user' as default app_role for accounts without explicit user_roles entries
INSERT INTO public.user_role_preferences (user_id, role, agency_role, is_eos_user)
VALUES
  ('78657387-d518-4b2e-88d8-eca802372ad5', 'admin', 'owner', true),
  ('c4642966-5969-4d55-b3a6-ce850c1e2786', 'user',  'owner', true),
  ('e46a6d4e-d69e-4bf5-9341-ba998e8da243', 'user',  'pm',    false),
  ('d2cdb3a0-fd4b-4e05-8fd9-a3135a9f1d39', 'user',  'ic',    false)
ON CONFLICT (user_id, role) DO UPDATE SET
  agency_role = EXCLUDED.agency_role,
  is_eos_user = EXCLUDED.is_eos_user;

-- 20260225005227_6e386ac0-ee55-4342-8d8b-ddf54561c490.sql
-- Set a default chat model (GPT-4o mini is cheapest/fastest)
UPDATE ai_models SET is_default = true WHERE id = '25b7d4ba-06a3-4ead-9229-0ec15b7fa0ba';

-- 20260225033028_6ae7332c-0f8e-4e1b-8aff-6a78dee25abf.sql

-- Add data source tracking columns to clients table
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS data_source text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS external_url text,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

-- Add data source tracking columns to contacts table
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS data_source text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS external_url text,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

-- Add data source tracking columns to deals table
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS data_source text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS external_url text,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

-- Create indexes for filtering by data source
CREATE INDEX IF NOT EXISTS idx_clients_data_source ON public.clients(data_source);
CREATE INDEX IF NOT EXISTS idx_contacts_data_source ON public.contacts(data_source);
CREATE INDEX IF NOT EXISTS idx_deals_data_source ON public.deals(data_source);


-- 20260225043935_31375bd6-03a7-40d4-8188-69eb298423e9.sql

-- Add project members
INSERT INTO project_members (project_id, user_id, role) VALUES
  ('3ecefe6b-556a-4abf-ade5-6843c807f7ce', 'd2cdb3a0-fd4b-4e05-8fd9-a3135a9f1d39', 'member'),
  ('1c8ad1e2-8318-4b50-9e4b-47082dec46c5', 'd2cdb3a0-fd4b-4e05-8fd9-a3135a9f1d39', 'member'),
  ('3ecefe6b-556a-4abf-ade5-6843c807f7ce', 'e46a6d4e-d69e-4bf5-9341-ba998e8da243', 'manager'),
  ('1c8ad1e2-8318-4b50-9e4b-47082dec46c5', 'e46a6d4e-d69e-4bf5-9341-ba998e8da243', 'manager'),
  ('7dc6bd63-56ec-4697-87a7-f4cee514ceaa', 'e46a6d4e-d69e-4bf5-9341-ba998e8da243', 'manager'),
  ('433fb262-7ab2-4a2c-b26d-c40a1eb70d76', 'c4642966-5969-4d55-b3a6-ce850c1e2786', 'viewer')
ON CONFLICT DO NOTHING;

-- Create current-week meetings
INSERT INTO meetings (id, title, description, organizer_id, scheduled_at, duration_minutes, status, meeting_type, slug, summary, action_items, notes) VALUES
  ('a1b2c3d4-0001-4000-8000-000000000001',
   'Sprint Planning — Platform V2',
   'Plan sprint deliverables for the next two weeks including SSO integration, CSV export, and monitoring setup.',
   '78657387-d518-4b2e-88d8-eca802372ad5',
   date_trunc('week', now()) + interval '1 day 10 hours',
   60, 'scheduled', 'internal', 'sprint-planning-platform-v2',
   'Team aligned on 3 key deliverables: SSO integration (IC lead), CSV export for productivity module, and monitoring alerts setup.',
   '["IC to complete SSO Entra integration by March 3", "PM to finalize CSV export requirements", "Admin to configure monitoring alerts in Datadog"]',
   'Sprint velocity target: 34 points. Carry-over from last sprint: 8 points.'),
  ('a1b2c3d4-0002-4000-8000-000000000002',
   'Acme Corp — Quarterly Business Review',
   'Review Q4 performance metrics, discuss renewal terms, and present roadmap for Q1.',
   'e46a6d4e-d69e-4bf5-9341-ba998e8da243',
   date_trunc('week', now()) + interval '2 days 14 hours',
   90, 'scheduled', 'client', 'acme-corp-qbr',
   'Acme expressed strong satisfaction with platform adoption (87% DAU). Renewal confirmed at +15% uplift.',
   '["Send updated pricing proposal by Friday", "Schedule technical deep-dive on SSO for Acme IT team", "Share Q1 product roadmap PDF"]',
   'Key stakeholders present: VP Engineering, Director of Product, IT Manager. NPS score: 9/10.'),
  ('a1b2c3d4-0003-4000-8000-000000000003',
   'FinEdge — Proof of Concept Demo',
   'Live demo of the platform for FinEdge evaluation team. Focus on compliance features and audit trail.',
   'e46a6d4e-d69e-4bf5-9341-ba998e8da243',
   date_trunc('week', now()) + interval '3 days 11 hours',
   45, 'scheduled', 'client', 'finedge-poc-demo',
   NULL, NULL,
   'Prepare demo environment with sample compliance data. Focus areas: audit logs, RLS, data export.'),
  ('a1b2c3d4-0004-4000-8000-000000000004',
   'Leadership Sync — Growth Strategy',
   'Weekly leadership alignment on growth targets, hiring pipeline, and product strategy.',
   'c4642966-5969-4d55-b3a6-ce850c1e2786',
   date_trunc('week', now()) + interval '4 days 9 hours',
   30, 'scheduled', 'internal', 'leadership-sync-growth',
   'Agreed to accelerate hiring for 2 senior engineers. Q1 revenue tracking 12% above forecast.',
   '["HR to post senior engineer roles by Monday", "CEO to finalize partnership term sheet with CloudNova", "PM to present PLG metrics dashboard next week"]',
   'Attendees: CEO, Admin/CTO, PM lead. Mood: optimistic.')
ON CONFLICT (id) DO NOTHING;

-- Add meeting participants (roles: organizer, presenter, attendee, optional)
INSERT INTO meeting_participants (meeting_id, user_id, role, rsvp_status) VALUES
  ('a1b2c3d4-0001-4000-8000-000000000001', '78657387-d518-4b2e-88d8-eca802372ad5', 'organizer', 'accepted'),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'd2cdb3a0-fd4b-4e05-8fd9-a3135a9f1d39', 'attendee', 'accepted'),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'e46a6d4e-d69e-4bf5-9341-ba998e8da243', 'attendee', 'accepted'),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'e46a6d4e-d69e-4bf5-9341-ba998e8da243', 'organizer', 'accepted'),
  ('a1b2c3d4-0002-4000-8000-000000000002', '78657387-d518-4b2e-88d8-eca802372ad5', 'attendee', 'accepted'),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'c4642966-5969-4d55-b3a6-ce850c1e2786', 'optional', 'tentative'),
  ('a1b2c3d4-0003-4000-8000-000000000003', 'e46a6d4e-d69e-4bf5-9341-ba998e8da243', 'organizer', 'accepted'),
  ('a1b2c3d4-0003-4000-8000-000000000003', 'd2cdb3a0-fd4b-4e05-8fd9-a3135a9f1d39', 'attendee', 'accepted'),
  ('a1b2c3d4-0004-4000-8000-000000000004', 'c4642966-5969-4d55-b3a6-ce850c1e2786', 'organizer', 'accepted'),
  ('a1b2c3d4-0004-4000-8000-000000000004', '78657387-d518-4b2e-88d8-eca802372ad5', 'attendee', 'accepted'),
  ('a1b2c3d4-0004-4000-8000-000000000004', 'e46a6d4e-d69e-4bf5-9341-ba998e8da243', 'attendee', 'accepted')
ON CONFLICT DO NOTHING;

-- Seed AI digest logs
INSERT INTO ai_digest_logs (user_id, digest_type, subject, summary, was_read, sent_at) VALUES
  ('78657387-d518-4b2e-88d8-eca802372ad5', 'daily', 'Your Daily Digest — Feb 25',
   '{"highlights": ["Sprint Planning scheduled for tomorrow at 10 AM", "3 tasks in progress: SSO, Newsletter, Access Review", "Acme QBR on Wednesday"], "tasks_due": 3, "meetings_today": 1, "action_items": 2}'::jsonb,
   false, now() - interval '2 hours'),
  ('c4642966-5969-4d55-b3a6-ce850c1e2786', 'daily', 'CEO Daily Brief — Feb 25',
   '{"highlights": ["Q1 revenue tracking 12% above forecast", "Leadership Sync scheduled for Thursday", "2 pending decisions: Acme billing, quarterly review"], "tasks_due": 2, "meetings_today": 0, "action_items": 1}'::jsonb,
   false, now() - interval '2 hours'),
  ('e46a6d4e-d69e-4bf5-9341-ba998e8da243', 'daily', 'PM Daily Digest — Feb 25',
   '{"highlights": ["Acme Corp onboarding in progress — 60% complete", "FinEdge POC demo on Thursday", "Case study draft due this week", "3 projects actively managed"], "tasks_due": 4, "meetings_today": 0, "action_items": 3}'::jsonb,
   false, now() - interval '2 hours'),
  ('d2cdb3a0-fd4b-4e05-8fd9-a3135a9f1d39', 'daily', 'Your Daily Digest — Feb 25',
   '{"highlights": ["SSO integration — in progress, targeting March 3", "Sprint Planning tomorrow at 10 AM", "FinEdge demo prep needed by Thursday", "6 tasks assigned, 1 in progress"], "tasks_due": 5, "meetings_today": 0, "action_items": 2}'::jsonb,
   false, now() - interval '2 hours');


-- 20260225044009_43923acb-311b-4af9-adef-732c175d8491.sql

-- Reassign tasks to IC user
UPDATE tasks SET assigned_to = 'd2cdb3a0-fd4b-4e05-8fd9-a3135a9f1d39' WHERE id IN (
  '616f770d-adbd-4d91-aee8-40829463537d',
  'bbfa70c6-1621-44ad-9b5e-4faf1ecf05e5',
  '5c72dc63-7668-4af7-a64b-9abd73692dc1',
  'ed8f7f79-db1f-4999-b812-8d13ce628617',
  'fa9982cd-804c-4826-93fe-c93f5695cb15',
  '0db6565f-a9f7-44bc-99f3-237bdf7b354e'
);

-- Reassign tasks to PM/demo user
UPDATE tasks SET assigned_to = 'e46a6d4e-d69e-4bf5-9341-ba998e8da243' WHERE id IN (
  '8cfd6ea6-1227-42a9-94ca-44c4f7b9ca7d',
  'bc075ebb-f1b6-413c-8c4d-db0030e0603a',
  '2cbdc06b-dcb7-427d-914c-ad533fa04905',
  '9cd857a6-041c-402e-be0b-c521c59d7dc2'
);

-- Reassign tasks to CEO user
UPDATE tasks SET assigned_to = 'c4642966-5969-4d55-b3a6-ce850c1e2786' WHERE id IN (
  '602a5bbb-359a-4dba-9f79-ea6f5b71be5a',
  'dad3e2f3-8e11-4a27-83d1-78e2320758f1'
);


