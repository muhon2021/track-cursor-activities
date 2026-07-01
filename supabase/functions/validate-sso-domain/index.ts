import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// Simple in-memory rate limiter (per edge function instance)
// In production, use a distributed cache like Redis
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 requests per minute per IP

function checkRateLimit(clientIp: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(clientIp);

  // Clean up expired entries periodically
  if (rateLimitMap.size > 1000) {
    for (const [key, value] of rateLimitMap.entries()) {
      if (value.resetAt < now) {
        rateLimitMap.delete(key);
      }
    }
  }

  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(clientIp, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  entry.count++;
  return true;
}

// Generic error message to prevent domain enumeration
const GENERIC_VALIDATION_ERROR = 'Unable to validate email for SSO. Please try again or contact support.';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get client IP for rate limiting and logging
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('cf-connecting-ip')
      || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // Check rate limit
    if (!checkRateLimit(clientIp)) {
      // Don't reveal rate limit details
      return new Response(
        JSON.stringify({ valid: false, message: GENERIC_VALIDATION_ERROR }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 }
      )
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Parse and validate request body
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return new Response(
        JSON.stringify({ valid: false, message: GENERIC_VALIDATION_ERROR }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const { email, provider_type } = requestBody;

    if (!email || typeof email !== 'string') {
      return new Response(
        JSON.stringify({ valid: false, message: GENERIC_VALIDATION_ERROR }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ valid: false, message: GENERIC_VALIDATION_ERROR }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Extract domain from email
    const domain = email.split('@')[1]?.toLowerCase()

    if (!domain) {
      return new Response(
        JSON.stringify({ valid: false, message: GENERIC_VALIDATION_ERROR }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // If provider_type is specified, validate against that provider's allowlist
    if (provider_type) {
      const { data: config, error: configError } = await supabaseClient
        .from('sso_configurations')
        .select('id, domain_restrictions')
        .eq('provider_type', provider_type)
        .eq('is_enabled', true)
        .single()

      if (configError || !config) {
        // Log the attempt with security context
        await supabaseClient
          .from('sso_login_logs')
          .insert({
            provider_type: provider_type || 'unknown',
            email: email.substring(0, 3) + '***@' + domain, // Partial email for privacy
            success: false,
            error_message: 'Provider not configured',
            metadata: {
              domain,
              validation_type: 'domain_check',
              client_ip: clientIp,
              user_agent: userAgent.substring(0, 200), // Truncate long user agents
            },
          })

        // Generic response - don't reveal provider configuration details
        return new Response(
          JSON.stringify({ valid: false, message: GENERIC_VALIDATION_ERROR }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }

      // Check domain allowlist
      const { data: allowedDomains } = await supabaseClient
        .from('sso_domain_allowlist')
        .select('domain')
        .eq('sso_config_id', config.id)
        .eq('is_active', true)

      // If no allowlist entries, all domains are allowed
      const isAllowed = !allowedDomains || allowedDomains.length === 0 ||
        allowedDomains.some((d) => d.domain.toLowerCase() === domain)

      // Log the validation attempt with security context
      await supabaseClient
        .from('sso_login_logs')
        .insert({
          provider_type,
          email: email.substring(0, 3) + '***@' + domain, // Partial email for privacy
          success: isAllowed,
          error_message: isAllowed ? null : 'Domain validation failed',
          metadata: {
            domain,
            validation_type: 'domain_check',
            client_ip: clientIp,
            user_agent: userAgent.substring(0, 200),
          },
        })

      // Generic response - don't reveal specific allowlist details
      return new Response(
        JSON.stringify({
          valid: isAllowed,
          message: isAllowed ? 'Validation successful' : GENERIC_VALIDATION_ERROR,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // No provider specified - check against all enabled providers
    const { data: configs } = await supabaseClient
      .from('sso_configurations')
      .select('id, provider_type, display_name')
      .eq('is_enabled', true)

    if (!configs || configs.length === 0) {
      return new Response(
        JSON.stringify({ valid: true, message: 'Validation successful' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Check which providers allow this domain
    const allowedProviders = []
    for (const config of configs) {
      const { data: allowedDomains } = await supabaseClient
        .from('sso_domain_allowlist')
        .select('domain')
        .eq('sso_config_id', config.id)
        .eq('is_active', true)

      // If no allowlist, all domains allowed for this provider
      if (!allowedDomains || allowedDomains.length === 0) {
        allowedProviders.push({
          provider_type: config.provider_type,
          display_name: config.display_name,
        })
        continue
      }

      // Check if domain is in allowlist
      if (allowedDomains.some((d) => d.domain.toLowerCase() === domain)) {
        allowedProviders.push({
          provider_type: config.provider_type,
          display_name: config.display_name,
        })
      }
    }

    const isValid = allowedProviders.length > 0;

    // Log the validation attempt
    await supabaseClient
      .from('sso_login_logs')
      .insert({
        provider_type: 'multi_provider_check',
        email: email.substring(0, 3) + '***@' + domain,
        success: isValid,
        error_message: isValid ? null : 'Domain validation failed',
        metadata: {
          domain,
          validation_type: 'domain_check',
          client_ip: clientIp,
          user_agent: userAgent.substring(0, 200),
          providers_checked: configs.length,
        },
      })

    // Return allowed providers without revealing domain status for disallowed ones
    return new Response(
      JSON.stringify({
        valid: isValid,
        allowed_providers: isValid ? allowedProviders : [],
        message: isValid ? 'Validation successful' : GENERIC_VALIDATION_ERROR,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: unknown) {
    console.error('Validate SSO domain error:', error)
    // Generic error - don't expose internal details
    return new Response(
      JSON.stringify({ valid: false, message: GENERIC_VALIDATION_ERROR }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
