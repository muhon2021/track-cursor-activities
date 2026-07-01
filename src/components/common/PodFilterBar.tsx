/**
 * PodFilterBar - Compact toolbar filter wrapping PodSelector
 * Used for filtering content by pod in various views
 */

import { PodSelector, PodSelectorProps } from './PodSelector';
import { cn } from '@/lib/utils';

export interface PodFilterBarProps extends Omit<PodSelectorProps, 'className'> {
  className?: string;
  label?: string;
}

export function PodFilterBar({
  value,
  onValueChange,
  allowAll = true,
  allowClear = true,
  showMemberCount = false,
  placeholder = 'Filter by pod...',
  className,
  disabled,
  label = 'Pod',
}: PodFilterBarProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {label && (
        <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">
          {label}:
        </label>
      )}
      <PodSelector
        value={value}
        onValueChange={onValueChange}
        allowAll={allowAll}
        allowClear={allowClear}
        showMemberCount={showMemberCount}
        placeholder={placeholder}
        disabled={disabled}
        className="min-w-[200px]"
      />
    </div>
  );
}

