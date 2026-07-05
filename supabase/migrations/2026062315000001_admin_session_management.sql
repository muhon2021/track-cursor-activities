-- Admin Session Management (Sprint 4)
-- Lets users with org.view_sessions / org.terminate_sessions list and force-sign-out
-- other users' active sessions. Supabase's admin REST API doesn't expose per-session
-- listing/termination, so these SECURITY DEFINER functions operate directly on the
-- internal auth.sessions / auth.refresh_tokens tables and are exposed as RPCs.

CREATE OR REPLACE FUNCTION public.admin_list_user_sessions()
RETURNS TABLE (
  session_id UUID,
  user_id UUID,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  not_after TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_permission(auth.uid(), 'org.view_sessions') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.user_id,
    u.email::TEXT,
    p.full_name,
    s.created_at,
    s.updated_at,
    s.not_after
  FROM auth.sessions s
  JOIN auth.users u ON u.id = s.user_id
  LEFT JOIN public.profiles p ON p.id = s.user_id
  ORDER BY s.updated_at DESC NULLS LAST, s.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_terminate_session(p_session_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'org.terminate_sessions') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT user_id INTO v_user_id FROM auth.sessions WHERE id = p_session_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  UPDATE auth.refresh_tokens SET revoked = true WHERE session_id = p_session_id;
  DELETE FROM auth.sessions WHERE id = p_session_id;

  INSERT INTO public.activity_logs (user_id, action, resource_type, resource_id, details)
  VALUES (
    auth.uid(),
    'session.terminated',
    'auth_session',
    p_session_id,
    jsonb_build_object('target_user_id', v_user_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_terminate_user_sessions(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_permission(auth.uid(), 'org.terminate_sessions') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE auth.refresh_tokens
  SET revoked = true
  WHERE session_id IN (SELECT id FROM auth.sessions WHERE user_id = p_user_id);

  DELETE FROM auth.sessions WHERE user_id = p_user_id;

  INSERT INTO public.activity_logs (user_id, action, resource_type, resource_id, details)
  VALUES (
    auth.uid(),
    'session.terminated_all',
    'auth_session',
    p_user_id,
    jsonb_build_object('target_user_id', p_user_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_user_sessions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_terminate_session(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_terminate_user_sessions(UUID) TO authenticated;

COMMENT ON FUNCTION public.admin_list_user_sessions() IS
  'Lists all active auth sessions org-wide. Requires org.view_sessions permission.';
COMMENT ON FUNCTION public.admin_terminate_session(UUID) IS
  'Force-terminates a single session by revoking its refresh tokens and deleting the session row. Requires org.terminate_sessions permission.';
COMMENT ON FUNCTION public.admin_terminate_user_sessions(UUID) IS
  'Force-terminates every active session for a user. Requires org.terminate_sessions permission.';
