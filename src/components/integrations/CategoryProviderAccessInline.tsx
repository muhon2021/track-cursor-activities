/**
 * Inline bar for non-AI integration categories — default provider info,
 * data destination picker, sync, and links to view synced data.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CATEGORY_DATA_DESTINATION_OPTIONS,
  INTEGRATION_DATA_DESTINATION_LABELS,
  categorySupportsDataDestinations,
  filterDestinationsForCategory,
  getDefaultDataDestinationsForCategory,
  isCategorySyncProvider,
  type IntegrationDataDestination,
  type PrimaryIntegrationCategorySlug,
} from '@/lib/integration-preferences';
import {
  usePrimaryByCategorySettings,
  useSavePrimaryByCategory,
} from '@/hooks/useIntegrationSettings';
import { usePMSync } from '@/hooks/usePMSync';
import { useCrmSync } from '@/hooks/useCrmSync';
import { useMeetingSync } from '@/hooks/useMeetingSync';
import { useSyncTeamsMeetings } from '@/hooks/useSyncTeamsMeetings';
import { useEmailSync } from '@/hooks/useEmailSync';
import { getIntegrationViewPath } from '@/lib/integration-display';
import { cn } from '@/lib/utils';
import { ExternalLink, Loader2, RefreshCw, Star } from 'lucide-react';

interface CategoryProviderAccessInlineProps {
  categorySlug: PrimaryIntegrationCategorySlug;
  categoryName: string;
  connectedProviders: { slug: string; name: string }[];
  primarySlug?: string | null;
}

export function CategoryProviderAccessInline({
  categorySlug,
  categoryName,
  connectedProviders,
  primarySlug,
}: CategoryProviderAccessInlineProps) {
  const { data: primaryByCategory } = usePrimaryByCategorySettings();
  const saveCategory = useSavePrimaryByCategory();
  const pref = primaryByCategory?.[categorySlug];
  const [configProviderSlug, setConfigProviderSlug] = useState<string | null>(null);

  const effectivePrimary =
    primarySlug ??
    pref?.primary_slug ??
    configProviderSlug ??
    (connectedProviders.length === 1 ? connectedProviders[0].slug : null);

  const primaryName =
    connectedProviders.find((p) => p.slug === effectivePrimary)?.name ??
    effectivePrimary?.replace(/-/g, ' ');

  const destinationOptions =
    CATEGORY_DATA_DESTINATION_OPTIONS[categorySlug] ??
    getDefaultDataDestinationsForCategory(categorySlug);

  const [destinations, setDestinations] = useState<IntegrationDataDestination[]>(
    [...destinationOptions]
  );
  const [dirty, setDirty] = useState(false);
  const [singleOnly, setSingleOnly] = useState(
    () => pref?.single_active_only ?? connectedProviders.length <= 1
  );
  const [activeSlugs, setActiveSlugs] = useState<string[]>(() =>
    pref?.active_slugs?.length
      ? pref.active_slugs
      : connectedProviders.map((p) => p.slug)
  );

  const pmSync = usePMSync(effectivePrimary ?? '');
  const crmSync = useCrmSync(effectivePrimary ?? '', destinations);
  const meetingSync = useMeetingSync(effectivePrimary ?? '', destinations);
  const teamsSync = useSyncTeamsMeetings();
  const emailSync = useEmailSync(effectivePrimary ?? '', destinations);
  const supportsDestinations = categorySupportsDataDestinations(categorySlug);
  const canSync =
    effectivePrimary != null && isCategorySyncProvider(categorySlug, effectivePrimary);
  const isSyncing =
    pmSync.isPending ||
    crmSync.isPending ||
    meetingSync.isPending ||
    teamsSync.isPending ||
    emailSync.isPending;

  useEffect(() => {
    if (!pref || dirty) return;
    const fromPref =
      (effectivePrimary && pref.provider_data_destinations?.[effectivePrimary]) ||
      pref.data_destinations;
    if (fromPref?.length) {
      const valid = filterDestinationsForCategory(categorySlug, fromPref);
      setDestinations(valid.length > 0 ? valid : [...destinationOptions]);
    }
    if (typeof pref.single_active_only === 'boolean') {
      setSingleOnly(pref.single_active_only);
    }
    if (pref.active_slugs?.length) {
      setActiveSlugs(pref.active_slugs);
    }
  }, [pref, effectivePrimary, dirty, categorySlug, destinationOptions]);

  const allDestinationsSelected =
    destinationOptions.length > 0 &&
    destinationOptions.every((page) => destinations.includes(page));

  const toggleActiveProvider = (slug: string, checked: boolean) => {
    if (singleOnly) return;
    const next = checked
      ? [...new Set([...activeSlugs, slug])]
      : activeSlugs.filter((s) => s !== slug);
    if (next.length === 0) return;
    setActiveSlugs(next);
    setDirty(true);
  };

  const selectAllDestinations = () => {
    setDestinations([...destinationOptions]);
    setDirty(true);
  };

  const selectAllProviders = () => {
    setSingleOnly(false);
    setActiveSlugs(connectedProviders.map((p) => p.slug));
    setDirty(true);
  };

  if (connectedProviders.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
        Connect a {categoryName.toLowerCase()} provider below, then choose where synced data
        appears in the app.
      </div>
    );
  }

  const toggleDestination = (page: IntegrationDataDestination, checked: boolean) => {
    const next = checked
      ? [...destinations, page]
      : destinations.filter((d) => d !== page);
    if (next.length === 0) return;
    setDestinations(next);
    setDirty(true);
  };

  const saveDestinations = () => {
    if (!effectivePrimary) return;
    const savedDestinations = filterDestinationsForCategory(categorySlug, destinations);
    const resolvedActiveSlugs = singleOnly
      ? [effectivePrimary]
      : activeSlugs.length > 0
        ? activeSlugs
        : connectedProviders.map((p) => p.slug);
    const existing = primaryByCategory ?? {};
    const current = existing[categorySlug] ?? {
      primary_slug: effectivePrimary,
      active_slugs: resolvedActiveSlugs,
      single_active_only: singleOnly,
      data_destinations: [...destinationOptions],
    };
    saveCategory.mutate(
      {
        ...existing,
        [categorySlug]: {
          ...current,
          primary_slug: effectivePrimary,
          active_slugs: resolvedActiveSlugs,
          single_active_only: singleOnly,
          provider_data_destinations: {
            ...current.provider_data_destinations,
            [effectivePrimary]: savedDestinations,
          },
          data_destinations: savedDestinations,
        },
      },
      { onSuccess: () => setDirty(false) }
    );
  };

  const needsInitialSave = Boolean(effectivePrimary && !pref?.primary_slug);

  const handleSync = () => {
    if (!effectivePrimary) return;
    if (categorySlug === 'crm-systems') {
      crmSync.mutate({ providerSlug: effectivePrimary, destinations });
      return;
    }
    if (categorySlug === 'meeting-providers') {
      if (effectivePrimary === 'microsoft-teams') {
        teamsSync.mutate({ source: 'both' });
        return;
      }
      meetingSync.mutate({ providerSlug: effectivePrimary, destinations });
      return;
    }
    if (categorySlug === 'email-providers') {
      emailSync.mutate({ providerSlug: effectivePrimary, destinations });
      return;
    }
    pmSync.mutate(effectivePrimary);
  };

  const syncHelpText =
    categorySlug === 'crm-systems'
      ? 'Sync pulls accounts, deals, leads, and contacts based on the pages you enable below.'
      : categorySlug === 'meeting-providers'
        ? 'Sync imports meetings and transcripts from your connected platform. Choose which meeting pages show that data.'
        : categorySlug === 'email-providers'
          ? 'Choose where outbound email and delivery activity appear. Sync refreshes logs and contact email history.'
          : 'Sync runs from here or from the provider Configure page. User-level sync is also in Settings → Connected Services.';

  return (
    <div
      className={cn(
        'rounded-xl border-2 border-primary/30 bg-primary/5 p-4',
        'flex flex-col gap-4'
      )}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1 min-w-0">
          <p className="font-semibold text-sm">{categoryName} access</p>
          <p className="text-xs text-muted-foreground">
            {effectivePrimary ? (
              <>
                Your organization uses{' '}
                <span className="font-medium text-foreground">{primaryName}</span> as the
                default. Click{' '}
                <Star className="inline h-3 w-3 fill-primary text-primary" /> on a connected
                card to switch providers.
              </>
            ) : (
              <>
                Click <Star className="inline h-3 w-3 fill-primary text-primary" /> on a
                connected card to set the default provider.
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {singleOnly ? 'Single provider' : 'All providers active'}
          </Badge>
          {effectivePrimary && (
            <Badge className="gap-1 text-xs">
              <Star className="h-3 w-3 fill-current" />
              Default: {primaryName}
            </Badge>
          )}
          {!singleOnly && activeSlugs.length > 1 && (
            <Badge variant="secondary" className="text-xs">
              {activeSlugs.length} providers active
            </Badge>
          )}
        </div>
      </div>

      {connectedProviders.length > 1 && (
        <div className="rounded-lg border bg-background p-4 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">Active providers</p>
              <p className="text-xs text-muted-foreground">
                Use one default provider, or keep all connected providers active in the app.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor={`${categorySlug}-single-only`} className="text-xs whitespace-nowrap">
                Use only one provider
              </Label>
              <Switch
                id={`${categorySlug}-single-only`}
                checked={singleOnly}
                onCheckedChange={(checked) => {
                  setSingleOnly(checked);
                  if (checked && effectivePrimary) {
                    setActiveSlugs([effectivePrimary]);
                  } else {
                    setActiveSlugs(connectedProviders.map((p) => p.slug));
                  }
                  setDirty(true);
                }}
              />
            </div>
          </div>

          {singleOnly ? (
            <p className="text-xs text-muted-foreground">
              Only <span className="font-medium text-foreground">{primaryName}</span> is active.
              Other connected providers stay linked but won&apos;t show data until you switch
              the default star or turn off single-provider mode.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  All checked providers can show data. Star sets which one syncs first.
                </p>
                <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={selectAllProviders}>
                  Select all providers
                </Button>
              </div>
              <div className="flex flex-wrap gap-4">
                {connectedProviders.map((p) => (
                  <div key={p.slug} className="flex items-center gap-2">
                    <Checkbox
                      id={`${categorySlug}-active-${p.slug}`}
                      checked={activeSlugs.includes(p.slug)}
                      onCheckedChange={(checked) =>
                        toggleActiveProvider(p.slug, checked === true)
                      }
                    />
                    <Label htmlFor={`${categorySlug}-active-${p.slug}`} className="text-sm">
                      {p.name}
                      {p.slug === effectivePrimary && (
                        <span className="text-muted-foreground"> (default)</span>
                      )}
                    </Label>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {supportsDestinations && connectedProviders.length > 0 && (
        <div className="rounded-lg border bg-background p-4 space-y-4">
          {connectedProviders.length > 1 && !pref?.primary_slug && !primarySlug && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Configure provider</p>
              <Select
                value={configProviderSlug ?? ''}
                onValueChange={(value) => {
                  setConfigProviderSlug(value);
                  setDirty(false);
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select a connected provider" />
                </SelectTrigger>
                <SelectContent>
                  {connectedProviders.map((p) => (
                    <SelectItem key={p.slug} value={p.slug}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {!effectivePrimary ? (
            <p className="text-sm text-muted-foreground">
              Select a connected provider above, or click{' '}
              <Star className="inline h-3 w-3 fill-primary text-primary" /> on a card to set
              the default.
            </p>
          ) : (
            <>
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">Show synced data on</p>
              {!allDestinationsSelected && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={selectAllDestinations}
                >
                  Select all pages
                </Button>
              )}
              {allDestinationsSelected && destinationOptions.length > 1 && (
                <span className="text-xs text-muted-foreground">All pages selected</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Choose which pages display data pulled from {primaryName}. {syncHelpText}
              {needsInitialSave && (
                <>
                  {' '}
                  <span className="text-foreground font-medium">
                    Click Save to apply — this will set {primaryName} as your default.
                  </span>
                </>
              )}
            </p>
          </div>

          <div className="flex flex-wrap gap-4">
            {destinationOptions.map((page) => (
              <div key={page} className="flex items-center gap-2">
                <Checkbox
                  id={`${categorySlug}-dest-${page}`}
                  checked={destinations.includes(page)}
                  onCheckedChange={(checked) =>
                    toggleDestination(page, checked === true)
                  }
                />
                <Label htmlFor={`${categorySlug}-dest-${page}`} className="text-sm">
                  {INTEGRATION_DATA_DESTINATION_LABELS[page]}
                </Label>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(dirty || needsInitialSave) && (
              <Button
                size="sm"
                onClick={saveDestinations}
                disabled={saveCategory.isPending}
              >
                {saveCategory.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save display pages
              </Button>
            )}

            {canSync && (
              <Button
                size="sm"
                variant="secondary"
                onClick={handleSync}
                disabled={isSyncing}
              >
                {isSyncing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Sync {primaryName} now
              </Button>
            )}

            {filterDestinationsForCategory(categorySlug, destinations).map((page) => (
              <Button key={page} size="sm" variant="outline" asChild>
                <Link to={getIntegrationViewPath(page, effectivePrimary)}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View in {INTEGRATION_DATA_DESTINATION_LABELS[page]}
                </Link>
              </Button>
            ))}
          </div>

          {!canSync && (
            <p className="text-xs text-muted-foreground">
              After connecting, open <strong>Configure</strong> on a card for OAuth and
              credentials. Full sync for this provider is coming soon.
            </p>
          )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
