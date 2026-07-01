/**
 * Hooks for org-wide AI model policy and agent chat model selection.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys, invalidateKeys, cacheConfig } from '@/lib/cache';
import { toast } from 'sonner';
import {
  AGENT_CHAT_MODEL_STORAGE_KEY,
  type AIModelPolicy,
  filterModelsForAgentChat,
  fetchSelectableChatModels,
  getAIModelPolicy,
  resolveAgentChatModelId,
  saveAIModelPolicy,
  shouldShowModelPicker,
} from '@/lib/ai-model-policy';

export function useAIModelPolicy() {
  return useQuery({
    queryKey: queryKeys.integrationSettings.aiModelPolicy(),
    queryFn: getAIModelPolicy,
    staleTime: cacheConfig.staleTime.medium,
  });
}

export function useSelectableChatModels() {
  return useQuery({
    queryKey: queryKeys.integrationSettings.selectableChatModels(),
    queryFn: fetchSelectableChatModels,
    staleTime: cacheConfig.staleTime.short,
  });
}

export function useSaveAIModelPolicy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AIModelPolicy) => saveAIModelPolicy(input),
    onSuccess: (data) => {
      invalidateKeys.integrationSettings(queryClient);
      queryClient.invalidateQueries({ queryKey: ['ai_models'] });
      toast.success('AI model policy saved.');
      data.warnings.forEach((warning) => toast.warning(warning));
    },
    onError: (err: Error) => {
      toast.error('Failed to save AI model policy', { description: err.message });
    },
  });
}

export function useAgentChatModels() {
  const policyQuery = useAIModelPolicy();
  const modelsQuery = useSelectableChatModels();

  const policy = policyQuery.data;
  const allModels = modelsQuery.data ?? [];

  const visibleModels =
    policy != null ? filterModelsForAgentChat(policy, allModels) : allModels;

  const storedModelId =
    typeof window !== 'undefined'
      ? localStorage.getItem(AGENT_CHAT_MODEL_STORAGE_KEY)
      : null;

  const resolvedModelId =
    policy != null
      ? resolveAgentChatModelId(policy, visibleModels, undefined, storedModelId)
      : visibleModels.find((m) => m.is_default)?.id ?? visibleModels[0]?.id;

  const showPicker =
    policy != null ? shouldShowModelPicker(policy, visibleModels) : visibleModels.length > 1;

  const isLoading = policyQuery.isLoading || modelsQuery.isLoading;
  const error = policyQuery.error ?? modelsQuery.error;

  return {
    policy,
    allModels,
    visibleModels,
    resolvedModelId,
    showPicker,
    isLoading,
    error,
  };
}

export function persistAgentChatModelChoice(modelId: string) {
  try {
    localStorage.setItem(AGENT_CHAT_MODEL_STORAGE_KEY, modelId);
  } catch {
    // Ignore quota / private browsing errors
  }
}
