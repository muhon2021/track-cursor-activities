import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { validateAuth, authErrorResponse, type AuthError } from './auth-middleware.ts'

export async function requireAdmin(
  req: Request,
  supabase: SupabaseClient,
  corsHeaders: Record<string, string>
): Promise<{ userId: string } | Response> {
  try {
    const auth = await validateAuth(req, supabase)
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: auth.user.id,
      _role: 'admin',
    })
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    return { userId: auth.user.id }
  } catch (err) {
    return authErrorResponse(err as AuthError, corsHeaders)
  }
}
