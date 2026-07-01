/**
 * Inline agent AI access bar — sits in the provider card grid (full width).
 */

import { useEffect, useState } from 'react';
import { useAIModelPolicy, useSaveAIModelPolicy } from '@/hooks/useAIModelPolicy';
import {
  DEFAULT_AI_MODEL_POLICY,
  type AIModelPolicy,
} from '@/lib/ai-model-policy';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Loader2, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AIAgentAccessInlineProps {
  connectedProviderNames: { slug: string; name: string }[];
  defaultProviderSlug: string | null | undefined;
}

export function AIAgentAccessInline({
  connectedProviderNames,
  defaultProviderSlug,
}: AIAgentAccessInlineProps) {
  const { data: savedPolicy, isLoading } = useAIModelPolicy();
  const savePolicy = useSaveAIModelPolicy();
  const [policy, setPolicy] = useState<AIModelPolicy>(DEFAULT_AI_MODEL_POLICY);

  useEffect(() => {
    if (savedPolicy) setPolicy(savedPolicy);
  }, [savedPolicy]);

  if (connectedProviderNames.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
        Connect an AI provider below, then choose which one agents use.
      </div>
    );
  }

  const accessMode =
    policy.selection_mode === 'admin_locked' ? 'admin_default' : 'user_choice';
  const isUserChoice = accessMode === 'user_choice';

  const persist = (next: AIModelPolicy) => {
    setPolicy(next);
    savePolicy.mutate(next);
  };

  const defaultName =
    connectedProviderNames.find((p) => p.slug === defaultProviderSlug)?.name ??
    defaultProviderSlug?.replace(/-/g, ' ');

  return (
    <div
      className={cn(
        'rounded-xl border-2 border-primary/30 bg-primary/5 p-4',
        'flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'
      )}
    >
      <div className="space-y-1 min-w-0">
        <p className="font-semibold text-sm">Agent AI provider access</p>
        <p className="text-xs text-muted-foreground">
          {isUserChoice
            ? 'Users pick their AI provider and model in agent chat from all connected providers below.'
            : 'Every user uses one default provider. Click '}
          {!isUserChoice && (
            <>
              <Star className="inline h-3 w-3 fill-primary text-primary" /> on a connected card
              below to choose it.
            </>
          )}
        </p>
      </div>

      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <RadioGroup
            value={accessMode}
            onValueChange={(v) =>
              persist({
                ...policy,
                selection_mode: v === 'admin_default' ? 'admin_locked' : 'user_choice',
                user_visible_models:
                  v === 'user_choice' ? 'all_enabled' : policy.user_visible_models,
              })
            }
            disabled={savePolicy.isPending}
            className="flex flex-wrap gap-2"
          >
            <label
              htmlFor="inline-admin-default"
              className="flex cursor-pointer items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:ring-1 has-[[data-state=checked]]:ring-primary/30"
            >
              <RadioGroupItem value="admin_default" id="inline-admin-default" />
              <span>Admin default only</span>
            </label>
            <label
              htmlFor="inline-user-choice"
              className="flex cursor-pointer items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:ring-1 has-[[data-state=checked]]:ring-primary/30"
            >
              <RadioGroupItem value="user_choice" id="inline-user-choice" />
              <span>Users can choose</span>
            </label>
          </RadioGroup>

          {isUserChoice ? (
            <Badge variant="outline" className="shrink-0">
              {connectedProviderNames.length} provider
              {connectedProviderNames.length === 1 ? '' : 's'} available in chat
            </Badge>
          ) : defaultProviderSlug ? (
            <Badge variant="default" className="gap-1 shrink-0">
              <Star className="h-3 w-3 fill-current" />
              Default: {defaultName}
            </Badge>
          ) : (
            <Badge variant="outline" className="shrink-0">
              No default — click ★ on a card
            </Badge>
          )}

          {savePolicy.isPending && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
      )}
    </div>
  );
}
