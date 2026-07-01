/**
 * Compact per-tab controls above provider cards — user access mode and single-provider mode.
 */

import { useAuth } from '@/contexts/AuthContext';
import {
  usePrimaryByCategorySettings,
  useSavePrimaryByCategory,
} from '@/hooks/useIntegrationSettings';
import {
  isCategoryWithTabPreferences,
  type CategoryIntegrationPreference,
  type PrimaryByCategory,
  type PrimaryIntegrationCategorySlug,
} from '@/lib/integration-preferences';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';

interface IntegrationTabQuickControlsProps {
  categorySlug: string;
  categoryName: string;
  connectedSlugs: string[];
}

export function IntegrationTabQuickControls({
  categorySlug,
  categoryName,
  connectedSlugs,
}: IntegrationTabQuickControlsProps) {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const { data: byCategory, isLoading: categoryLoading } = usePrimaryByCategorySettings();
  const saveByCategory = useSavePrimaryByCategory();

  if (!isAdmin || connectedSlugs.length === 0) {
    return null;
  }

  if (categorySlug === 'ai-providers') {
    return null;
  }

  if (!isCategoryWithTabPreferences(categorySlug)) {
    return null;
  }

  const catSlug = categorySlug as PrimaryIntegrationCategorySlug;
  const pref: CategoryIntegrationPreference = byCategory?.[catSlug] ?? {
    primary_slug: null,
    active_slugs: [],
    single_active_only: false,
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-muted/30 px-4 py-3">
      <p className="text-sm text-muted-foreground">
        Click the <span className="font-medium text-foreground">★</span> on a connected card to
        make it the default for {categoryName}.
      </p>
      <div className="flex items-center gap-3">
        {categoryLoading || saveByCategory.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : null}
        <Label htmlFor={`${categorySlug}-single`} className="text-sm font-medium whitespace-nowrap">
          Use only one provider
        </Label>
        <Switch
          id={`${categorySlug}-single`}
          checked={pref.single_active_only}
          disabled={saveByCategory.isPending}
          onCheckedChange={(single_active_only) => {
            const next: CategoryIntegrationPreference = single_active_only
              ? {
                  single_active_only: true,
                  primary_slug: pref.primary_slug ?? connectedSlugs[0] ?? null,
                  active_slugs: pref.primary_slug
                    ? [pref.primary_slug]
                    : connectedSlugs[0]
                      ? [connectedSlugs[0]]
                      : [],
                }
              : {
                  single_active_only: false,
                  primary_slug: pref.primary_slug,
                  active_slugs:
                    pref.active_slugs.length > 0 ? pref.active_slugs : [...connectedSlugs],
                };

            const payload: Partial<PrimaryByCategory> = {
              ...(byCategory ?? {}),
              [catSlug]: next,
            };
            saveByCategory.mutate(payload);
          }}
        />
      </div>
    </div>
  );
}
