-- Fix Graphify access when agent/RAG calls RPCs with service role + acting_user_id.
-- graphify_can_access_entity used get_user_tenant_id() which reads auth.uid() (NULL under service role).

CREATE OR REPLACE FUNCTION public.get_tenant_id_for_user(p_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT r.tenant_id
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = p_user_id
      ORDER BY CASE r.slug
        WHEN 'owner' THEN 1
        WHEN 'admin' THEN 2
        WHEN 'manager' THEN 3
        WHEN 'member' THEN 4
        WHEN 'viewer' THEN 5
        ELSE 6
      END
      LIMIT 1
    ),
    '00000000-0000-0000-0000-000000000001'::UUID
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_tenant_id_for_user(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.graphify_effective_user_id(p_caller_user_id UUID DEFAULT NULL)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    -- Service-role edge functions pass acting_user_id; auth.uid() is NULL
    WHEN p_caller_user_id IS NOT NULL AND auth.uid() IS NULL THEN p_caller_user_id
    ELSE auth.uid()
  END;
$$;

CREATE OR REPLACE FUNCTION public.graphify_can_access_entity(
  p_user_id UUID,
  p_entity_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entity public.graph_entities%ROWTYPE;
  v_owner UUID;
  v_source_id UUID;
  v_tenant_id UUID;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO v_entity FROM public.graph_entities WHERE id = p_entity_id AND status = 'active';
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF auth.uid() IS NOT NULL THEN
    v_tenant_id := public.get_user_tenant_id();
  ELSE
    v_tenant_id := public.get_tenant_id_for_user(p_user_id);
  END IF;

  IF v_entity.tenant_id <> v_tenant_id THEN
    RETURN false;
  END IF;

  IF public.has_role(p_user_id, 'admin') OR public.has_permission(p_user_id, 'graphify.manage') THEN
    RETURN true;
  END IF;

  v_owner := NULLIF(v_entity.metadata->>'user_id', '')::UUID;

  IF v_entity.source_table = 'agent_memories' AND v_entity.source_id IS NOT NULL THEN
    SELECT am.user_id INTO v_owner FROM public.agent_memories am
    WHERE am.id = v_entity.source_id AND am.deleted_at IS NULL;
    IF v_owner IS NOT NULL AND v_owner <> p_user_id THEN
      RETURN false;
    END IF;
    RETURN true;
  END IF;

  IF v_entity.source_table = 'user_knowledge_files' AND v_entity.source_id IS NOT NULL THEN
    SELECT ukf.user_id INTO v_owner FROM public.user_knowledge_files ukf
    WHERE ukf.id = v_entity.source_id;
    IF v_owner IS NOT NULL AND v_owner <> p_user_id THEN
      RETURN false;
    END IF;
    RETURN true;
  END IF;

  IF v_entity.source_table IN ('knowledge_files', 'unified_documents') AND v_entity.source_id IS NOT NULL THEN
    IF v_entity.source_table = 'knowledge_files' THEN
      SELECT kf.source_id INTO v_source_id FROM public.knowledge_files kf WHERE kf.id = v_entity.source_id;
      IF v_source_id IS NOT NULL AND NOT public.check_kb_source_permission(v_source_id, 'view') THEN
        RETURN false;
      END IF;
    END IF;
  END IF;

  IF v_owner IS NOT NULL AND v_owner <> p_user_id THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.graphify_can_access_entity(UUID, UUID) TO authenticated, service_role;
