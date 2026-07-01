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