/**
 * PodSelector - Reusable pod dropdown selector with color dots
 */

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePodOptions } from '@/hooks/usePods';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PodSelectorProps {
  value?: string;
  onValueChange: (value: string | undefined) => void;
  allowAll?: boolean;
  allowClear?: boolean;
  showMemberCount?: boolean;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function PodSelector({
  value,
  onValueChange,
  allowAll = false,
  allowClear = true,
  showMemberCount = false,
  placeholder = 'Select a pod...',
  className,
  disabled,
}: PodSelectorProps) {
  const { data: pods, isLoading } = usePodOptions(showMemberCount);

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center h-10', className)}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Select
      value={value || (allowClear ? '__none__' : undefined)}
      onValueChange={(v) => onValueChange(v === '__none__' ? undefined : v)}
      disabled={disabled}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowClear && (
          <SelectItem value="__none__">
            <span className="text-muted-foreground">All Pods</span>
          </SelectItem>
        )}
        {allowAll && (
          <SelectItem value="__all__">
            <span>All Pods</span>
          </SelectItem>
        )}
        {(pods || []).map((pod) => (
          <SelectItem key={pod.id} value={pod.id}>
            <div className="flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-full shrink-0"
                style={{ backgroundColor: pod.color }}
              />
              <span>{pod.name}</span>
              {showMemberCount && pod.member_count !== undefined && (
                <span className="text-xs text-muted-foreground ml-auto">
                  ({pod.member_count})
                </span>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * PodFilterBar - Compact toolbar filter wrapping PodSelector
 */
export interface PodFilterBarProps {
  value?: string;
  onValueChange: (value: string | undefined) => void;
  showMemberCount?: boolean;
  className?: string;
}

export function PodFilterBar({
  value,
  onValueChange,
  showMemberCount = false,
  className,
}: PodFilterBarProps) {
  return (
    <div className={className}>
      <PodSelector
        value={value}
        onValueChange={onValueChange}
        allowClear
        showMemberCount={showMemberCount}
        placeholder="Filter by pod..."
        className="w-[200px]"
      />
    </div>
  );
}

