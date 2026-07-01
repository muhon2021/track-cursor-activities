import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SelectableChatModel } from '@/lib/ai-model-policy';

export interface ModelSelectProps {
  models: SelectableChatModel[];
  value: string;
  onChange: (modelId: string) => void;
  disabled?: boolean;
  showProviderName?: boolean;
  className?: string;
}

export function ModelSelect({
  models,
  value,
  onChange,
  disabled = false,
  showProviderName = true,
  className,
}: ModelSelectProps) {
  if (models.length === 0) return null;

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={className ?? 'w-[200px]'}>
        <SelectValue placeholder="Select model" />
      </SelectTrigger>
      <SelectContent>
        {models.map((model) => (
          <SelectItem key={model.id} value={model.id}>
            <div className="flex items-center gap-2">
              <span>
                {showProviderName
                  ? `${model.provider_name} — ${model.name}`
                  : model.name}
              </span>
              {model.is_default && (
                <Badge variant="secondary" className="text-xs">
                  Default
                </Badge>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
