import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Graphify RPCs (match, traverse) filter via auth.uid() in graphify_can_access_entity.
 * Service-role clients have no uid, so graph search returns empty. Use the caller's JWT
 * for graph operations while keeping service role for embeddings / admin writes.
 */
export function resolveGraphAuthClient(
  req: Request,
  adminClient: SupabaseClient
): SupabaseClient {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return adminClient
  }

  const token = authHeader.slice(7).trim()
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!token || token === serviceKey) {
    return adminClient
  }

  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  if (!url || !anonKey) {
    return adminClient
  }

  return createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
}
