/**
 * AI Provider connect settings — Flow 5 from Integration Hub spec.
 * Model variant selector, default provider toggle, optional generation params.
 */

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  integrationSlugToAIProviderSlug,
  setDefaultAIProvider,
  clearDefaultAIProvider,
  setGlobalDefaultChatModel,
} from '@/lib/ai-model-policy';
import { useAIModelPolicy } from '@/hooks/useAIModelPolicy';
import { useQueryClient } from '@tanstack/react-query';
import { invalidateKeys } from '@/lib/cache';
import { toast } from 'sonner';

interface ProviderChatModel {
  id: string;
  name: string;
  model_id: string;
  is_default: boolean;
}

interface AIProviderConnectSettingsProps {
  providerSlug: string;
  providerName: string;
  isConnected: boolean;
  config: Record<string, string>;
  onConfigChange: (key: string, value: string) => void;
}

export function AIProviderConnectSettings({
  providerSlug,
  providerName,
  isConnected,
  config,
  onConfigChange,
}: AIProviderConnectSettingsProps) {
  const queryClient = useQueryClient();
  const { data: policy, isLoading: policyLoading } = useAIModelPolicy();
  const [models, setModels] = useState<ProviderChatModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);
  const [saving, setSaving] = useState(false);

  const isDefaultProvider = policy?.default_provider_slug === providerSlug;
  const selectedModelId = config.preferred_chat_model_id ?? '';

  const showBaseUrl = providerSlug === 'openai' || providerSlug === 'anthropic';

  useEffect(() => {
    if (!isConnected) {
      setModels([]);
      setLoadingModels(false);
      return;
    }

    const load = async () => {
      setLoadingModels(true);
      try {
        const aiSlug = integrationSlugToAIProviderSlug(providerSlug);
        const { data: aiProvider } = await supabase
          .from('ai_providers')
          .select('id')
          .eq('slug', aiSlug)
          .maybeSingle();

        if (!aiProvider) {
          setModels([]);
          return;
        }

        const { data, error } = await supabase
          .from('ai_models')
          .select('id, name, model_id, is_default')
          .eq('provider_id', aiProvider.id)
          .eq('category', 'chat')
          .eq('enabled', true)
          .order('name');

        if (error) throw error;
        setModels(data ?? []);
      } catch (err) {
        console.error('Failed to load provider chat models:', err);
      } finally {
        setLoadingModels(false);
      }
    };

    void load();
  }, [providerSlug, isConnected]);

  const defaultModelForProvider = useMemo(
    () => models.find((m) => m.id === policy?.default_chat_model_id) ?? models.find((m) => m.is_default),
    [models, policy?.default_chat_model_id]
  );

  const handleDefaultProviderToggle = async (checked: boolean) => {
    setSaving(true);
    try {
      const modelId = selectedModelId || defaultModelForProvider?.id || models[0]?.id || null;
      if (checked) {
        if (!modelId) {
          toast.error('Sync or enable at least one chat model before setting as default provider.');
          return;
        }
        const result = await setDefaultAIProvider(providerSlug, modelId);
        onConfigChange('preferred_chat_model_id', modelId);
        invalidateKeys.integrationSettings(queryClient);
        result.warnings.forEach((w) => toast.warning(w));
        toast.success(`${providerName} is now the default AI provider.`);
      } else {
        const result = await clearDefaultAIProvider(providerSlug);
        invalidateKeys.integrationSettings(queryClient);
        result.warnings.forEach((w) => toast.warning(w));
        toast.success('Default AI provider cleared.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update default provider');
    } finally {
      setSaving(false);
    }
  };

  const handleModelChange = async (modelId: string) => {
    onConfigChange('preferred_chat_model_id', modelId);
    if (!isDefaultProvider) return;

    setSaving(true);
    try {
      await setGlobalDefaultChatModel(modelId);
      await setDefaultAIProvider(providerSlug, modelId);
      invalidateKeys.integrationSettings(queryClient);
      toast.success('Default model updated for this provider.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update default model');
    } finally {
      setSaving(false);
    }
  };

  if (!isConnected) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">AI Provider Settings</CardTitle>
        <CardDescription>
          Choose the default model variant for {providerName} and optionally set this provider
          as the organization default (only one allowed).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {loadingModels || policyLoading ? (
          <div className="flex h-20 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor={`model-variant-${providerSlug}`}>Default model variant</Label>
              <Select
                value={selectedModelId || defaultModelForProvider?.id || ''}
                onValueChange={handleModelChange}
                disabled={saving || models.length === 0}
              >
                <SelectTrigger id={`model-variant-${providerSlug}`}>
                  <SelectValue
                    placeholder={
                      models.length === 0
                        ? 'No models — sync from AI Models admin'
                        : 'Select model variant'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {models.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      <span className="flex items-center gap-2">
                        {model.name}
                        {model.is_default && (
                          <Badge variant="secondary" className="text-xs">
                            Default
                          </Badge>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-md border p-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label htmlFor={`default-provider-${providerSlug}`} className="font-medium">
                    Set as Default AI Provider
                  </Label>
                  {isDefaultProvider && (
                    <Badge className="gap-1">
                      <Star className="h-3 w-3" />
                      Default
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Only one AI provider can be the org default. Used for agent chat and background
                  AI when no model is specified.
                </p>
              </div>
              <Switch
                id={`default-provider-${providerSlug}`}
                checked={isDefaultProvider}
                onCheckedChange={handleDefaultProviderToggle}
                disabled={saving || models.length === 0}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`temperature-${providerSlug}`}>Temperature (optional)</Label>
                <Input
                  id={`temperature-${providerSlug}`}
                  type="number"
                  min={0}
                  max={2}
                  step={0.1}
                  placeholder="0.7"
                  value={config.temperature ?? ''}
                  onChange={(e) => onConfigChange('temperature', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`max-tokens-${providerSlug}`}>Max tokens (optional)</Label>
                <Input
                  id={`max-tokens-${providerSlug}`}
                  type="number"
                  min={1}
                  step={1}
                  placeholder="2000"
                  value={config.max_tokens ?? ''}
                  onChange={(e) => onConfigChange('max_tokens', e.target.value)}
                />
              </div>
            </div>

            {showBaseUrl && (
              <p className="text-xs text-muted-foreground">
                For Azure OpenAI or self-hosted endpoints, set Base URL in the API key section above.
              </p>
            )}

            {models.length === 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open('/admin/ai-models', '_blank')}
              >
                Open AI Models admin to sync models
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
