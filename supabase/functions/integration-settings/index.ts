/**
 * Integration Settings API — get/save primary integration preferences
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PRIMARY_INTEGRATION_CATEGORY_SLUGS = [
  'crm-systems',
  'project-management',
  'meeting-providers',
  'email-providers',
  'storage-productivity',
];

const KNOWLEDGE_CAPABLE_PROVIDER_SLUGS = [
  'confluence',
  'sharepoint',
  'google-drive',
  'google-workspace',
  'microsoft-365',
  'notion',
  'dropbox',
];

type KnowledgeSourceRef =
  | { kind: 'integration'; slug: string }
  | { kind: 'internal'; source_type: string };

interface PreferencesInput {
  primary_integrations: string[];
  primary_knowledge_sources: KnowledgeSourceRef[];
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizePreferences(raw: Record<string, unknown> | null): PreferencesInput {
  const primary_integrations = Array.isArray(raw?.primary_integrations)
    ? (raw.primary_integrations as unknown[]).filter(
        (s): s is string => typeof s === 'string' && s.length > 0
      )
    : [];

  const primary_knowledge_sources: KnowledgeSourceRef[] = [];
  if (Array.isArray(raw?.primary_knowledge_sources)) {
    for (const item of raw.primary_knowledge_sources) {
      if (!item || typeof item !== 'object') continue;
      const ref = item as Record<string, unknown>;
      if (ref.kind === 'integration' && typeof ref.slug === 'string' && ref.slug) {
        primary_knowledge_sources.push({ kind: 'integration', slug: ref.slug });
      } else if (
        ref.kind === 'internal' &&
        typeof ref.source_type === 'string' &&
        ref.source_type
      ) {
        primary_knowledge_sources.push({ kind: 'internal', source_type: ref.source_type });
      }
    }
  }

  return { primary_integrations, primary_knowledge_sources };
}

async function hasRole(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  role: string
): Promise<boolean> {
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', role)
    .maybeSingle();
  return !!data;
}

async function buildValidationContext(supabase: ReturnType<typeof createClient>) {
  const { data: providers, error: providersError } = await supabase
    .from('integration_providers')
    .select('slug, is_available, category:integration_categories(slug)')
    .eq('is_available', true);

  if (providersError) throw providersError;

  const { data: connections, error: connectionsError } = await supabase
    .from('organization_integrations')
    .select('connection_status, enabled, provider:integration_providers(slug)')
    .eq('connection_status', 'connected')
    .eq('enabled', true);

  if (connectionsError) throw connectionsError;

  const { data: internalSources, error: sourcesError } = await supabase
    .from('knowledge_sources')
    .select('source_type')
    .eq('is_active', true);

  if (sourcesError) throw sourcesError;

  const availableProviderSlugs = new Set<string>();
  const primaryCategoryProviderSlugs = new Set<string>();
  const knowledgeCapableSlugs = new Set<string>(
    KNOWLEDGE_CAPABLE_PROVIDER_SLUGS
  );

  for (const p of providers ?? []) {
    const slug = p.slug as string;
    availableProviderSlugs.add(slug);
    const categorySlug = (p.category as { slug?: string } | null)?.slug;
    if (categorySlug && PRIMARY_INTEGRATION_CATEGORY_SLUGS.includes(categorySlug)) {
      primaryCategoryProviderSlugs.add(slug);
    }
  }

  const connectedProviderSlugs = new Set<string>();
  for (const c of connections ?? []) {
    const slug = (c.provider as { slug?: string } | null)?.slug;
    if (slug) connectedProviderSlugs.add(slug);
  }

  const activeInternalSourceTypes = new Set<string>(
    (internalSources ?? []).map((s) => s.source_type as string)
  );

  return {
    availableProviderSlugs,
    primaryCategoryProviderSlugs,
    connectedProviderSlugs,
    knowledgeCapableSlugs,
    activeInternalSourceTypes,
  };
}

function sanitizePreferences(
  input: PreferencesInput,
  context: Awaited<ReturnType<typeof buildValidationContext>>
): { sanitized: PreferencesInput; warnings: string[] } {
  const warnings: string[] = [];
  const primary_integrations: string[] = [];
  const primary_knowledge_sources: KnowledgeSourceRef[] = [];
  const seenIntegrations = new Set<string>();
  const seenKnowledge = new Set<string>();

  for (const slug of input.primary_integrations) {
    if (seenIntegrations.has(slug)) continue;
    seenIntegrations.add(slug);

    if (!context.availableProviderSlugs.has(slug)) {
      warnings.push(`"${slug}" is not a valid integration.`);
      continue;
    }
    if (!context.primaryCategoryProviderSlugs.has(slug)) {
      warnings.push(`"${slug}" is not eligible as a primary integration.`);
      continue;
    }
    if (!context.connectedProviderSlugs.has(slug)) {
      warnings.push(`Selected integration "${slug}" is no longer connected.`);
      continue;
    }
    primary_integrations.push(slug);
  }

  for (const ref of input.primary_knowledge_sources) {
    const key =
      ref.kind === 'integration'
        ? `integration:${ref.slug}`
        : `internal:${ref.source_type}`;
    if (seenKnowledge.has(key)) continue;
    seenKnowledge.add(key);

    if (ref.kind === 'integration') {
      if (!context.knowledgeCapableSlugs.has(ref.slug)) {
        warnings.push(`"${ref.slug}" is not a valid knowledge source integration.`);
        continue;
      }
      if (!context.connectedProviderSlugs.has(ref.slug)) {
        warnings.push(
          `Knowledge source "${ref.slug}" must be connected before selection.`
        );
        continue;
      }
      primary_knowledge_sources.push(ref);
      continue;
    }

    if (!context.activeInternalSourceTypes.has(ref.source_type)) {
      warnings.push(
        `Internal knowledge source "${ref.source_type}" is not available for synchronization.`
      );
      continue;
    }
    primary_knowledge_sources.push(ref);
  }

  return {
    sanitized: { primary_integrations, primary_knowledge_sources },
    warnings,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'missing_auth', message: 'Authorization required' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser(token);

    if (userError || !user) {
      return jsonResponse({ error: 'invalid_token', message: 'Invalid or expired token' }, 401);
    }

    const isAdmin = await hasRole(supabaseAdmin, user.id, 'admin');
    const isModerator = await hasRole(supabaseAdmin, user.id, 'moderator');

    if (!isAdmin && !isModerator) {
      return jsonResponse({ error: 'forbidden', message: 'Admin access required' }, 403);
    }

    if (req.method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('integration_settings')
        .select('*')
        .is('organization_id', null)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        return jsonResponse({
          settings: {
            id: null,
            organization_id: null,
            primary_integrations: [],
            primary_knowledge_sources: [],
            updated_by: null,
            created_at: null,
            updated_at: null,
          },
        });
      }

      return jsonResponse({ settings: data });
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      if (!isAdmin) {
        return jsonResponse(
          { error: 'forbidden', message: 'Only administrators can save integration preferences' },
          403
        );
      }

      let body: Record<string, unknown> = {};
      try {
        body = await req.json();
      } catch {
        return jsonResponse({ error: 'invalid_body', message: 'Invalid JSON body' }, 400);
      }

      const input = normalizePreferences(body);
      const context = await buildValidationContext(supabaseAdmin);
      const { sanitized, warnings } = sanitizePreferences(input, context);

      const { data: existing } = await supabaseAdmin
        .from('integration_settings')
        .select('id')
        .is('organization_id', null)
        .maybeSingle();

      const payload = {
        organization_id: null,
        primary_integrations: sanitized.primary_integrations,
        primary_knowledge_sources: sanitized.primary_knowledge_sources,
        updated_by: user.id,
      };

      let settings;
      if (existing?.id) {
        const { data, error } = await supabaseAdmin
          .from('integration_settings')
          .update(payload)
          .eq('id', existing.id)
          .select('*')
          .single();
        if (error) throw error;
        settings = data;
      } else {
        const { data, error } = await supabaseAdmin
          .from('integration_settings')
          .insert(payload)
          .select('*')
          .single();
        if (error) throw error;
        settings = data;
      }

      return jsonResponse({ settings, warnings });
    }

    return jsonResponse({ error: 'method_not_allowed', message: 'Method not allowed' }, 405);
  } catch (error) {
    console.error('[integration-settings] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return jsonResponse({ error: 'server_error', message }, 500);
  }
});
