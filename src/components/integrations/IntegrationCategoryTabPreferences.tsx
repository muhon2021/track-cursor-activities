/**
 * Per-category provider preferences — shown on each Integration Hub category tab.
 * Admin picks which connected providers are active and which is primary (or single-only mode).
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  usePrimaryByCategorySettings,
  useCategoryIntegrationOptions,
  useSavePrimaryByCategory,
} from '@/hooks/useIntegrationSettings';
import { CategoryPrimarySourceCard } from '@/components/integrations/CategoryPrimarySourceCard';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import type {
  CategoryIntegrationPreference,
  PrimaryByCategory,
  PrimaryIntegrationCategorySlug,
} from '@/lib/integration-preferences';

interface IntegrationCategoryTabPreferencesProps {
  categorySlug: PrimaryIntegrationCategorySlug;
}

export function IntegrationCategoryTabPreferences({
  categorySlug,
}: IntegrationCategoryTabPreferencesProps) {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const { data: savedByCategory, isLoading: settingsLoading } = usePrimaryByCategorySettings();
  const { data: categoryOptions, isLoading: optionsLoading } = useCategoryIntegrationOptions();
  const saveByCategory = useSavePrimaryByCategory();

  const category = categoryOptions?.find((c) => c.slug === categorySlug);
  const [value, setValue] = useState<CategoryIntegrationPreference>({
    primary_slug: null,
    active_slugs: [],
    single_active_only: false,
  });
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!savedByCategory || dirty) return;
    const saved = savedByCategory[categorySlug];
    if (saved) {
      setValue(saved);
    }
  }, [savedByCategory, categorySlug, dirty]);

  const handleSave = async () => {
    const payload: Partial<PrimaryByCategory> = {
      ...(savedByCategory ?? {}),
      [categorySlug]: value,
    };
    try {
      await saveByCategory.mutateAsync(payload);
      setDirty(false);
    } catch {
      // Toast handled by mutation
    }
  };

  if (settingsLoading || optionsLoading || !category) {
    return (
      <div className="flex h-24 items-center justify-center rounded-lg border border-dashed">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <CategoryPrimarySourceCard
        category={category}
        value={value}
        onChange={(next) => {
          setValue(next);
          setDirty(true);
        }}
        disabled={!isAdmin}
      />
      {isAdmin && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saveByCategory.isPending || !dirty}>
            {saveByCategory.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save {category.name} Preferences
          </Button>
        </div>
      )}
    </div>
  );
}
