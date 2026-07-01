import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useGraphifySuggestions, type GraphEntityResult } from '../hooks/useGraphifySuggestions'

interface GraphifySearchInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (value: string, entity?: GraphEntityResult) => void
  placeholder?: string
  className?: string
  inputId?: string
  disabled?: boolean
}

export function GraphifySearchInput({
  value,
  onChange,
  onSubmit,
  placeholder = 'Search entities, topics, people...',
  className,
  inputId,
  disabled,
}: GraphifySearchInputProps) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const { suggestions, isLoading, debouncedTerm } = useGraphifySuggestions(value, open)

  useEffect(() => {
    setActiveIndex(0)
  }, [debouncedTerm, suggestions.length])

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const showList = open && value.trim().length >= 2

  const pick = (label: string, entity?: GraphEntityResult) => {
    onChange(label)
    setOpen(false)
    onSubmit(label, entity)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!showList || suggestions.length === 0) {
      if (e.key === 'Enter') {
        onSubmit(value.trim())
        setOpen(false)
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % suggestions.length)
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const entity = suggestions[activeIndex]
      if (entity) {
        pick(entity.display_name || entity.canonical_name, entity)
      } else {
        onSubmit(value.trim())
        setOpen(false)
      }
      return
    }
    if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <Input
        id={inputId}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-autocomplete="list"
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
      />

      {showList ? (
        <div
          className="absolute z-50 top-full mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md max-h-60 overflow-y-auto"
          role="listbox"
        >
          {isLoading ? (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Searching…
            </div>
          ) : null}

          {!isLoading && suggestions.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              No matches — try fewer words (e.g. &quot;richardson&quot; or &quot;year end&quot;)
            </div>
          ) : null}

          {suggestions.map((entity, index) => {
            const label = entity.display_name || entity.canonical_name
            return (
              <button
                key={entity.id}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className={cn(
                  'w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 hover:bg-accent',
                  index === activeIndex && 'bg-accent'
                )}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => pick(label, entity)}
              >
                <span className="truncate font-medium">{label}</span>
                <Badge variant="secondary" className="shrink-0 text-[10px] h-5">
                  {entity.entity_type}
                </Badge>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
