/**
 * Standardized response helpers for edge functions
 */

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  details?: unknown;
}

export function successResponse<T>(
  data: T,
  corsHeaders: Record<string, string>,
  status = 200,
): Response {
  return new Response(JSON.stringify({ success: true, data } as ApiResponse<T>), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function errorResponse(
  error: string,
  corsHeaders: Record<string, string>,
  status = 500,
  details?: unknown,
): Response {
  return new Response(
    JSON.stringify({ success: false, error, details } as ApiResponse),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

export function unauthorizedResponse(
  message: string,
  corsHeaders: Record<string, string>,
): Response {
  return errorResponse(message, corsHeaders, 401);
}
