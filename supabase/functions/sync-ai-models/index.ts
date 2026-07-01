/**
 * Sync AI Models Edge Function
 * Automatically discovers and imports available models from AI provider APIs
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface SyncRequest {
  providerSlug: string;
  apiKey?: string;
}

interface ModelData {
  model_id: string;
  name: string;
  category: 'chat' | 'embedding';
  context_window: number;
  input_cost_per_1k: number;
  output_cost_per_1k: number;
  embedding_cost_per_1k: number;
  features?: Record<string, boolean>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse and validate request body
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { providerSlug, apiKey }: SyncRequest = requestBody;

    if (!providerSlug) {
      return new Response(
        JSON.stringify({ success: false, error: 'Provider slug is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get provider from database
    const { data: provider, error: providerError } = await supabase
      .from('ai_providers')
      .select('id, slug, integration_provider_id')
      .eq('slug', providerSlug)
      .single();

    if (providerError || !provider) {
      return new Response(
        JSON.stringify({ success: false, error: 'Provider not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get API key from organization_integrations if not provided
    let effectiveApiKey = apiKey;
    if (!effectiveApiKey && provider.integration_provider_id) {
      const { data: orgIntegration } = await supabase
        .from('organization_integrations')
        .select('config')
        .eq('provider_id', provider.integration_provider_id)
        .single();

      if (orgIntegration?.config?.api_key) {
        effectiveApiKey = orgIntegration.config.api_key;
      }
    }

    // Sync models based on provider
    let models: ModelData[] = [];
    switch (providerSlug) {
      case 'openai':
        models = await syncOpenAIModels(effectiveApiKey);
        break;
      case 'anthropic':
        models = await syncAnthropicModels();
        break;
      case 'google':
        models = await syncGoogleModels(effectiveApiKey);
        break;
      case 'perplexity':
        models = await syncPerplexityModels();
        break;
      default:
        return new Response(
          JSON.stringify({ success: false, error: 'Provider not supported for sync' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // Insert/update models in database
    let syncedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    for (const modelData of models) {
      try {
        // Check if model already exists
        const { data: existingModel } = await supabase
          .from('ai_models')
          .select('id')
          .eq('provider_id', provider.id)
          .eq('model_id', modelData.model_id)
          .single();

        if (existingModel) {
          // Update existing model
          const { error: updateError } = await supabase
            .from('ai_models')
            .update({
              name: modelData.name,
              category: modelData.category,
              context_window: modelData.context_window,
              input_cost_per_1k: modelData.input_cost_per_1k,
              output_cost_per_1k: modelData.output_cost_per_1k,
              embedding_cost_per_1k: modelData.embedding_cost_per_1k,
              features: modelData.features || null,
            })
            .eq('id', existingModel.id);

          if (updateError) {
            console.error('Error updating model:', updateError);
            errorCount++;
          } else {
            updatedCount++;
          }
        } else {
          // Insert new model
          const { error: insertError } = await supabase
            .from('ai_models')
            .insert({
              provider_id: provider.id,
              model_id: modelData.model_id,
              name: modelData.name,
              category: modelData.category,
              context_window: modelData.context_window,
              input_cost_per_1k: modelData.input_cost_per_1k,
              output_cost_per_1k: modelData.output_cost_per_1k,
              embedding_cost_per_1k: modelData.embedding_cost_per_1k,
              features: modelData.features || null,
              enabled: false, // New models are disabled by default
              is_default: false,
            });

          if (insertError) {
            console.error('Error inserting model:', insertError);
            errorCount++;
          } else {
            syncedCount++;
          }
        }
      } catch (error) {
        console.error('Error processing model:', error);
        errorCount++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        synced: syncedCount,
        updated: updatedCount,
        errors: errorCount,
        total: models.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error syncing models:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Sync OpenAI models from their API
 */
async function syncOpenAIModels(apiKey?: string): Promise<ModelData[]> {
  if (!apiKey) {
    throw new Error('OpenAI API key is required');
  }

  const response = await fetch('https://api.openai.com/v1/models', {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  const models: ModelData[] = [];

  // Filter and map relevant models
  const chatModels = data.data.filter((m: any) =>
    m.id.includes('gpt') && !m.id.includes('instruct')
  );

  const embeddingModels = data.data.filter((m: any) =>
    m.id.includes('embedding')
  );

  // Map chat models
  for (const model of chatModels) {
    models.push({
      model_id: model.id,
      name: formatModelName(model.id),
      category: 'chat',
      context_window: getContextWindow(model.id),
      input_cost_per_1k: getInputCost(model.id),
      output_cost_per_1k: getOutputCost(model.id),
      embedding_cost_per_1k: 0,
      features: getModelFeatures(model.id),
    });
  }

  // Map embedding models
  for (const model of embeddingModels) {
    models.push({
      model_id: model.id,
      name: formatModelName(model.id),
      category: 'embedding',
      context_window: getContextWindow(model.id),
      input_cost_per_1k: 0,
      output_cost_per_1k: 0,
      embedding_cost_per_1k: getEmbeddingCost(model.id),
    });
  }

  return models;
}

/**
 * Sync Anthropic models (hardcoded as they don't have a models API)
 */
async function syncAnthropicModels(): Promise<ModelData[]> {
  return [
    {
      model_id: 'claude-opus-4-20250514',
      name: 'Claude Opus 4',
      category: 'chat',
      context_window: 200000,
      input_cost_per_1k: 0.015,
      output_cost_per_1k: 0.075,
      embedding_cost_per_1k: 0,
      features: { reasoning: true, highest_quality: true },
    },
    {
      model_id: 'claude-sonnet-4-20250514',
      name: 'Claude Sonnet 4',
      category: 'chat',
      context_window: 200000,
      input_cost_per_1k: 0.003,
      output_cost_per_1k: 0.015,
      embedding_cost_per_1k: 0,
      features: { fast: true, reasoning: true },
    },
    {
      model_id: 'claude-3-5-sonnet-20241022',
      name: 'Claude 3.5 Sonnet',
      category: 'chat',
      context_window: 200000,
      input_cost_per_1k: 0.003,
      output_cost_per_1k: 0.015,
      embedding_cost_per_1k: 0,
      features: { vision: true, fast: true },
    },
    {
      model_id: 'claude-3-5-haiku-20241022',
      name: 'Claude 3.5 Haiku',
      category: 'chat',
      context_window: 200000,
      input_cost_per_1k: 0.001,
      output_cost_per_1k: 0.005,
      embedding_cost_per_1k: 0,
      features: { fast: true },
    },
  ];
}

/**
 * Sync Google Gemini models
 */
async function syncGoogleModels(apiKey?: string): Promise<ModelData[]> {
  // Google's models are relatively static, so we'll hardcode them
  return [
    {
      model_id: 'gemini-2.0-flash-exp',
      name: 'Gemini 2.0 Flash (Experimental)',
      category: 'chat',
      context_window: 1000000,
      input_cost_per_1k: 0,
      output_cost_per_1k: 0,
      embedding_cost_per_1k: 0,
      features: { multimodal: true, fast: true },
    },
    {
      model_id: 'gemini-1.5-pro',
      name: 'Gemini 1.5 Pro',
      category: 'chat',
      context_window: 2000000,
      input_cost_per_1k: 0.00125,
      output_cost_per_1k: 0.005,
      embedding_cost_per_1k: 0,
      features: { multimodal: true, highest_quality: true },
    },
    {
      model_id: 'gemini-1.5-flash',
      name: 'Gemini 1.5 Flash',
      category: 'chat',
      context_window: 1000000,
      input_cost_per_1k: 0.000075,
      output_cost_per_1k: 0.0003,
      embedding_cost_per_1k: 0,
      features: { multimodal: true, fast: true },
    },
  ];
}

/**
 * Sync Perplexity models
 */
async function syncPerplexityModels(): Promise<ModelData[]> {
  return [
    {
      model_id: 'sonar',
      name: 'Sonar',
      category: 'chat',
      context_window: 127000,
      input_cost_per_1k: 0.001,
      output_cost_per_1k: 0.001,
      embedding_cost_per_1k: 0,
      features: { web_search: true, fast: true },
    },
    {
      model_id: 'sonar-pro',
      name: 'Sonar Pro',
      category: 'chat',
      context_window: 127000,
      input_cost_per_1k: 0.003,
      output_cost_per_1k: 0.015,
      embedding_cost_per_1k: 0,
      features: { web_search: true, reasoning: true },
    },
  ];
}

// Helper functions
function formatModelName(modelId: string): string {
  return modelId
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getContextWindow(modelId: string): number {
  const contextMap: Record<string, number> = {
    'gpt-4o': 128000,
    'gpt-4o-mini': 128000,
    'gpt-4-turbo': 128000,
    'gpt-4': 8192,
    'gpt-3.5-turbo': 16385,
    'text-embedding-3-large': 8191,
    'text-embedding-3-small': 8191,
    'text-embedding-ada-002': 8191,
  };

  for (const [key, value] of Object.entries(contextMap)) {
    if (modelId.includes(key)) return value;
  }

  return 8192; // Default
}

function getInputCost(modelId: string): number {
  const costMap: Record<string, number> = {
    'gpt-4o': 0.0025,
    'gpt-4o-mini': 0.00015,
    'gpt-4-turbo': 0.01,
    'gpt-4': 0.03,
    'gpt-3.5-turbo': 0.0005,
  };

  for (const [key, value] of Object.entries(costMap)) {
    if (modelId.includes(key)) return value;
  }

  return 0;
}

function getOutputCost(modelId: string): number {
  const costMap: Record<string, number> = {
    'gpt-4o': 0.01,
    'gpt-4o-mini': 0.0006,
    'gpt-4-turbo': 0.03,
    'gpt-4': 0.06,
    'gpt-3.5-turbo': 0.0015,
  };

  for (const [key, value] of Object.entries(costMap)) {
    if (modelId.includes(key)) return value;
  }

  return 0;
}

function getEmbeddingCost(modelId: string): number {
  const costMap: Record<string, number> = {
    'text-embedding-3-large': 0.00013,
    'text-embedding-3-small': 0.00002,
    'text-embedding-ada-002': 0.0001,
  };

  for (const [key, value] of Object.entries(costMap)) {
    if (modelId.includes(key)) return value;
  }

  return 0;
}

function getModelFeatures(modelId: string): Record<string, boolean> {
  const features: Record<string, boolean> = {};

  if (modelId.includes('gpt-4o')) {
    features.vision = true;
    features.multimodal = true;
  }
  if (modelId.includes('mini') || modelId.includes('3.5')) {
    features.fast = true;
  }
  if (modelId.includes('gpt-4') && !modelId.includes('mini')) {
    features.reasoning = true;
  }

  return features;
}
