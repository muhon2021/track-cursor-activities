-- Admin-only RPC to compute storage usage metrics across all files.

CREATE OR REPLACE FUNCTION public.get_storage_metrics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB := '{}'::jsonb;
  provider TEXT;
  used_bytes BIGINT;
  now_iso TEXT := to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  FOREACH provider IN ARRAY ARRAY['local', 's3', 'supabase'] LOOP
    SELECT COALESCE(SUM(size), 0)
    INTO used_bytes
    FROM public.files
    WHERE storage_type = provider
      AND deleted_at IS NULL;

    result := result || jsonb_build_object(
      CASE WHEN provider = 'local' THEN 'root' ELSE provider END,
      jsonb_build_object(
        'provider', provider,
        'usedBytes', used_bytes,
        'totalBytes', NULL,
        'lastUpdated', now_iso,
        'isStale', false
      )
    );
  END LOOP;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_storage_metrics() TO authenticated;
