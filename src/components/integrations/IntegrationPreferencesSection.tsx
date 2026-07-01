/**
 * Integration Preferences — Primary Integrations & Primary Knowledge Sources
 */

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  useIntegrationSettings,
  useSaveIntegrationSettings,
  useIntegrationPreferenceOptions,
  knowledgeRefsToKeys,
  knowledgeKeysToRefs,
} from '@/hooks/useIntegrationSettings';
import { IntegrationMultiSelect } from '@/components/integrations/IntegrationMultiSelect';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { AlertTriangle, Loader2, Settings2 } from 'lucide-react';
import type { IntegrationPreferencesInput } from '@/lib/integration-preferences';

export function IntegrationPreferencesSection() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const { data: saved, isLoading: settingsLoading } = useIntegrationSettings();
  const { data: options, isLoading: optionsLoading } = useIntegrationPreferenceOptions();
  const saveSettings = useSaveIntegrationSettings();

  const [primaryIntegrations, setPrimaryIntegrations] = useState<string[]>([]);
  const [primaryKnowledgeKeys, setPrimaryKnowledgeKeys] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!saved || dirty) return;
    setPrimaryIntegrations(saved.primary_integrations);
    setPrimaryKnowledgeKeys(knowledgeRefsToKeys(saved.primary_knowledge_sources));
  }, [saved, dirty]);

  const staleWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (!options) return warnings;

    for (const slug of primaryIntegrations) {
      const opt = options.primaryIntegrations.find((o) => o.value === slug);
      if (opt && !opt.isSelectable) {
        warnings.push(`"${opt.label}" is no longer connected.`);
      }
    }

    for (const key of primaryKnowledgeKeys) {
      const opt = options.primaryKnowledgeSources.find((o) => o.value === key);
      if (opt && !opt.isSelectable) {
        warnings.push(
          opt.disabledReason ?? `Knowledge source "${opt.label}" is no longer available.`
        );
      }
    }

    return warnings;
  }, [options, primaryIntegrations, primaryKnowledgeKeys]);

  const handleSave = async () => {
    const payload: IntegrationPreferencesInput = {
      primary_integrations: primaryIntegrations,
      primary_knowledge_sources: knowledgeKeysToRefs(primaryKnowledgeKeys),
    };

    try {
      await saveSettings.mutateAsync(payload);
      setDirty(false);
    } catch {
      // Toast handled by mutation hook
    }
  };

  const isLoading = settingsLoading || optionsLoading;

  if (isLoading) {
    return (
      <Card id="preferences">
        <CardContent className="flex h-40 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card id="preferences">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            <CardTitle>Integration Preferences</CardTitle>
          </div>
          <CardDescription>
            Select primary business integrations and knowledge sources used as defaults for AI,
            search, and knowledge features across the platform.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {staleWarnings.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Connection warnings</AlertTitle>
            <AlertDescription>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                {staleWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Primary Integrations</h3>
          <p className="text-sm text-muted-foreground">
            Connected CRM, project management, communication, and file storage systems.
          </p>
          <IntegrationMultiSelect
            options={options?.primaryIntegrations ?? []}
            selected={primaryIntegrations}
            onChange={(values) => {
              setPrimaryIntegrations(values);
              setDirty(true);
            }}
            placeholder="Select primary integrations..."
            disabled={!isAdmin}
            emptyMessage="No eligible integrations found. Connect providers below first."
          />
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Primary Knowledge Sources</h3>
          <p className="text-sm text-muted-foreground">
            Connected external sources and internal document stores for AI and knowledge base
            features.
          </p>
          <IntegrationMultiSelect
            options={options?.primaryKnowledgeSources ?? []}
            selected={primaryKnowledgeKeys}
            onChange={(values) => {
              setPrimaryKnowledgeKeys(values);
              setDirty(true);
            }}
            placeholder="Select primary knowledge sources..."
            disabled={!isAdmin}
            emptyMessage="No knowledge sources available. Connect integrations or enable internal sources."
          />
        </div>

        <div className="flex justify-end">
          {isAdmin ? (
            <Button
              onClick={handleSave}
              disabled={saveSettings.isPending || !dirty}
            >
              {saveSettings.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Settings
            </Button>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button disabled>Save Settings</Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>Admin access required to edit preferences.</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
