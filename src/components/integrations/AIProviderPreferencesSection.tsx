/**
 * Agent AI access — admin sets org default or lets users choose provider/model.
 */

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  useAIModelPolicy,
  useSaveAIModelPolicy,
  useSelectableChatModels,
} from '@/hooks/useAIModelPolicy';
import { useProvidersGroupedByCategory } from '@/hooks/useIntegrations';
import {
  DEFAULT_AI_MODEL_POLICY,
  integrationSlugFromAIProviderSlug,
  type AIModelPolicy,
  type ModelSelectionMode,
  type UserVisibleModels,
} from '@/lib/ai-model-policy';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Bot, Loader2, Star } from 'lucide-react';

export function AIProviderPreferencesSection() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const { data: savedPolicy, isLoading: policyLoading, isError: policyError } = useAIModelPolicy();
  const { data: models, isLoading: modelsLoading } = useSelectableChatModels();
  const { grouped } = useProvidersGroupedByCategory();
  const savePolicy = useSaveAIModelPolicy();

  const [policy, setPolicy] = useState<AIModelPolicy>(DEFAULT_AI_MODEL_POLICY);

  const connectedAIProviders = useMemo(() => {
    const aiGroup = grouped?.find((g) => g.category.slug === 'ai-providers');
    return (aiGroup?.providers ?? []).filter(
      (p) =>
        p.orgIntegration?.connection_status === 'connected' &&
        p.orgIntegration?.enabled !== false
    );
  }, [grouped]);

  useEffect(() => {
    if (savedPolicy) setPolicy(savedPolicy);
  }, [savedPolicy]);

  const modelsForDefaultProvider = useMemo(() => {
    if (!policy.default_provider_slug) return models ?? [];
    return (models ?? []).filter(
      (m) =>
        integrationSlugFromAIProviderSlug(m.provider_slug) === policy.default_provider_slug
    );
  }, [models, policy.default_provider_slug]);

  const defaultProviderName =
    connectedAIProviders.find((p) => p.slug === policy.default_provider_slug)?.name ??
    policy.default_provider_slug?.replace(/-/g, ' ');

  const defaultModelName = (models ?? []).find((m) => m.id === policy.default_chat_model_id)?.name;

  const persist = (next: AIModelPolicy) => {
    setPolicy(next);
    if (isAdmin) {
      savePolicy.mutate(next);
    }
  };

  const setAccessMode = (mode: 'admin_default' | 'user_choice') => {
    persist({
      ...policy,
      selection_mode: mode === 'admin_default' ? 'admin_locked' : 'user_choice',
      user_visible_models:
        mode === 'user_choice' ? 'all_enabled' : policy.user_visible_models,
    });
  };

  const setDefaultProvider = (integrationSlug: string) => {
    const providerModels = (models ?? []).filter(
      (m) => integrationSlugFromAIProviderSlug(m.provider_slug) === integrationSlug
    );
    const defaultModel =
      providerModels.find((m) => m.is_default) ?? providerModels[0] ?? null;
    persist({
      ...policy,
      default_provider_slug: integrationSlug,
      default_chat_model_id: defaultModel?.id ?? policy.default_chat_model_id,
    });
  };

  if (policyLoading) {
    return (
      <Card>
        <CardContent className="flex h-24 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (connectedAIProviders.length === 0) {
    return null;
  }

  const accessMode =
    policy.selection_mode === 'admin_locked' ? 'admin_default' : 'user_choice';

  return (
    <Card className="border-primary/20 bg-primary/[0.02]">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Agent AI access</CardTitle>
        </div>
        <CardDescription>
          Choose whether all users must use one default AI provider, or can pick their own when
          running agents.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {policyError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Settings not loaded</AlertTitle>
            <AlertDescription>
              Run <code className="text-xs">npm run migrations:run</code> then refresh.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          <Label className="text-base">Who picks the AI provider?</Label>
          <RadioGroup
            value={accessMode}
            onValueChange={(v) => setAccessMode(v as 'admin_default' | 'user_choice')}
            disabled={!isAdmin || savePolicy.isPending}
            className="grid gap-3 sm:grid-cols-2"
          >
            <label
              htmlFor="access-admin-default"
              className="flex cursor-pointer items-start gap-3 rounded-lg border-2 border-muted bg-background p-4 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
            >
              <RadioGroupItem value="admin_default" id="access-admin-default" className="mt-0.5" />
              <div className="space-y-1">
                <span className="font-medium">Admin default only</span>
                <p className="text-sm text-muted-foreground">
                  Every user and agent uses the default provider you set below. No model picker in
                  chat.
                </p>
              </div>
            </label>
            <label
              htmlFor="access-user-choice"
              className="flex cursor-pointer items-start gap-3 rounded-lg border-2 border-muted bg-background p-4 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
            >
              <RadioGroupItem value="user_choice" id="access-user-choice" className="mt-0.5" />
              <div className="space-y-1">
                <span className="font-medium">Users can choose</span>
                <p className="text-sm text-muted-foreground">
                  Users pick OpenAI, Anthropic, etc. from a dropdown in agent chat (from connected
                  providers).
                </p>
              </div>
            </label>
          </RadioGroup>
          {savePolicy.isPending && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving…
            </p>
          )}
        </div>

        <div className="space-y-3 rounded-lg border bg-background p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label className="text-base">Organization default provider</Label>
            {policy.default_provider_slug ? (
              <Badge variant="default" className="gap-1">
                <Star className="h-3 w-3 fill-current" />
                {defaultProviderName}
                {defaultModelName ? ` · ${defaultModelName}` : ''}
              </Badge>
            ) : (
              <Badge variant="outline">Not set — pick below or ★ on a card</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {accessMode === 'admin_default'
              ? 'Required: all agents use this provider.'
              : 'Optional: initial selection when users open agent chat (they can change it).'}
          </p>
          <RadioGroup
            value={policy.default_provider_slug ?? ''}
            onValueChange={setDefaultProvider}
            disabled={!isAdmin || savePolicy.isPending}
            className="flex flex-wrap gap-2"
          >
            {connectedAIProviders.map((provider) => (
              <label
                key={provider.slug}
                htmlFor={`org-default-${provider.slug}`}
                className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
              >
                <RadioGroupItem
                  value={provider.slug}
                  id={`org-default-${provider.slug}`}
                />
                <span className="text-sm font-medium">{provider.name}</span>
              </label>
            ))}
          </RadioGroup>
        </div>

        {!modelsLoading && (models ?? []).length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="default-chat-model">Default chat model</Label>
            <Select
              value={policy.default_chat_model_id ?? ''}
              onValueChange={(value) => {
                const model = (models ?? []).find((m) => m.id === value);
                persist({
                  ...policy,
                  default_chat_model_id: value || null,
                  default_provider_slug: model
                    ? integrationSlugFromAIProviderSlug(model.provider_slug)
                    : policy.default_provider_slug,
                });
              }}
              disabled={!isAdmin || savePolicy.isPending}
            >
              <SelectTrigger id="default-chat-model" className="max-w-md">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {(policy.default_provider_slug && modelsForDefaultProvider.length > 0
                  ? [[defaultProviderName ?? 'Default', modelsForDefaultProvider] as const]
                  : Object.entries(
                      (models ?? []).reduce<Record<string, typeof models>>((acc, m) => {
                        const k = m.provider_name;
                        acc[k] = acc[k] ?? [];
                        acc[k]!.push(m);
                        return acc;
                      }, {})
                    )
                ).map(([providerName, providerModels]) => (
                  <SelectGroup key={providerName}>
                    <SelectLabel>{providerName}</SelectLabel>
                    {providerModels?.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {accessMode === 'user_choice' && isAdmin && (
          <div className="space-y-2">
            <Label>Models users can pick from</Label>
            <RadioGroup
              value={policy.user_visible_models}
              onValueChange={(value: UserVisibleModels) => {
                persist({ ...policy, user_visible_models: value });
              }}
              disabled={savePolicy.isPending}
              className="space-y-2"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="all_enabled" id="visible-all" />
                <Label htmlFor="visible-all" className="font-normal">
                  All connected providers (OpenAI, Anthropic, …)
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="default_only" id="visible-default" />
                <Label htmlFor="visible-default" className="font-normal">
                  Default provider only
                </Label>
              </div>
            </RadioGroup>
          </div>
        )}

        {!isAdmin && (
          <p className="text-sm text-muted-foreground">Only admins can change these settings.</p>
        )}
      </CardContent>
    </Card>
  );
}
