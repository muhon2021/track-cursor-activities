/**
 * Integration Preferences — constants, types, validation, and reusable getters
 * for Primary Integrations and Primary Knowledge Sources.
 */

import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export type IntegrationSettingsRow =
  Database['public']['Tables']['integration_settings']['Row'];

/** Categories eligible for Primary Integrations selection */
export const PRIMARY_INTEGRATION_CATEGORY_SLUGS = [
  'crm-systems',
  'project-management',
  'meeting-providers',
  'email-providers',
  'storage-productivity',
] as const;

/** Categories where only one org-wide default is allowed — no "users can choose" */
export const ADMIN_ONLY_INTEGRATION_CATEGORY_SLUGS = [
  'crm-systems',
  'project-management',
  'meeting-providers',
  'email-providers',
  'storage-productivity',
] as const;

/** Integration providers that can serve as knowledge sources */
export const KNOWLEDGE_CAPABLE_PROVIDER_SLUGS = [
  'confluence',
  'sharepoint',
  'google-drive',
  'google-workspace',
  'microsoft-365',
  'notion',
  'dropbox',
] as const;

/** Internal knowledge_sources.source_type values selectable as primary sources */
export const INTERNAL_KNOWLEDGE_SOURCE_TYPES = [
  'upload',
  'meeting',
  'google_drive',
] as const;

export type PrimaryIntegrationCategorySlug =
  (typeof PRIMARY_INTEGRATION_CATEGORY_SLUGS)[number];

export type KnowledgeCapableProviderSlug =
  (typeof KNOWLEDGE_CAPABLE_PROVIDER_SLUGS)[number];

export type InternalKnowledgeSourceType =
  (typeof INTERNAL_KNOWLEDGE_SOURCE_TYPES)[number];

export type IntegrationKnowledgeSourceRef = {
  kind: 'integration';
  slug: string;
};

export type InternalKnowledgeSourceRef = {
  kind: 'internal';
  source_type: string;
};

export type PrimaryKnowledgeSourceRef =
  | IntegrationKnowledgeSourceRef
  | InternalKnowledgeSourceRef;

export interface IntegrationPreferencesInput {
  primary_integrations: string[];
  primary_knowledge_sources: PrimaryKnowledgeSourceRef[];
}

export interface IntegrationPreferenceOption {
  value: string;
  label: string;
  description?: string;
  categoryLabel?: string;
  connectionStatus?: string | null;
  lastSyncAt?: string | null;
  isSelectable: boolean;
  disabledReason?: string;
  kind: 'integration' | 'internal';
  slug?: string;
  sourceType?: string;
}

export interface ValidationContext {
  connectedProviderSlugs: Set<string>;
  availableProviderSlugs: Set<string>;
  primaryCategoryProviderSlugs: Set<string>;
  knowledgeCapableSlugs: Set<string>;
  activeInternalSourceTypes: Set<string>;
}

export interface SanitizedPreferencesResult {
  primary_integrations: string[];
  primary_knowledge_sources: PrimaryKnowledgeSourceRef[];
  warnings: string[];
}

export const DEFAULT_INTEGRATION_PREFERENCES: IntegrationPreferencesInput = {
  primary_integrations: [],
  primary_knowledge_sources: [],
};

export function knowledgeSourceRefKey(ref: PrimaryKnowledgeSourceRef): string {
  return ref.kind === 'integration'
    ? `integration:${ref.slug}`
    : `internal:${ref.source_type}`;
}

export function parseKnowledgeSourceRefKey(key: string): PrimaryKnowledgeSourceRef | null {
  if (key.startsWith('integration:')) {
    const slug = key.slice('integration:'.length);
    return slug ? { kind: 'integration', slug } : null;
  }
  if (key.startsWith('internal:')) {
    const source_type = key.slice('internal:'.length);
    return source_type ? { kind: 'internal', source_type } : null;
  }
  return null;
}

export function keysToKnowledgeSourceRefs(keys: string[]): PrimaryKnowledgeSourceRef[] {
  return keys
    .map(parseKnowledgeSourceRefKey)
    .filter((ref): ref is PrimaryKnowledgeSourceRef => ref !== null);
}

export function normalizeIntegrationPreferences(
  raw: Partial<IntegrationPreferencesInput> | null | undefined
): IntegrationPreferencesInput {
  if (!raw) return { ...DEFAULT_INTEGRATION_PREFERENCES };

  const primary_integrations = Array.isArray(raw.primary_integrations)
    ? raw.primary_integrations.filter((s): s is string => typeof s === 'string' && s.length > 0)
    : [];

  const primary_knowledge_sources: PrimaryKnowledgeSourceRef[] = [];
  if (Array.isArray(raw.primary_knowledge_sources)) {
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

export function sanitizeIntegrationPreferences(
  input: IntegrationPreferencesInput,
  context: ValidationContext
): SanitizedPreferencesResult {
  const warnings: string[] = [];
  const primary_integrations: string[] = [];
  const primary_knowledge_sources: PrimaryKnowledgeSourceRef[] = [];
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
    const key = knowledgeSourceRefKey(ref);
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

  return { primary_integrations, primary_knowledge_sources, warnings };
}

async function fetchGlobalSettingsRow(): Promise<IntegrationSettingsRow | null> {
  const { data, error } = await supabase
    .from('integration_settings')
    .select('*')
    .is('organization_id', null)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/** Reusable getter for future AI / Knowledge / Memory modules */
export async function getPrimaryIntegrations(): Promise<string[]> {
  const row = await fetchGlobalSettingsRow();
  return normalizeIntegrationPreferences(
    row as unknown as IntegrationPreferencesInput | null
  ).primary_integrations;
}

/** Reusable getter for future AI / Knowledge / Memory modules */
export async function getPrimaryKnowledgeSources(): Promise<PrimaryKnowledgeSourceRef[]> {
  const row = await fetchGlobalSettingsRow();
  return normalizeIntegrationPreferences(
    row as unknown as IntegrationPreferencesInput | null
  ).primary_knowledge_sources;
}

export async function getIntegrationPreferences(): Promise<IntegrationPreferencesInput> {
  const row = await fetchGlobalSettingsRow();
  return normalizeIntegrationPreferences(row as unknown as IntegrationPreferencesInput | null);
}

/** Build validation context from live integration and knowledge source data */
export async function buildValidationContext(): Promise<ValidationContext> {
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
  const knowledgeCapableSlugs = new Set<string>(KNOWLEDGE_CAPABLE_PROVIDER_SLUGS);

  for (const p of providers ?? []) {
    availableProviderSlugs.add(p.slug);
    const categorySlug = (p.category as { slug?: string } | null)?.slug;
    if (
      categorySlug &&
      (PRIMARY_INTEGRATION_CATEGORY_SLUGS as readonly string[]).includes(categorySlug)
    ) {
      primaryCategoryProviderSlugs.add(p.slug);
    }
  }

  const connectedProviderSlugs = new Set<string>();
  for (const c of connections ?? []) {
    const slug = (c.provider as { slug?: string } | null)?.slug;
    if (slug) connectedProviderSlugs.add(slug);
  }

  const activeInternalSourceTypes = new Set<string>(
    (internalSources ?? []).map((s) => s.source_type)
  );

  return {
    availableProviderSlugs,
    primaryCategoryProviderSlugs,
    connectedProviderSlugs,
    knowledgeCapableSlugs,
    activeInternalSourceTypes,
  };
}

/** Pages where synced integration data can be shown to users */
export const PM_DATA_DESTINATIONS = ['projects', 'tasks'] as const;
export const CRM_DATA_DESTINATIONS = ['clients', 'deals', 'contacts'] as const;
export const MEETING_DATA_DESTINATIONS = ['schedule', 'transcripts'] as const;
export const EMAIL_DATA_DESTINATIONS = [
  'lead-followup',
  'contacts',
  'notifications',
] as const;

export const INTEGRATION_DATA_DESTINATIONS = [
  ...PM_DATA_DESTINATIONS,
  ...CRM_DATA_DESTINATIONS,
  ...MEETING_DATA_DESTINATIONS,
  'lead-followup',
  'notifications',
] as const;

export type IntegrationDataDestination =
  (typeof INTEGRATION_DATA_DESTINATIONS)[number];

export const CATEGORY_DATA_DESTINATION_OPTIONS: Partial<
  Record<PrimaryIntegrationCategorySlug, readonly IntegrationDataDestination[]>
> = {
  'project-management': PM_DATA_DESTINATIONS,
  'crm-systems': CRM_DATA_DESTINATIONS,
  'meeting-providers': MEETING_DATA_DESTINATIONS,
  'email-providers': EMAIL_DATA_DESTINATIONS,
};

export function getDefaultDataDestinationsForCategory(
  category: PrimaryIntegrationCategorySlug
): IntegrationDataDestination[] {
  const options = CATEGORY_DATA_DESTINATION_OPTIONS[category];
  return options ? [...options] : [];
}

export function categorySupportsDataDestinations(
  category: PrimaryIntegrationCategorySlug
): boolean {
  return Boolean(CATEGORY_DATA_DESTINATION_OPTIONS[category]?.length);
}

/** Keep only destinations valid for a category (strips cross-category leaks from saved settings) */
export function filterDestinationsForCategory(
  category: PrimaryIntegrationCategorySlug,
  destinations: IntegrationDataDestination[]
): IntegrationDataDestination[] {
  const allowed = new Set(
    CATEGORY_DATA_DESTINATION_OPTIONS[category] ??
      getDefaultDataDestinationsForCategory(category)
  );
  return destinations.filter((d) => allowed.has(d));
}

export const DEFAULT_PM_DATA_DESTINATIONS: IntegrationDataDestination[] = [
  'projects',
  'tasks',
];

export const DEFAULT_CRM_DATA_DESTINATIONS: IntegrationDataDestination[] = [
  'clients',
  'deals',
  'contacts',
];

export const DEFAULT_MEETING_DATA_DESTINATIONS: IntegrationDataDestination[] = [
  'schedule',
  'transcripts',
];

export const DEFAULT_EMAIL_DATA_DESTINATIONS: IntegrationDataDestination[] = [
  'lead-followup',
  'contacts',
  'notifications',
];

export const INTEGRATION_DATA_DESTINATION_LABELS: Record<
  IntegrationDataDestination,
  string
> = {
  projects: 'Projects',
  tasks: 'Tasks',
  clients: 'Clients',
  deals: 'Deals',
  contacts: 'Contacts',
  schedule: 'Meeting Schedule',
  transcripts: 'Transcripts',
  'lead-followup': 'Lead Follow-Up',
  notifications: 'Notifications',
};

/** PM providers that sync into projects and/or tasks tables */
export const PM_SYNC_PROVIDER_SLUGS = [
  'clickup',
  'jira',
  'activecollab',
  'workamajig',
] as const;

export type PMSyncProviderSlug = (typeof PM_SYNC_PROVIDER_SLUGS)[number];

export function isPMSyncProvider(slug: string): slug is PMSyncProviderSlug {
  return (PM_SYNC_PROVIDER_SLUGS as readonly string[]).includes(slug);
}

/** CRM providers with implemented sync in this app */
export const CRM_SYNC_PROVIDER_SLUGS = ['zoho-crm'] as const;

export type CrmSyncProviderSlug = (typeof CRM_SYNC_PROVIDER_SLUGS)[number];

export function isCrmSyncProvider(slug: string): slug is CrmSyncProviderSlug {
  return (CRM_SYNC_PROVIDER_SLUGS as readonly string[]).includes(slug);
}

/** Meeting providers with implemented sync in this app */
export const MEETING_SYNC_PROVIDER_SLUGS = [
  'zoom',
  'microsoft-teams',
  'google-meet',
] as const;

export type MeetingSyncProviderSlug = (typeof MEETING_SYNC_PROVIDER_SLUGS)[number];

export function isMeetingSyncProvider(slug: string): slug is MeetingSyncProviderSlug {
  return (MEETING_SYNC_PROVIDER_SLUGS as readonly string[]).includes(slug);
}

/** Email providers with implemented sync in this app */
export const EMAIL_SYNC_PROVIDER_SLUGS = ['sendgrid', 'outlook'] as const;

export type EmailSyncProviderSlug = (typeof EMAIL_SYNC_PROVIDER_SLUGS)[number];

export function isEmailSyncProvider(slug: string): slug is EmailSyncProviderSlug {
  return (EMAIL_SYNC_PROVIDER_SLUGS as readonly string[]).includes(slug);
}

export function isCategorySyncProvider(
  category: PrimaryIntegrationCategorySlug,
  slug: string
): boolean {
  if (category === 'project-management') return isPMSyncProvider(slug);
  if (category === 'crm-systems') return isCrmSyncProvider(slug);
  if (category === 'meeting-providers') return isMeetingSyncProvider(slug);
  if (category === 'email-providers') return isEmailSyncProvider(slug);
  return false;
}

/** Per-category primary integration + multi-source preferences */
export interface CategoryIntegrationPreference {
  primary_slug: string | null;
  active_slugs: string[];
  /** When true, only one provider is active and used across the app for this category */
  single_active_only: boolean;
  /** Default pages where synced data appears for this category */
  data_destinations?: IntegrationDataDestination[];
  /** Per-provider page overrides (e.g. ClickUp → projects+tasks, Float → future page) */
  provider_data_destinations?: Partial<
    Record<string, IntegrationDataDestination[]>
  >;
}

export type PrimaryByCategory = Record<
  PrimaryIntegrationCategorySlug,
  CategoryIntegrationPreference
>;

function emptyCategoryPreference(
  category?: PrimaryIntegrationCategorySlug
): CategoryIntegrationPreference {
  return {
    primary_slug: null,
    active_slugs: [],
    single_active_only: false,
    data_destinations: category
      ? getDefaultDataDestinationsForCategory(category)
      : [],
    provider_data_destinations: {},
  };
}

const PRIMARY_CATEGORY_MATCHERS: {
  key: PrimaryIntegrationCategorySlug;
  slugs: string[];
  nameHints: string[];
}[] = [
  {
    key: 'meeting-providers',
    slugs: ['meeting-providers', 'meeting-provider', 'meetings', 'meeting-platforms'],
    nameHints: ['meeting'],
  },
  {
    key: 'email-providers',
    slugs: ['email-providers', 'email-provider', 'email', 'email-services'],
    nameHints: ['email'],
  },
  {
    key: 'storage-productivity',
    slugs: ['storage-productivity', 'storage', 'storage-productivity-tools'],
    nameHints: ['storage'],
  },
  {
    key: 'crm-systems',
    slugs: ['crm-systems', 'crm', 'crm-providers'],
    nameHints: ['crm'],
  },
  {
    key: 'project-management',
    slugs: ['project-management', 'project-management-tools', 'pm-tools'],
    nameHints: ['project management', 'project-management'],
  },
];

/** Map DB category slug/name to canonical primary_by_category key */
export function resolvePrimaryCategorySlug(
  slug: string,
  name?: string
): PrimaryIntegrationCategorySlug | null {
  const normalized = slug.toLowerCase().replace(/_/g, '-').trim();
  const normalizedName = name?.trim().toLowerCase() ?? '';

  for (const rule of PRIMARY_CATEGORY_MATCHERS) {
    if (rule.slugs.includes(normalized)) return rule.key;
    if (rule.nameHints.some((hint) => normalizedName.includes(hint))) return rule.key;
  }

  if ((PRIMARY_INTEGRATION_CATEGORY_SLUGS as readonly string[]).includes(normalized)) {
    return normalized as PrimaryIntegrationCategorySlug;
  }

  return null;
}

export function isCategoryWithTabPreferences(
  slug: string,
  name?: string
): slug is PrimaryIntegrationCategorySlug {
  return resolvePrimaryCategorySlug(slug, name) !== null;
}

/** CRM and similar categories — org must pick one admin default; users cannot choose */
export function isCategoryAdminDefaultOnly(slug: string, name?: string): boolean {
  const resolved = resolvePrimaryCategorySlug(slug, name);
  return (
    resolved !== null &&
    (ADMIN_ONLY_INTEGRATION_CATEGORY_SLUGS as readonly string[]).includes(resolved)
  );
}

/** Whether a provider should be offered in app flows for a category (meetings, email, etc.) */
export function shouldShowProviderForCategory(
  providerSlug: string,
  pref: CategoryIntegrationPreference | null | undefined
): boolean {
  if (!pref) return true;

  if (pref.single_active_only) {
    if (!pref.primary_slug) return true;
    return providerSlug === pref.primary_slug;
  }

  if (pref.active_slugs.length === 0) return true;
  return pref.active_slugs.includes(providerSlug);
}

function normalizeDataDestinations(
  raw: unknown
): IntegrationDataDestination[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const valid = raw.filter(
    (d): d is IntegrationDataDestination =>
      typeof d === 'string' &&
      (INTEGRATION_DATA_DESTINATIONS as readonly string[]).includes(d)
  );
  return valid.length > 0 ? valid : undefined;
}

function normalizeProviderDataDestinations(
  raw: unknown
): Partial<Record<string, IntegrationDataDestination[]>> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const result: Partial<Record<string, IntegrationDataDestination[]>> = {};
  for (const [slug, destinations] of Object.entries(
    raw as Record<string, unknown>
  )) {
    const normalized = normalizeDataDestinations(destinations);
    if (normalized?.length) result[slug] = normalized;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

/** Resolve which app pages show synced data for a provider in a category */
export function getDataDestinationsForProvider(
  pref: CategoryIntegrationPreference | null | undefined,
  providerSlug: string | null | undefined,
  category?: PrimaryIntegrationCategorySlug
): IntegrationDataDestination[] {
  const fallback = category
    ? getDefaultDataDestinationsForCategory(category)
    : [...DEFAULT_PM_DATA_DESTINATIONS];

  if (!pref) return fallback;
  if (providerSlug && pref.provider_data_destinations?.[providerSlug]?.length) {
    const perProvider = pref.provider_data_destinations[providerSlug]!;
    return category
      ? filterDestinationsForCategory(category, perProvider)
      : perProvider;
  }
  if (pref.data_destinations?.length) {
    return category
      ? filterDestinationsForCategory(category, pref.data_destinations)
      : pref.data_destinations;
  }
  return fallback;
}

export function shouldShowSyncedDataOnPage(
  pref: CategoryIntegrationPreference | null | undefined,
  providerSlug: string | null | undefined,
  page: IntegrationDataDestination,
  category?: PrimaryIntegrationCategorySlug
): boolean {
  return getDataDestinationsForProvider(pref, providerSlug, category).includes(page);
}

export function normalizePrimaryByCategory(
  raw: unknown
): Partial<PrimaryByCategory> {
  const result: Partial<PrimaryByCategory> = {};
  if (!raw || typeof raw !== 'object') return result;

  for (const category of PRIMARY_INTEGRATION_CATEGORY_SLUGS) {
    const entry = (raw as Record<string, unknown>)[category];
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const active_slugs = Array.isArray(e.active_slugs)
      ? e.active_slugs.filter((s): s is string => typeof s === 'string' && s.length > 0)
      : [];
    const primary_slug =
      typeof e.primary_slug === 'string' && e.primary_slug.length > 0
        ? e.primary_slug
        : null;
    const single_active_only =
      e.single_active_only === true || isCategoryAdminDefaultOnly(category);
    const data_destinations = normalizeDataDestinations(e.data_destinations);
    const provider_data_destinations = normalizeProviderDataDestinations(
      e.provider_data_destinations
    );
    result[category] = {
      primary_slug,
      active_slugs,
      single_active_only,
      ...(data_destinations ? { data_destinations } : {}),
      ...(provider_data_destinations ? { provider_data_destinations } : {}),
    };
  }

  return result;
}

function sanitizePrimaryByCategory(
  input: Partial<PrimaryByCategory>,
  context: ValidationContext
): { value: PrimaryByCategory; warnings: string[] } {
  const warnings: string[] = [];
  const value = {} as PrimaryByCategory;

  for (const category of PRIMARY_INTEGRATION_CATEGORY_SLUGS) {
    const entry = input[category] ?? emptyCategoryPreference(category);

    let active_slugs = entry.active_slugs.filter((slug) => {
      if (!context.availableProviderSlugs.has(slug)) {
        warnings.push(`"${slug}" is not a valid integration.`);
        return false;
      }
      if (!context.connectedProviderSlugs.has(slug)) {
        warnings.push(`Selected integration "${slug}" is no longer connected.`);
        return false;
      }
      return true;
    });

    let primary_slug = entry.primary_slug;

    if (
      primary_slug &&
      context.connectedProviderSlugs.has(primary_slug) &&
      !active_slugs.includes(primary_slug)
    ) {
      active_slugs = [primary_slug, ...active_slugs];
    }

    if (primary_slug && !active_slugs.includes(primary_slug)) {
      warnings.push(
        `Primary integration "${primary_slug}" for ${category} must also be an active source.`
      );
      primary_slug = active_slugs[0] ?? null;
    }

    const rawDestinations =
      normalizeDataDestinations(entry.data_destinations) ??
      getDefaultDataDestinationsForCategory(category);
    const data_destinations = filterDestinationsForCategory(category, rawDestinations);

    const rawProviderDestinations =
      normalizeProviderDataDestinations(entry.provider_data_destinations) ?? {};
    const provider_data_destinations: Partial<
      Record<string, IntegrationDataDestination[]>
    > = {};
    for (const [slug, dests] of Object.entries(rawProviderDestinations)) {
      const filtered = filterDestinationsForCategory(category, dests ?? []);
      if (filtered.length) provider_data_destinations[slug] = filtered;
    }

    value[category] = {
      primary_slug,
      active_slugs,
      single_active_only:
        typeof entry.single_active_only === 'boolean'
          ? entry.single_active_only
          : isCategoryAdminDefaultOnly(category),
      data_destinations:
        data_destinations.length > 0
          ? data_destinations
          : getDefaultDataDestinationsForCategory(category),
      provider_data_destinations,
    };
  }

  return { value, warnings };
}

export async function getPrimaryByCategorySettings(): Promise<Partial<PrimaryByCategory>> {
  const row = await fetchGlobalSettingsRow();
  return normalizePrimaryByCategory(row?.primary_by_category);
}

/** Reusable getter for downstream consumers (Contacts, Deals, etc.) */
export async function getPrimaryFor(
  category: PrimaryIntegrationCategorySlug
): Promise<string | null> {
  const row = await fetchGlobalSettingsRow();
  const byCategory = normalizePrimaryByCategory(row?.primary_by_category);
  return byCategory[category]?.primary_slug ?? null;
}

/** Reusable getter for downstream consumers (Contacts, Deals, etc.) */
export async function getActiveSourcesFor(
  category: PrimaryIntegrationCategorySlug
): Promise<string[]> {
  const row = await fetchGlobalSettingsRow();
  const byCategory = normalizePrimaryByCategory(row?.primary_by_category);
  return byCategory[category]?.active_slugs ?? [];
}

/** Persist per-category integration preferences via Supabase (RLS-enforced) */
export async function savePrimaryByCategory(
  input: Partial<PrimaryByCategory>
): Promise<{ primary_by_category: PrimaryByCategory; warnings: string[] }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const context = await buildValidationContext();
  const { value, warnings } = sanitizePrimaryByCategory(input, context);

  const { data: existing, error: fetchError } = await supabase
    .from('integration_settings')
    .select('id')
    .is('organization_id', null)
    .maybeSingle();

  if (fetchError) throw fetchError;

  const payload = {
    organization_id: null,
    primary_by_category: value as unknown as IntegrationSettingsRow['primary_by_category'],
    updated_by: user.id,
  };

  if (existing?.id) {
    const { error } = await supabase
      .from('integration_settings')
      .update(payload)
      .eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('integration_settings').insert(payload);
    if (error) throw error;
  }

  return { primary_by_category: value, warnings };
}

export interface SaveIntegrationPreferencesResult extends SanitizedPreferencesResult {
  settings: IntegrationSettingsRow;
}

/** Persist integration preferences via Supabase (RLS-enforced, no Edge Function required) */
export async function saveIntegrationPreferences(
  input: IntegrationPreferencesInput
): Promise<SaveIntegrationPreferencesResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const context = await buildValidationContext();
  const { primary_integrations, primary_knowledge_sources, warnings } =
    sanitizeIntegrationPreferences(input, context);

  const payload = {
    organization_id: null,
    primary_integrations,
    primary_knowledge_sources,
    updated_by: user.id,
  };

  const { data: existing, error: fetchError } = await supabase
    .from('integration_settings')
    .select('id')
    .is('organization_id', null)
    .maybeSingle();

  if (fetchError) throw fetchError;

  let settings: IntegrationSettingsRow;
  if (existing?.id) {
    const { data, error } = await supabase
      .from('integration_settings')
      .update(payload)
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw error;
    settings = data;
  } else {
    const { data, error } = await supabase
      .from('integration_settings')
      .insert(payload)
      .select('*')
      .single();
    if (error) throw error;
    settings = data;
  }

  return { settings, primary_integrations, primary_knowledge_sources, warnings };
}
