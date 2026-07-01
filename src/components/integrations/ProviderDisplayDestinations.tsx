/**
 * Inline checkboxes on a connected provider card — choose which app pages show synced data.
 */

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  CATEGORY_DATA_DESTINATION_OPTIONS,
  INTEGRATION_DATA_DESTINATION_LABELS,
  filterDestinationsForCategory,
  getDefaultDataDestinationsForCategory,
  type IntegrationDataDestination,
  type PrimaryIntegrationCategorySlug,
} from '@/lib/integration-preferences';
import {
  usePrimaryByCategorySettings,
  useSavePrimaryByCategory,
} from '@/hooks/useIntegrationSettings';
import { Loader2 } from 'lucide-react';

interface ProviderDisplayDestinationsProps {
  categorySlug: PrimaryIntegrationCategorySlug;
  providerSlug: string;
  /** When true, saving also sets this provider as org default if not already */
  promoteToDefault?: boolean;
  onClickStopPropagation?: (e: React.MouseEvent) => void;
}

export function ProviderDisplayDestinations({
  categorySlug,
  providerSlug,
  promoteToDefault = false,
  onClickStopPropagation,
}: ProviderDisplayDestinationsProps) {
  const { data: primaryByCategory } = usePrimaryByCategorySettings();
  const saveCategory = useSavePrimaryByCategory();
  const pref = primaryByCategory?.[categorySlug];

  const destinationOptions =
    CATEGORY_DATA_DESTINATION_OPTIONS[categorySlug] ??
    getDefaultDataDestinationsForCategory(categorySlug);

  const [destinations, setDestinations] = useState<IntegrationDataDestination[]>([
    ...destinationOptions,
  ]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (dirty) return;
    const fromPref =
      pref?.provider_data_destinations?.[providerSlug] ?? pref?.data_destinations;
    if (fromPref?.length) {
      const valid = filterDestinationsForCategory(categorySlug, fromPref);
      setDestinations(valid.length > 0 ? valid : [...destinationOptions]);
    }
  }, [pref, providerSlug, dirty, categorySlug, destinationOptions]);

  const toggle = (page: IntegrationDataDestination, checked: boolean) => {
    const next = checked
      ? [...destinations, page]
      : destinations.filter((d) => d !== page);
    if (next.length === 0) return;
    setDestinations(next);
    setDirty(true);
  };

  const save = (e: React.MouseEvent) => {
    onClickStopPropagation?.(e);
    const savedDestinations = filterDestinationsForCategory(categorySlug, destinations);
    const existing = primaryByCategory ?? {};
    const current = existing[categorySlug] ?? {
      primary_slug: providerSlug,
      active_slugs: [providerSlug],
      single_active_only: true,
      data_destinations: [...destinationOptions],
    };
    const nextPrimary =
      promoteToDefault || !pref?.primary_slug ? providerSlug : current.primary_slug;
    const singleOnly = pref?.single_active_only ?? current.single_active_only ?? true;
    const resolvedActiveSlugs = singleOnly
      ? [nextPrimary]
      : [...new Set([...(current.active_slugs ?? pref?.active_slugs ?? []), providerSlug])];

    saveCategory.mutate(
      {
        ...existing,
        [categorySlug]: {
          ...current,
          primary_slug: nextPrimary,
          active_slugs: resolvedActiveSlugs.filter(Boolean),
          single_active_only: singleOnly,
          provider_data_destinations: {
            ...current.provider_data_destinations,
            [providerSlug]: savedDestinations,
          },
          data_destinations: savedDestinations,
        },
      },
      { onSuccess: () => setDirty(false) }
    );
  };

  const needsInitialSave = promoteToDefault && !pref?.primary_slug;

  return (
    <div
      className="w-full rounded-md border bg-muted/30 p-2 text-left"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="text-xs font-medium mb-2">Show synced data on</p>
      <div className="flex flex-col gap-2 mb-2">
        {destinationOptions.map((page) => (
          <div key={page} className="flex items-center gap-2">
            <Checkbox
              id={`card-${categorySlug}-${providerSlug}-${page}`}
              checked={destinations.includes(page)}
              onCheckedChange={(checked) => toggle(page, checked === true)}
            />
            <Label
              htmlFor={`card-${categorySlug}-${providerSlug}-${page}`}
              className="text-xs font-normal cursor-pointer"
            >
              {INTEGRATION_DATA_DESTINATION_LABELS[page]}
            </Label>
          </div>
        ))}
      </div>
      {(dirty || needsInitialSave) && (
        <Button
          type="button"
          size="sm"
          className="w-full h-8 text-xs"
          disabled={saveCategory.isPending}
          onClick={save}
        >
          {saveCategory.isPending && (
            <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
          )}
          Save display pages
        </Button>
      )}
    </div>
  );
}
