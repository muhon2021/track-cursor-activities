/**
 * Azure AD SSO Login Endpoint
 * Handles Azure token validation and user creation/login
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// CORS configuration
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'https://controltowerdemo.collabai.software',
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const isLovablePreview = origin?.endsWith('.lovableproject.com') || origin?.endsWith('.lovable.app');
  const isSJInnovation = origin?.endsWith('.sjinnovation.com') || origin?.endsWith('.sjinnovation.us');
  const isLocalhost = origin?.startsWith('http://localhost:') || origin?.startsWith('http://127.0.0.1:');
  const isCollabai = origin?.endsWith('.collabai.software');
  
  const isAllowed = origin && (isLovablePreview || isSJInnovation || isLocalhost || isCollabai || ALLOWED_ORIGINS.includes(origin));
  const allowedOrigin = isAllowed ? origin : ALLOWED_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Max-Age': '3600',
  };
}

const AZURE_AD_TENANT_ID = Deno.env.get('AZURE_AD_TENANT_ID') || '';
const AZURE_AD_CLIENT_ID = Deno.env.get('AZURE_AD_CLIENT_ID') || '';

interface LoginRequest {
  azureToken?: string;
  email?: string;
  password?: string;
}

interface MicrosoftGraphUser {
  id: string;
  userPrincipalName: string;
  givenName?: string;
  surname?: string;
  displayName?: string;
  mail?: string;
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 });
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Parse request body
    const body: LoginRequest = await req.json();

    // Handle Azure AD login
    if (body.azureToken) {
      // Validate Azure token with Microsoft Graph API
      const graphResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: {
          Authorization: `Bearer ${body.azureToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!graphResponse.ok) {
        const errorText = await graphResponse.text();
        console.error('Microsoft Graph API error:', errorText);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'invalid_azure_token',
            message: 'Failed to validate Azure token with Microsoft Graph API',
            details: errorText,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401,
          }
        );
      }

      const graphUser: MicrosoftGraphUser = await graphResponse.json();

      // Extract user info
      const email = (graphUser.mail || graphUser.userPrincipalName || '').toLowerCase();
      const azureADId = graphUser.id;
      const firstName = graphUser.givenName || '';
      const lastName = graphUser.surname || '';
      const fullName = graphUser.displayName || `${firstName} ${lastName}`.trim() || email;

      if (!email) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'missing_email',
            message: 'Email not found in Microsoft account',
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          }
        );
      }

      // Check if user exists in Supabase Auth
      let user;
      const { data: existingUsers } = await supabaseClient.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find((u) => u.email === email);

      if (existingUser) {
        user = existingUser;
      } else {
        // Auto-create user in Supabase Auth
        const { data: newUser, error: createError } = await supabaseClient.auth.admin.createUser({
          email,
          email_confirm: true, // Auto-confirm email for Azure AD users
          user_metadata: {
            full_name: fullName,
            azureADId,
            authMethod: 'azureAD',
            firstName,
            lastName,
          },
        });

        if (createError) {
          console.error('Error creating user:', createError);
          return new Response(
            JSON.stringify({
              success: false,
              error: 'user_creation_failed',
              message: 'Failed to create user account',
              details: createError.message,
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 500,
            }
          );
        }

        user = newUser.user;

        // Create profile record
        const { error: profileError } = await supabaseClient
          .from('profiles')
          .insert({
            id: user.id,
            email,
            full_name: fullName,
            azure_ad_id: azureADId,
          });

        if (profileError) {
          console.error('Error creating profile:', profileError);
          // Continue anyway - profile might be created by trigger
        }

        // Set default role (user)
        const { error: roleError } = await supabaseClient
          .from('user_roles')
          .insert({
            user_id: user.id,
            role: 'user',
          });

        if (roleError) {
          console.error('Error setting default role:', roleError);
          // Continue anyway
        }
      }

      // Get user role
      const { data: roleData } = await supabaseClient
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      // Get profile
      const { data: profileData } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      // Generate a session token for the user
      // We'll create a custom JWT token that the frontend can use
      const { data: sessionData, error: sessionError } = await supabaseClient.auth.admin.generateLink({
        type: 'magiclink',
        email: user.email!,
        options: {
          redirectTo: `${Deno.env.get('VITE_MICROSOFT_REDIRECT_URI') || 'http://localhost:5173'}/auth/callback`,
        },
      });

      if (sessionError) {
        console.error('Error generating session link:', sessionError);
        // Continue anyway - return user info and let frontend handle session
      }

      // Extract token from the link if available
      let sessionToken = null;
      if (sessionData?.properties?.action_link) {
        const url = new URL(sessionData.properties.action_link);
        sessionToken = url.searchParams.get('token') || url.hash.split('=')[1];
      }

      // Return success response with user info
      // The frontend will use Supabase OAuth callback to create the session
      return new Response(
        JSON.stringify({
          success: true,
          user: {
            id: user.id,
            email: user.email,
            userName: fullName,
            role: roleData?.role || 'user',
            isAzureAD: true,
          },
          profile: profileData,
          // Return user info - frontend will use Supabase OAuth to create session
          message: existingUser ? 'Login successful' : 'Account created and login successful',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Handle email/password login (existing flow)
    if (body.email && body.password) {
      const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
        email: body.email,
        password: body.password,
      });

      if (authError) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'authentication_failed',
            message: authError.message,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401,
          }
        );
      }

      // Get user role and profile
      const { data: roleData } = await supabaseClient
        .from('user_roles')
        .select('role')
        .eq('user_id', authData.user.id)
        .single();

      const { data: profileData } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      return new Response(
        JSON.stringify({
          success: true,
          token: authData.session?.access_token,
          user: {
            id: authData.user.id,
            email: authData.user.email,
            userName: profileData?.full_name || authData.user.email,
            role: roleData?.role || 'user',
            isAzureAD: false,
          },
          profile: profileData,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Invalid request
    return new Response(
      JSON.stringify({
        success: false,
        error: 'invalid_request',
        message: 'Either azureToken or email/password must be provided',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
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

