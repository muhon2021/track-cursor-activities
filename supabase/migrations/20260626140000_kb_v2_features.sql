-- KB v2: feature flags, search history, Slack sources, OCR confidence, memory decay snapshots

-- Feature flags (defaults off — enable per org in app_config admin)
INSERT INTO public.app_config (key, value, category, description)
VALUES
  ('features.enableKbCohere', 'false'::jsonb, 'features', 'Enable Cohere rerank badges and enhanced search UI'),
  ('features.enableKbSlack', 'false'::jsonb, 'features', 'Enable Slack knowledge source integration UI'),
  ('features.enableKbOcr', 'false'::jsonb, 'features', 'Enable OCR quality dashboard and parser OCR options'),
  ('features.enableKbParserAdvanced', 'false'::jsonb, 'features', 'Enable advanced parser configuration panel'),
  ('features.enableKbMemoryDecay', 'false'::jsonb, 'features', 'Enable memory decay sparkline visualizations')
ON CONFLICT (key) DO NOTHING;

-- User search history (personal knowledge recent searches)
CREATE TABLE IF NOT EXISTS public.kb_user_search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'web'
    CHECK (platform IN ('web', 'mobile', 'api', 'agent', 'slack')),
  result_count INTEGER DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kb_user_search_history_user
  ON public.kb_user_search_history(user_id, created_at DESC);

ALTER TABLE public.kb_user_search_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own search history"
  ON public.kb_user_search_history FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own search history"
  ON public.kb_user_search_history FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own search history"
  ON public.kb_user_search_history FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins read all search history"
  ON public.kb_user_search_history FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Slack channel configuration
CREATE TABLE IF NOT EXISTS public.kb_slack_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id TEXT NOT NULL UNIQUE,
  channel_name TEXT NOT NULL,
  is_public BOOLEAN NOT NULL DEFAULT true,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  member_count INTEGER DEFAULT 0,
  last_synced_at TIMESTAMPTZ,
  sync_status TEXT NOT NULL DEFAULT 'idle'
    CHECK (sync_status IN ('idle', 'syncing', 'completed', 'failed')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kb_slack_channels_enabled
  ON public.kb_slack_channels(is_enabled) WHERE is_enabled = true;

-- Slack sync ledger
CREATE TABLE IF NOT EXISTS public.kb_slack_sync_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id TEXT NOT NULL REFERENCES public.kb_slack_channels(channel_id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  messages_synced INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  triggered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_kb_slack_sync_ledger_channel
  ON public.kb_slack_sync_ledger(channel_id, started_at DESC);

-- OCR confidence on extracted images
ALTER TABLE public.document_images
  ADD COLUMN IF NOT EXISTS ocr_confidence NUMERIC(5,4);

-- Memory decay snapshots for sparkline charts (7-point history per memory)
CREATE TABLE IF NOT EXISTS public.kb_memory_decay_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  memory_id UUID NOT NULL,
  importance_score NUMERIC(5,4) NOT NULL,
  snapshot_index SMALLINT NOT NULL CHECK (snapshot_index >= 0 AND snapshot_index < 7),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (memory_id, snapshot_index)
);

CREATE INDEX IF NOT EXISTS idx_kb_memory_decay_user
  ON public.kb_memory_decay_snapshots(user_id, memory_id);

ALTER TABLE public.kb_slack_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_slack_sync_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_memory_decay_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage kb_slack_channels"
  ON public.kb_slack_channels FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated read kb_slack_channels"
  ON public.kb_slack_channels FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins manage kb_slack_sync_ledger"
  ON public.kb_slack_sync_ledger FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated read kb_slack_sync_ledger"
  ON public.kb_slack_sync_ledger FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users read own memory decay snapshots"
  ON public.kb_memory_decay_snapshots FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own memory decay snapshots"
  ON public.kb_memory_decay_snapshots FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS set_kb_slack_channels_updated_at ON public.kb_slack_channels;
CREATE TRIGGER set_kb_slack_channels_updated_at
  BEFORE UPDATE ON public.kb_slack_channels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.kb_user_search_history IS 'Per-user knowledge search history for personal knowledge UI';
COMMENT ON TABLE public.kb_slack_channels IS 'Slack public channels available for knowledge sync';
COMMENT ON TABLE public.kb_slack_sync_ledger IS 'Audit ledger of Slack channel sync operations';
