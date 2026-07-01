/**
 * Searchable multi-select for integration preference options
 */

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn, formatDateTime } from '@/lib/utils';
import {
  getConnectionStatusLabel,
  getConnectionStatusVariant,
} from '@/lib/integration-utils';
import type { IntegrationPreferenceOption } from '@/lib/integration-preferences';

export interface IntegrationMultiSelectProps {
  options: IntegrationPreferenceOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  emptyMessage?: string;
}

export function IntegrationMultiSelect({
  options,
  selected,
  onChange,
  placeholder = 'Select items...',
  disabled = false,
  emptyMessage = 'No options found.',
}: IntegrationMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = options.filter((opt) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      opt.label.toLowerCase().includes(q) ||
      (opt.categoryLabel?.toLowerCase().includes(q) ?? false) ||
      (opt.description?.toLowerCase().includes(q) ?? false)
    );
  });

  const selectedOptions = selected
    .map((value) => options.find((o) => o.value === value))
    .filter((o): o is IntegrationPreferenceOption => !!o);

  const toggleValue = (value: string) => {
    const option = options.find((o) => o.value === value);
    if (!option?.isSelectable) return;
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const removeValue = (value: string) => {
    onChange(selected.filter((v) => v !== value));
  };

  return (
    <div className="space-y-3">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
            disabled={disabled}
          >
            <span className="truncate text-muted-foreground">
              {selected.length > 0
                ? `${selected.length} selected`
                : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              {filtered.length === 0 ? (
                <CommandEmpty>{emptyMessage}</CommandEmpty>
              ) : (
                <CommandGroup>
                  {filtered.map((option) => {
                    const isSelected = selected.includes(option.value);
                    return (
                      <CommandItem
                        key={option.value}
                        value={option.value}
                        onSelect={() => toggleValue(option.value)}
                        disabled={!option.isSelectable}
                        className={cn(!option.isSelectable && 'opacity-60')}
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            isSelected ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        <div className="flex flex-1 flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{option.label}</span>
                            {option.categoryLabel && (
                              <Badge variant="outline" className="text-xs">
                                {option.categoryLabel}
                              </Badge>
                            )}
                            {option.kind === 'internal' && (
                              <Badge variant="secondary" className="text-xs">
                                Internal
                              </Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <Badge
                              variant={getConnectionStatusVariant(option.connectionStatus)}
                              className="text-xs"
                            >
                              {getConnectionStatusLabel(option.connectionStatus)}
                            </Badge>
                            {option.lastSyncAt && (
                              <span>Last sync: {formatDateTime(option.lastSyncAt)}</span>
                            )}
                            {!option.isSelectable && option.disabledReason && (
                              <span className="text-amber-600 dark:text-amber-400">
                                {option.disabledReason}
                              </span>
                            )}
                          </div>
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedOptions.length > 0 && (
        <div className="space-y-2 rounded-md border p-3">
          {selectedOptions.map((option) => (
            <div
              key={option.value}
              className="flex items-start justify-between gap-2 text-sm"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{option.label}</span>
                  {option.categoryLabel && (
                    <Badge variant="outline" className="text-xs">
                      {option.categoryLabel}
                    </Badge>
                  )}
                  <Badge
                    variant={getConnectionStatusVariant(option.connectionStatus)}
                    className="text-xs"
                  >
                    {getConnectionStatusLabel(option.connectionStatus)}
                  </Badge>
                </div>
                {option.lastSyncAt && (
                  <p className="text-xs text-muted-foreground">
                    Last sync: {formatDateTime(option.lastSyncAt)}
                  </p>
                )}
                {!option.isSelectable && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    {option.disabledReason ?? 'Selected integration is no longer connected.'}
                  </p>
                )}
              </div>
              {!disabled && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => removeValue(option.value)}
                  aria-label={`Remove ${option.label}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {selected.length === 0 && (
        <p className="text-sm text-muted-foreground">No items selected.</p>
      )}
    </div>
  );
}
