
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
