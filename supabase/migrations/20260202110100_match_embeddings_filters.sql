-- Extend match_embeddings to support optional entity_type and user_id filters
CREATE OR REPLACE FUNCTION match_embeddings(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  filter_entity_type text DEFAULT NULL,
  filter_user_id uuid DEFAULT NULL,
  p_user_id uuid DEFAULT NULL  -- alias for filter_user_id for backward compatibility
)
RETURNS TABLE (
  id uuid,
  entity_type text,
  entity_id text,
  content text,
  metadata jsonb,
  user_id uuid,
  similarity float,
  unified_document_id uuid
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.entity_type,
    e.entity_id::text,
    e.content,
    e.metadata,
    e.user_id,
    (1 - (e.embedding <=> query_embedding))::float as similarity,
    e.unified_document_id
  FROM public.embeddings e
  WHERE (1 - (e.embedding <=> query_embedding)) > match_threshold
    AND (filter_entity_type IS NULL OR e.entity_type = filter_entity_type)
    AND (COALESCE(filter_user_id, p_user_id) IS NULL OR e.user_id = COALESCE(filter_user_id, p_user_id))
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION match_embeddings IS 'Vector similarity search with optional entity_type and user_id filters';
