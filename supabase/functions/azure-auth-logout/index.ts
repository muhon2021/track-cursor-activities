/**
 * Azure AD SSO Logout Endpoint
 * Handles logout for both Azure AD and regular users
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

// Inline CORS handling (edge functions can't import from parent directories)
function getCorsHeaders(origin: string | null): Record<string, string> {
  const isLovablePreview = origin?.endsWith('.lovableproject.com') || origin?.endsWith('.lovable.app');
  const isSJInnovationCom = origin?.endsWith('.sjinnovation.com') || origin === 'https://sjinnovation.com';
  const isSJInnovationUs = origin?.endsWith('.sjinnovation.us') || origin === 'https://sjinnovation.us';
  const isLocalhost = origin?.startsWith('http://localhost:') || origin?.startsWith('http://127.0.0.1:');
  const isCollabAI = origin?.endsWith('.collabai.software') || origin === 'https://collabai.software';
  
  const isAllowed = origin && (isLovablePreview || isSJInnovationCom || isSJInnovationUs || isLocalhost || isCollabAI);
  const allowedOrigin = isAllowed ? origin : 'http://localhost:3000';

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '3600',
  };
}

const AZURE_AD_TENANT_ID = Deno.env.get('AZURE_AD_TENANT_ID') || 'common';

interface LogoutRequest {
  isAzureAD?: boolean;
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse request body
    const body: LogoutRequest = await req.json();
    const isAzureAD = body.isAzureAD || false;

    // Generate Azure logout URL if Azure AD user
    let logoutUrl: string | null = null;
    if (isAzureAD) {
      logoutUrl = `https://login.microsoftonline.com/${AZURE_AD_TENANT_ID}/oauth2/v2.0/logout?post_logout_redirect_uri=${encodeURIComponent(
        Deno.env.get('VITE_MICROSOFT_LOGOUT_URI') || 'http://localhost:5173/login'
      )}`;
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Logout successful',
        logoutUrl,
        isAzureAD,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: unknown) {
    console.error('Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        success: false,
        error: 'server_error',
        message: `Unexpected error: ${message}`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

