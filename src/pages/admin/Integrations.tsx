/**
 * Integration Hub - Main Page
 * Category tab bar with integration cards per Integration Hub spec (section 2.8)
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Search, BarChart3 } from 'lucide-react';
import { useProvidersGroupedByCategory } from '@/hooks/useIntegrations';
import { useAIModelPolicy } from '@/hooks/useAIModelPolicy';
import { ProviderCard } from '@/components/integrations/ProviderCard';
import { AIAgentAccessInline } from '@/components/integrations/AIAgentAccessInline';
import { CategoryProviderAccessInline } from '@/components/integrations/CategoryProviderAccessInline';
import { useSetProviderAsDefault } from '@/hooks/useSetProviderAsDefault';
import {
  filterProvidersByQuery,
  IntegrationProvider,
  OrganizationIntegration,
  isAIProvidersCategory,
} from '@/lib/integration-utils';
import {
  isCategoryAdminDefaultOnly,
  resolvePrimaryCategorySlug,
  getDataDestinationsForProvider,
  isCategorySyncProvider,
  type PrimaryIntegrationCategorySlug,
} from '@/lib/integration-preferences';
import { usePrimaryByCategorySettings } from '@/hooks/useIntegrationSettings';
import { usePMSync } from '@/hooks/usePMSync';
import { useCrmSync } from '@/hooks/useCrmSync';
import { useMeetingSync } from '@/hooks/useMeetingSync';
import { useSyncTeamsMeetings } from '@/hooks/useSyncTeamsMeetings';
import { useEmailSync } from '@/hooks/useEmailSync';

export default function Integrations() {
  const navigate = useNavigate();
  const { grouped, isLoading, error } = useProvidersGroupedByCategory();
  const { data: aiPolicy } = useAIModelPolicy();
  const { data: primaryByCategory } = usePrimaryByCategorySettings();
  const setProviderAsDefault = useSetProviderAsDefault();
  const [settingDefaultSlug, setSettingDefaultSlug] = useState<string | null>(null);
  const [syncingSlug, setSyncingSlug] = useState<string | null>(null);
  const pmSync = usePMSync();
  const crmSync = useCrmSync();
  const meetingSync = useMeetingSync();
  const teamsSync = useSyncTeamsMeetings();
  const emailSync = useEmailSync();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string>('');

  const tabGroups = useMemo(() => {
    if (!grouped?.length) return [];
    return grouped.map((group) => ({
      ...group,
      providers: filterProvidersByQuery(group.providers, searchQuery),
    }));
  }, [grouped, searchQuery]);

  const resolvedTab =
    activeTab && tabGroups.some((g) => g.category.slug === activeTab)
      ? activeTab
      : tabGroups[0]?.category.slug ?? '';

  const activeGroup = tabGroups.find((g) => g.category.slug === resolvedTab);

  const activeConnectedProviders = useMemo(() => {
    if (!activeGroup) return [];
    return activeGroup.providers
      .filter((p) => p.orgIntegration?.connection_status === 'connected')
      .map((p) => ({ slug: p.slug, name: p.name }));
  }, [activeGroup]);

  const showAIAgentAccess =
    activeGroup != null &&
    isAIProvidersCategory(activeGroup.category.slug, activeGroup.category.name);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4">
        <p className="text-destructive">Failed to load integrations</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Integration Hub</h1>
          <p className="text-muted-foreground">
            Connect, configure, and manage third-party REST API integrations
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate('/admin/integrations/analytics')}
        >
          <BarChart3 className="mr-2 h-4 w-4" />
          View Analytics
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search integrations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {tabGroups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">No integrations found</p>
            {searchQuery && (
              <Button variant="link" onClick={() => setSearchQuery('')}>
                Clear search
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Tabs value={resolvedTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="flex h-auto flex-wrap justify-start gap-1 bg-muted p-1">
            {tabGroups.map((group) => (
              <TabsTrigger
                key={group.category.slug}
                value={group.category.slug}
                className="data-[state=active]:bg-background"
              >
                {group.category.name}
                <span className="ml-2 rounded-full bg-muted-foreground/15 px-2 py-0.5 text-xs">
                  {group.stats.connectedProviders}/{group.stats.totalProviders}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          {showAIAgentAccess && (
            <AIAgentAccessInline
              connectedProviderNames={activeConnectedProviders}
              defaultProviderSlug={aiPolicy?.default_provider_slug}
            />
          )}

          {tabGroups.map((group) => {
            const resolvedCategorySlug = resolvePrimaryCategorySlug(
              group.category.slug,
              group.category.name
            );
            const categoryPref = resolvedCategorySlug
              ? primaryByCategory?.[resolvedCategorySlug]
              : undefined;

            const tabConnectedProviders = group.providers
              .filter((p) => p.orgIntegration?.connection_status === 'connected')
              .map((p) => ({ slug: p.slug, name: p.name }));

            const isAITab = isAIProvidersCategory(group.category.slug, group.category.name);
            const isAgentAccessLocked = aiPolicy?.selection_mode === 'admin_locked';
            const isCategoryLocked = isAITab
              ? isAgentAccessLocked
              : isCategoryAdminDefaultOnly(group.category.slug, group.category.name);

            const supportsDefaultControl =
              (isAITab && isAgentAccessLocked) ||
              (!isAITab && isCategoryLocked && resolvedCategorySlug != null);

            const handleSetDefault = async (providerSlug: string) => {
              setSettingDefaultSlug(providerSlug);
              try {
                await setProviderAsDefault.mutateAsync({
                  categorySlug: group.category.slug,
                  categoryName: group.category.name,
                  providerSlug,
                });
              } finally {
                setSettingDefaultSlug(null);
              }
            };

            const isPMTab = resolvedCategorySlug === 'project-management';
            const isCRMTab = resolvedCategorySlug === 'crm-systems';
            const isMeetingTab = resolvedCategorySlug === 'meeting-providers';
            const isEmailTab = resolvedCategorySlug === 'email-providers';
            const isDataDestinationTab =
              isPMTab || isCRMTab || isMeetingTab || isEmailTab;

            const handleSyncProvider = async (
              providerSlug: string,
              category: PrimaryIntegrationCategorySlug | null
            ) => {
              setSyncingSlug(providerSlug);
              try {
                if (category === 'crm-systems') {
                  const pref = categoryPref;
                  const destinations = getDataDestinationsForProvider(
                    pref,
                    providerSlug,
                    'crm-systems'
                  );
                  await crmSync.mutateAsync({ providerSlug, destinations });
                } else if (category === 'meeting-providers') {
                  const pref = categoryPref;
                  const destinations = getDataDestinationsForProvider(
                    pref,
                    providerSlug,
                    'meeting-providers'
                  );
                  if (providerSlug === 'microsoft-teams') {
                    await teamsSync.mutateAsync({ source: 'both' });
                  } else {
                    await meetingSync.mutateAsync({ providerSlug, destinations });
                  }
                } else if (category === 'email-providers') {
                  const pref = categoryPref;
                  const destinations = getDataDestinationsForProvider(
                    pref,
                    providerSlug,
                    'email-providers'
                  );
                  await emailSync.mutateAsync({ providerSlug, destinations });
                } else {
                  await pmSync.mutateAsync(providerSlug);
                }
              } finally {
                setSyncingSlug(null);
              }
            };

            return (
              <TabsContent
                key={group.category.slug}
                value={group.category.slug}
                className="space-y-4"
              >
                {resolvedCategorySlug && !isAITab && (
                  <CategoryProviderAccessInline
                    categorySlug={resolvedCategorySlug}
                    categoryName={group.category.name}
                    connectedProviders={tabConnectedProviders}
                    primarySlug={categoryPref?.primary_slug}
                  />
                )}

                {group.providers.length === 0 ? (
                  <Card>
                    <CardContent className="py-10 text-center text-muted-foreground">
                      No providers match your search in this category.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {group.providers.map((provider) => {
                      const pref = categoryPref;
                      const isActive =
                        !pref?.active_slugs?.length ||
                        pref.active_slugs.includes(provider.slug);
                      const isPrimary = pref?.primary_slug === provider.slug;
                      const isAiDefault = aiPolicy?.default_provider_slug === provider.slug;
                      const isOrgDefault = isAITab
                        ? isAiDefault && isCategoryLocked
                        : isPrimary && isCategoryLocked;
                      const isConnected =
                        (
                          provider as IntegrationProvider & {
                            orgIntegration?: OrganizationIntegration;
                          }
                        ).orgIntegration?.connection_status === 'connected';

                      const destinations = isDataDestinationTab && resolvedCategorySlug
                        ? getDataDestinationsForProvider(
                            pref,
                            provider.slug,
                            resolvedCategorySlug
                          )
                        : [];

                      return (
                        <ProviderCard
                          key={provider.id}
                          provider={provider as IntegrationProvider}
                          orgIntegration={
                            (
                              provider as IntegrationProvider & {
                                orgIntegration?: OrganizationIntegration;
                              }
                            ).orgIntegration
                          }
                          isDefaultAIProvider={isAiDefault}
                          isPrimaryProvider={isPrimary && isCategoryLocked}
                          isInactiveForCategory={
                            Boolean(pref?.active_slugs?.length) && !isActive
                          }
                          canSetDefault={supportsDefaultControl}
                          showAgentDefaultOnCard={isAITab}
                          requireAgentDefault={isCategoryLocked}
                          isOrganizationDefault={isOrgDefault}
                          isSettingDefault={settingDefaultSlug === provider.slug}
                          onSetAsDefault={() => handleSetDefault(provider.slug)}
                          showPMSyncOnCard={
                            isDataDestinationTab &&
                            isConnected &&
                            resolvedCategorySlug != null &&
                            isCategorySyncProvider(resolvedCategorySlug, provider.slug)
                          }
                          onSync={() =>
                            handleSyncProvider(provider.slug, resolvedCategorySlug)
                          }
                          isSyncing={syncingSlug === provider.slug}
                          dataDestinations={
                            isConnected && isPrimary ? destinations : []
                          }
                          showDisplayDestinationPicker={
                            isDataDestinationTab &&
                            isConnected &&
                            resolvedCategorySlug != null &&
                            isCategorySyncProvider(resolvedCategorySlug, provider.slug) &&
                            (isPrimary ||
                              (!categoryPref?.primary_slug &&
                                tabConnectedProviders.length === 1))
                          }
                          displayDestinationCategorySlug={
                            isDataDestinationTab ? resolvedCategorySlug ?? undefined : undefined
                          }
                          promoteToDefaultOnSave={
                            !categoryPref?.primary_slug &&
                            tabConnectedProviders.length === 1 &&
                            tabConnectedProviders[0]?.slug === provider.slug
                          }
                        />
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </div>
  );
}
