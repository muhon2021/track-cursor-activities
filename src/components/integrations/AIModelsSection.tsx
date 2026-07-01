/**
 * AI Models Section Component
 * Displays and manages AI models for AI providers within the integration detail page
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Star,
  DollarSign,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Calculator,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  integrationSlugToAIProviderSlug,
  setGlobalDefaultChatModel,
} from '@/lib/ai-model-policy';

interface AIModel {
  id: string;
  provider_id: string;
  name: string;
  model_id: string;
  category: 'chat' | 'embedding';
  context_window: number;
  input_cost_per_1k: number;
  output_cost_per_1k: number;
  embedding_cost_per_1k: number;
  enabled: boolean;
  is_default: boolean;
  features: Record<string, boolean> | null;
}

interface AIModelsSectionProps {
  providerId: string;
  providerSlug: string;
  providerName: string;
  isConnected: boolean;
}

export function AIModelsSection({
  providerId,
  providerSlug,
  providerName,
  isConnected,
}: AIModelsSectionProps) {
  const { toast } = useToast();
  const [models, setModels] = useState<AIModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Cost calculator state
  const [inputTokens, setInputTokens] = useState(1000);
  const [outputTokens, setOutputTokens] = useState(1000);
  const [embeddingTokens, setEmbeddingTokens] = useState(1000);

  useEffect(() => {
    loadModels();
  }, [providerId]);

  const loadModels = async () => {
    setLoading(true);
    try {
      // First check if this provider exists in ai_providers table
      const aiProviderSlug = integrationSlugToAIProviderSlug(providerSlug);
      const { data: aiProvider } = await supabase
        .from('ai_providers')
        .select('id')
        .eq('slug', aiProviderSlug)
        .single();

      if (!aiProvider) {
        // Provider not in ai_providers table yet
        setModels([]);
        setLoading(false);
        return;
      }

      // Load models for this provider
      const { data: modelsData, error } = await supabase
        .from('ai_models')
        .select('*')
        .eq('provider_id', aiProvider.id)
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;

      setModels(
        (modelsData || []).map((m) => ({
          id: m.id,
          provider_id: m.provider_id,
          name: m.name,
          model_id: m.model_id,
          category: m.category as 'chat' | 'embedding',
          context_window: m.context_window,
          input_cost_per_1k: m.input_cost_per_1k,
          output_cost_per_1k: m.output_cost_per_1k,
          embedding_cost_per_1k: m.embedding_cost_per_1k,
          enabled: m.enabled,
          is_default: m.is_default,
          features: m.features as Record<string, boolean> | null,
        }))
      );
    } catch (error) {
      console.error('Error loading AI models:', error);
      toast({
        title: 'Error',
        description: 'Failed to load AI models',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleModel = async (modelId: string, enabled: boolean) => {
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('ai_models')
        .update({ enabled })
        .eq('id', modelId);

      if (error) throw error;

      setModels((prev) =>
        prev.map((m) => (m.id === modelId ? { ...m, enabled } : m))
      );

      toast({
        title: enabled ? 'Model Enabled' : 'Model Disabled',
        description: `Model has been ${enabled ? 'enabled' : 'disabled'} successfully.`,
      });
    } catch (error) {
      console.error('Error toggling model:', error);
      toast({
        title: 'Error',
        description: 'Failed to update model status',
        variant: 'destructive',
      });
    } finally {
      setUpdating(false);
    }
  };

  const setDefaultModel = async (modelId: string, category: 'chat' | 'embedding') => {
    setUpdating(true);
    try {
      const model = models.find((m) => m.id === modelId);
      if (!model) return;

      if (category === 'chat') {
        await setGlobalDefaultChatModel(modelId);
      } else {
        const { error: unsetError } = await supabase
          .from('ai_models')
          .update({ is_default: false })
          .eq('category', category);

        if (unsetError) throw unsetError;

        const { error: setError } = await supabase
          .from('ai_models')
          .update({ is_default: true })
          .eq('id', modelId);

        if (setError) throw setError;
      }

      setModels((prev) =>
        prev.map((m) =>
          m.category === category
            ? { ...m, is_default: m.id === modelId }
            : m
        )
      );

      toast({
        title: 'Default Model Updated',
        description: `${model.name} is now the default ${category} model.`,
      });
    } catch (error) {
      console.error('Error setting default model:', error);
      toast({
        title: 'Error',
        description: 'Failed to set default model',
        variant: 'destructive',
      });
    } finally {
      setUpdating(false);
    }
  };

  const calculateCosts = () => {
    return models.map((model) => {
      let cost = 0;
      if (model.category === 'chat') {
        cost =
          (inputTokens / 1000) * model.input_cost_per_1k +
          (outputTokens / 1000) * model.output_cost_per_1k;
      } else {
        cost = (embeddingTokens / 1000) * model.embedding_cost_per_1k;
      }
      return { ...model, estimatedCost: cost };
    });
  };

  const formatCost = (cost: number) => {
    return `$${cost.toFixed(6)}`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex h-48 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            Models Not Available
          </CardTitle>
          <CardDescription>
            Connect your {providerName} account to manage AI models
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (models.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>AI Models</CardTitle>
          <CardDescription>No AI models configured for this provider</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const chatModels = models.filter((m) => m.category === 'chat');
  const embeddingModels = models.filter((m) => m.category === 'embedding');

  return (
    <div className="space-y-6">
      {/* Chat Models */}
      {chatModels.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Chat Models</CardTitle>
                <CardDescription>
                  Manage chat completion models for {providerName}
                </CardDescription>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Calculator className="mr-2 h-4 w-4" />
                    Cost Calculator
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Chat Model Cost Calculator</DialogTitle>
                    <DialogDescription>
                      Estimate costs based on token usage
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="input-tokens">Input Tokens</Label>
                        <Input
                          id="input-tokens"
                          type="number"
                          value={inputTokens}
                          onChange={(e) => setInputTokens(Number(e.target.value))}
                          min={0}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="output-tokens">Output Tokens</Label>
                        <Input
                          id="output-tokens"
                          type="number"
                          value={outputTokens}
                          onChange={(e) => setOutputTokens(Number(e.target.value))}
                          min={0}
                        />
                      </div>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Model</TableHead>
                          <TableHead>Input Cost</TableHead>
                          <TableHead>Output Cost</TableHead>
                          <TableHead className="text-right">Estimated Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {calculateCosts()
                          .filter((m) => m.category === 'chat')
                          .map((model) => (
                            <TableRow key={model.id}>
                              <TableCell className="font-medium">{model.name}</TableCell>
                              <TableCell>
                                {formatCost(
                                  (inputTokens / 1000) * model.input_cost_per_1k
                                )}
                              </TableCell>
                              <TableCell>
                                {formatCost(
                                  (outputTokens / 1000) * model.output_cost_per_1k
                                )}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {formatCost(model.estimatedCost)}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead>Context Window</TableHead>
                  <TableHead>Cost (per 1K tokens)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {chatModels.map((model) => (
                  <TableRow key={model.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{model.name}</span>
                        {model.is_default && (
                          <Badge variant="secondary" className="text-xs">
                            <Star className="mr-1 h-3 w-3" />
                            Default
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {model.model_id}
                      </div>
                    </TableCell>
                    <TableCell>
                      {model.context_window.toLocaleString()} tokens
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-xs">
                        <DollarSign className="h-3 w-3" />
                        <span>In: {model.input_cost_per_1k.toFixed(4)}</span>
                        <span className="text-muted-foreground">|</span>
                        <span>Out: {model.output_cost_per_1k.toFixed(4)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {model.enabled ? (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Enabled
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Disabled</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!model.is_default && model.enabled && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDefaultModel(model.id, 'chat')}
                            disabled={updating}
                          >
                            Set Default
                          </Button>
                        )}
                        <Switch
                          checked={model.enabled}
                          onCheckedChange={(enabled) => toggleModel(model.id, enabled)}
                          disabled={updating}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Embedding Models */}
      {embeddingModels.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Embedding Models</CardTitle>
                <CardDescription>
                  Manage embedding models for {providerName}
                </CardDescription>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Calculator className="mr-2 h-4 w-4" />
                    Cost Calculator
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl">
                  <DialogHeader>
                    <DialogTitle>Embedding Model Cost Calculator</DialogTitle>
                    <DialogDescription>
                      Estimate costs based on token usage
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="embedding-tokens">Embedding Tokens</Label>
                      <Input
                        id="embedding-tokens"
                        type="number"
                        value={embeddingTokens}
                        onChange={(e) => setEmbeddingTokens(Number(e.target.value))}
                        min={0}
                      />
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Model</TableHead>
                          <TableHead>Cost per 1K</TableHead>
                          <TableHead className="text-right">Estimated Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {calculateCosts()
                          .filter((m) => m.category === 'embedding')
                          .map((model) => (
                            <TableRow key={model.id}>
                              <TableCell className="font-medium">{model.name}</TableCell>
                              <TableCell>
                                {formatCost(model.embedding_cost_per_1k)}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {formatCost(model.estimatedCost)}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead>Cost (per 1K tokens)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {embeddingModels.map((model) => (
                  <TableRow key={model.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{model.name}</span>
                        {model.is_default && (
                          <Badge variant="secondary" className="text-xs">
                            <Star className="mr-1 h-3 w-3" />
                            Default
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {model.model_id}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-xs">
                        <DollarSign className="h-3 w-3" />
                        {model.embedding_cost_per_1k.toFixed(4)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {model.enabled ? (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Enabled
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Disabled</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!model.is_default && model.enabled && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDefaultModel(model.id, 'embedding')}
                            disabled={updating}
                          >
                            Set Default
                          </Button>
                        )}
                        <Switch
                          checked={model.enabled}
                          onCheckedChange={(enabled) => toggleModel(model.id, enabled)}
                          disabled={updating}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
