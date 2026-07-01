/**
 * Authentication Middleware for Edge Functions (bundled copy for _shared imports)
 */
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

export interface AuthContext {
  user: {
    id: string
    email?: string
    role?: string
  }
  token: string
}

export interface AuthError {
  status: number
  code: string
  message: string
}

export async function validateAuth(
  req: Request,
  supabase: SupabaseClient
): Promise<AuthContext> {
  const authHeader = req.headers.get('Authorization')

  if (!authHeader) {
    throw {
      status: 401,
      code: 'missing_auth_header',
      message: 'Authorization header is required',
    } as AuthError
  }

  if (!authHeader.startsWith('Bearer ')) {
    throw {
      status: 401,
      code: 'invalid_auth_format',
      message: 'Authorization header must use Bearer token format',
    } as AuthError
  }

  const token = authHeader.replace('Bearer ', '')

  if (!token || token.trim().length === 0) {
    throw {
      status: 401,
      code: 'empty_token',
      message: 'Bearer token cannot be empty',
    } as AuthError
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error) {
      console.error('[auth-middleware] Token validation failed:', error.message)
      throw {
        status: 401,
        code: 'invalid_token',
        message: error.message || 'Invalid or expired token',
      } as AuthError
    }

    if (!user) {
      throw {
        status: 401,
        code: 'user_not_found',
        message: 'User not found or token expired',
      } as AuthError
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      token,
    }
  } catch (error) {
    if ((error as AuthError).status) {
      throw error
    }

    console.error('[auth-middleware] Unexpected auth error:', error)
    throw {
      status: 500,
      code: 'auth_error',
      message: 'Authentication failed due to server error',
    } as AuthError
  }
}

export function authErrorResponse(
  error: AuthError,
  corsHeaders: Record<string, string>
): Response {
  return new Response(
    JSON.stringify({
      error: error.code,
      message: error.message,
      status: 'error',
    }),
    {
      status: error.status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    }
  )
}
