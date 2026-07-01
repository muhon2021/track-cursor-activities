-- Knowledge Base Enhancement Migration
-- Adds embedding status tracking, bookmarks, and auto-embedding triggers

-- =====================================================
-- 1. Add embedding status columns to knowledge_entries
-- =====================================================

ALTER TABLE knowledge_entries
ADD COLUMN IF NOT EXISTS embedding_status TEXT DEFAULT 'pending' CHECK (embedding_status IN ('pending', 'processing', 'completed', 'failed')),
ADD COLUMN IF NOT EXISTS embedding_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_embedded_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reading_time_minutes INTEGER;

-- Create index on embedding_status for filtering
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_embedding_status ON knowledge_entries(embedding_status);

-- Add comment for clarity
COMMENT ON COLUMN knowledge_entries.embedding_status IS 'Status of embedding generation: pending, processing, completed, or failed';
COMMENT ON COLUMN knowledge_entries.embedding_count IS 'Number of embedding chunks generated for this entry';
COMMENT ON COLUMN knowledge_entries.last_embedded_at IS 'Timestamp when embeddings were last generated';
COMMENT ON COLUMN knowledge_entries.reading_time_minutes IS 'Estimated reading time in minutes';

-- =====================================================
-- 2. Create knowledge_bookmarks table for user favorites
-- =====================================================

CREATE TABLE IF NOT EXISTS knowledge_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_id UUID NOT NULL REFERENCES knowledge_entries(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate bookmarks
  UNIQUE(user_id, entry_id)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_knowledge_bookmarks_user_id ON knowledge_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_bookmarks_entry_id ON knowledge_bookmarks(entry_id);

-- Add comment
COMMENT ON TABLE knowledge_bookmarks IS 'User bookmarks/favorites for knowledge base entries';

-- =====================================================
-- 3. Enable RLS on knowledge_bookmarks
-- =====================================================

ALTER TABLE knowledge_bookmarks ENABLE ROW LEVEL SECURITY;

-- Users can manage their own bookmarks
CREATE POLICY "Users can view own bookmarks"
  ON knowledge_bookmarks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own bookmarks"
  ON knowledge_bookmarks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own bookmarks"
  ON knowledge_bookmarks FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- 4. Function to calculate reading time
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_reading_time(content_text TEXT)
RETURNS INTEGER AS $$
DECLARE
  word_count INTEGER;
  reading_time INTEGER;
BEGIN
  -- Count words (split by spaces, roughly)
  word_count := array_length(regexp_split_to_array(content_text, '\s+'), 1);

  -- Average reading speed: 200 words per minute
  reading_time := CEIL(word_count::FLOAT / 200.0);

  -- Minimum 1 minute
  IF reading_time < 1 THEN
    reading_time := 1;
  END IF;

  RETURN reading_time;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_reading_time IS 'Calculates estimated reading time in minutes based on word count';

-- =====================================================
-- 5. Function to trigger embedding generation
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_knowledge_embedding()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger for published entries with content
  IF NEW.status = 'published' AND NEW.content IS NOT NULL AND NEW.content != '' THEN

    -- If content changed or first time publishing, mark as pending
    IF (TG_OP = 'INSERT') OR (OLD.content != NEW.content) OR (OLD.status != 'published') THEN
      NEW.embedding_status := 'pending';

      -- Calculate reading time
      NEW.reading_time_minutes := calculate_reading_time(NEW.content);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION trigger_knowledge_embedding IS 'Automatically marks knowledge entries for embedding when published or content changes';

-- =====================================================
-- 6. Create trigger on knowledge_entries
-- =====================================================

DROP TRIGGER IF EXISTS knowledge_entry_embedding_trigger ON knowledge_entries;

CREATE TRIGGER knowledge_entry_embedding_trigger
  BEFORE INSERT OR UPDATE ON knowledge_entries
  FOR EACH ROW
  EXECUTE FUNCTION trigger_knowledge_embedding();

-- =====================================================
-- 7. Update existing entries with reading time
-- =====================================================

UPDATE knowledge_entries
SET reading_time_minutes = calculate_reading_time(content)
WHERE content IS NOT NULL AND reading_time_minutes IS NULL;

-- =====================================================
-- 8. Add embedding metadata to embeddings table
-- =====================================================

-- Add model_name column to track which embedding model was used
ALTER TABLE embeddings
ADD COLUMN IF NOT EXISTS model_name TEXT,
ADD COLUMN IF NOT EXISTS model_provider TEXT,
ADD COLUMN IF NOT EXISTS embedding_dimensions INTEGER;

-- Create index for querying by model
CREATE INDEX IF NOT EXISTS idx_embeddings_model_name ON embeddings(model_name);

COMMENT ON COLUMN embeddings.model_name IS 'Name of the AI model used to generate this embedding';
COMMENT ON COLUMN embeddings.model_provider IS 'Provider of the embedding model (openai, google, etc)';
COMMENT ON COLUMN embeddings.embedding_dimensions IS 'Dimensionality of the embedding vector';

-- =====================================================
-- 9. Function to get category statistics
-- =====================================================

CREATE OR REPLACE FUNCTION get_category_stats(category_uuid UUID)
RETURNS TABLE (
  entry_count BIGINT,
  published_count BIGINT,
  draft_count BIGINT,
  total_views BIGINT,
  last_updated TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as entry_count,
    COUNT(*) FILTER (WHERE status = 'published')::BIGINT as published_count,
    COUNT(*) FILTER (WHERE status = 'draft')::BIGINT as draft_count,
    COALESCE(SUM(view_count), 0)::BIGINT as total_views,
    MAX(updated_at) as last_updated
  FROM knowledge_entries
  WHERE category_id = category_uuid;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_category_stats IS 'Returns statistics for a knowledge category including entry counts and views';

-- =====================================================
-- 10. View for knowledge entries with bookmark status
-- =====================================================

CREATE OR REPLACE VIEW knowledge_entries_with_bookmarks AS
SELECT
  ke.*,
  EXISTS(
    SELECT 1 FROM knowledge_bookmarks kb
    WHERE kb.entry_id = ke.id AND kb.user_id = auth.uid()
  ) as is_bookmarked,
  (
    SELECT COUNT(*) FROM knowledge_bookmarks kb2
    WHERE kb2.entry_id = ke.id
  ) as bookmark_count
FROM knowledge_entries ke;

COMMENT ON VIEW knowledge_entries_with_bookmarks IS 'Knowledge entries with bookmark status for current user';

-- =====================================================
-- 11. Function to increment view count
-- =====================================================

CREATE OR REPLACE FUNCTION increment_view_count(entry_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE knowledge_entries
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = entry_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION increment_view_count IS 'Increments the view count for a knowledge entry';

-- =====================================================
-- 12. Add embedding model selection to ai_models
-- =====================================================

ALTER TABLE ai_models
ADD COLUMN IF NOT EXISTS is_default_embedding BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN ai_models.is_default_embedding IS 'Indicates if this is the default model for knowledge base embeddings';

-- Create index for quick lookup
CREATE INDEX IF NOT EXISTS idx_ai_models_default_embedding ON ai_models(is_default_embedding) WHERE is_default_embedding = true;

-- =====================================================
-- 13. Grant permissions
-- =====================================================

-- Grant access to the new table and functions
GRANT ALL ON knowledge_bookmarks TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_reading_time TO authenticated;
GRANT EXECUTE ON FUNCTION get_category_stats TO authenticated;
GRANT EXECUTE ON FUNCTION increment_view_count TO authenticated;
GRANT SELECT ON knowledge_entries_with_bookmarks TO authenticated;
