/**
 * Build user-facing org integration overview from hub status RPC + preferences.
 */

import {
  normalizePrimaryByCategory,
  PRIMARY_INTEGRATION_CATEGORY_SLUGS,
  resolvePrimaryCategorySlug,
  shouldShowProviderForCategory,
  type CategoryIntegrationPreference,
  type PrimaryIntegrationCategorySlug,
} from '@/lib/integration-preferences';

export const PRIMARY_CATEGORY_DISPLAY_NAMES: Record<
  PrimaryIntegrationCategorySlug,
  string
> = {
  'meeting-providers': 'Meeting Platforms',
  'email-providers': 'Email Services',
  'storage-productivity': 'Storage',
  'project-management': 'Project Management',
  'crm-systems': 'CRM Systems',
};

export interface OrgIntegrationProviderView {
  slug: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
}

export interface OrgIntegrationCategoryView {
  categorySlug: PrimaryIntegrationCategorySlug;
  categoryName: string;
  defaultProviderSlug: string | null;
  defaultProviderName: string | null;
  providers: OrgIntegrationProviderView[];
  isConfigured: boolean;
}

export interface OrgIntegrationHubStatusPayload {
  primary_by_category: unknown;
  connected_providers: {
    slug: string;
    name: string;
    category_slug: string;
    category_name?: string;
  }[];
}

export function buildOrgIntegrationCategoryViews(
  payload: OrgIntegrationHubStatusPayload | null | undefined
): OrgIntegrationCategoryView[] {
  const primaryByCategory = normalizePrimaryByCategory(payload?.primary_by_category);
  const connected = payload?.connected_providers ?? [];

  const providersByCategory = new Map<
    PrimaryIntegrationCategorySlug,
    { slug: string; name: string }[]
  >();

  for (const provider of connected) {
    const categoryKey = resolvePrimaryCategorySlug(
      provider.category_slug,
      provider.category_name
    );
    if (!categoryKey) continue;
    const list = providersByCategory.get(categoryKey) ?? [];
    if (!list.some((p) => p.slug === provider.slug)) {
      list.push({ slug: provider.slug, name: provider.name });
    }
    providersByCategory.set(categoryKey, list);
  }

  return PRIMARY_INTEGRATION_CATEGORY_SLUGS.map((categorySlug) => {
    const pref: CategoryIntegrationPreference =
      primaryByCategory[categorySlug] ?? {
        primary_slug: null,
        active_slugs: [],
        single_active_only: true,
      };

    const categoryProviders = providersByCategory.get(categorySlug) ?? [];
    const defaultProviderSlug = pref.primary_slug;
    const defaultProviderName =
      categoryProviders.find((p) => p.slug === defaultProviderSlug)?.name ??
      (defaultProviderSlug ? defaultProviderSlug.replace(/-/g, ' ') : null);

    const providers: OrgIntegrationProviderView[] = categoryProviders.map((p) => ({
      slug: p.slug,
      name: p.name,
      isDefault: p.slug === defaultProviderSlug,
      isActive: shouldShowProviderForCategory(p.slug, pref),
    }));

    const activeProviders = providers.filter((p) => p.isActive);

    return {
      categorySlug,
      categoryName: PRIMARY_CATEGORY_DISPLAY_NAMES[categorySlug],
      defaultProviderSlug,
      defaultProviderName,
      providers: activeProviders.length > 0 ? activeProviders : providers,
      isConfigured: categoryProviders.length > 0,
    };
  });
}
