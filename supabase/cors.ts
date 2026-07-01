/**
 * CORS Configuration - Restricted to approved domains
 * SECURITY: DO NOT use '*' as origin - use explicit whitelist
 */

// List of allowed origins for API requests
const ALLOWED_ORIGINS = [
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'https://app.sjinnovation.com',
  'https://sjinnovation.com',
  'https://control-tower.sjinnovation.com',
  // sjinnovation.us production domains
  'https://dashboard.sjinnovation.us',
  'https://sjinnovation.us',
  // collabai.software production domain
  'https://controltower.collabai.software',
];

/**
 * Get CORS headers based on request origin
 * Only allows requests from whitelisted domains
 */
export function getCorsHeaders(origin: string | null): Record<string, string> {
  // Allow Lovable preview domains
  const isLovablePreview = origin?.endsWith('.lovableproject.com') || origin?.endsWith('.lovable.app');
  
  // Allow any sjinnovation.com subdomain
  const isSJInnovationCom = origin?.endsWith('.sjinnovation.com') || origin === 'https://sjinnovation.com';
  
  // Allow any sjinnovation.us subdomain
  const isSJInnovationUs = origin?.endsWith('.sjinnovation.us') || origin === 'https://sjinnovation.us';
  
  // Allow localhost
  const isLocalhost = origin?.startsWith('http://localhost:') || origin?.startsWith('http://127.0.0.1:');
  
  const isAllowed = origin && (isLovablePreview || isSJInnovationCom || isSJInnovationUs || isLocalhost);
  const allowedOrigin = isAllowed ? origin : ALLOWED_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Max-Age': '3600',
    'Access-Control-Allow-Credentials': 'true',
  };
}

/**
 * Default CORS headers (for backwards compatibility)
 * Use getCorsHeaders() with origin parameter instead
 * @deprecated Use getCorsHeaders(origin) for better security
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Max-Age': '3600',
};

/**
 * Handle CORS preflight request
 * @param origin - Request origin
 * @returns Response for OPTIONS request
 */
export function handleCorsPreflight(origin: string | null): Response {
  return new Response('ok', {
    headers: getCorsHeaders(origin),
    status: 200,
  });
}
