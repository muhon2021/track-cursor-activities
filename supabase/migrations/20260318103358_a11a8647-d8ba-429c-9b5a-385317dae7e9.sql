-- 1) Agent setting: rag_enabled
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ai_agents'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ai_agents' AND column_name = 'rag_enabled'
  ) THEN
    ALTER TABLE public.ai_agents
      ADD COLUMN rag_enabled BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END $$;

-- 2) Ensure embedding_queue supports tasks if used elsewhere (non-breaking)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'embedding_queue' AND column_name = 'entity_type'
  ) THEN
    BEGIN
      ALTER TABLE public.embedding_queue
        DROP CONSTRAINT IF EXISTS embedding_queue_entity_type_check;
    EXCEPTION
      WHEN undefined_object THEN NULL;
    END;

    ALTER TABLE public.embedding_queue
      ADD CONSTRAINT embedding_queue_entity_type_check
      CHECK (entity_type IN ('file', 'entry', 'meeting', 'user_file', 'task'));
  END IF;
END $$;

-- 3) Delete embeddings when a task is deleted
CREATE OR REPLACE FUNCTION public.delete_task_embeddings()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.embeddings e
  WHERE e.entity_type = 'task'
    AND e.entity_id::text = OLD.id::text;
  RETURN OLD;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_delete_task_embeddings') THEN
    CREATE TRIGGER trg_delete_task_embeddings
      AFTER DELETE ON public.tasks
      FOR EACH ROW
      EXECUTE FUNCTION public.delete_task_embeddings();
  END IF;
END $$;