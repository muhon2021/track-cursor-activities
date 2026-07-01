import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ChevronDown } from 'lucide-react'
import { useOrganization } from '@/contexts/OrganizationContext'
import {
  DEFAULT_ADVANCED_PARSER_CONFIG,
  type AdvancedParserConfig,
  type CodeBlockHandling,
  type HeadingSensitivity,
  type OcrLanguage,
} from '@/types/knowledgeV2'

interface AdvancedParserConfigPanelProps {
  value: AdvancedParserConfig
  onChange: (value: AdvancedParserConfig) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const HEADING_OPTIONS: { value: HeadingSensitivity; label: string }[] = [
  { value: 'low', label: 'Low — fewer heading splits' },
  { value: 'medium', label: 'Medium — balanced' },
  { value: 'high', label: 'High — aggressive heading detection' },
]

const CODE_OPTIONS: { value: CodeBlockHandling; label: string }[] = [
  { value: 'preserve', label: 'Preserve — keep fenced blocks' },
  { value: 'flatten', label: 'Flatten — inline as text' },
  { value: 'skip', label: 'Skip — omit code blocks' },
]

const OCR_LANGUAGES: { value: OcrLanguage; label: string }[] = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'eng', label: 'English' },
  { value: 'spa', label: 'Spanish' },
  { value: 'fra', label: 'French' },
  { value: 'deu', label: 'German' },
  { value: 'por', label: 'Portuguese' },
  { value: 'jpn', label: 'Japanese' },
  { value: 'chi_sim', label: 'Chinese (Simplified)' },
]

export function parseAdvancedParserConfig(
  strategyConfig: Record<string, unknown> | undefined
): AdvancedParserConfig {
  if (!strategyConfig) return { ...DEFAULT_ADVANCED_PARSER_CONFIG }
  return {
    table_extraction:
      typeof strategyConfig.table_extraction === 'boolean'
        ? strategyConfig.table_extraction
        : DEFAULT_ADVANCED_PARSER_CONFIG.table_extraction,
    heading_sensitivity:
      (strategyConfig.heading_sensitivity as HeadingSensitivity) ??
      DEFAULT_ADVANCED_PARSER_CONFIG.heading_sensitivity,
    code_block_handling:
      (strategyConfig.code_block_handling as CodeBlockHandling) ??
      DEFAULT_ADVANCED_PARSER_CONFIG.code_block_handling,
    ocr_language:
      (strategyConfig.ocr_language as OcrLanguage) ??
      DEFAULT_ADVANCED_PARSER_CONFIG.ocr_language,
  }
}

export function AdvancedParserConfigPanel({
  value,
  onChange,
  open = false,
  onOpenChange,
}: AdvancedParserConfigPanelProps) {
  const org = useOrganization()

  if (!org.features.enableKbParserAdvanced && !org.features.enableKbOcr) {
    return null
  }

  const patch = (partial: Partial<AdvancedParserConfig>) =>
    onChange({ ...value, ...partial })

  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleTrigger className="group flex w-full items-center justify-between rounded-md border px-4 py-3 text-sm font-medium hover:bg-muted/50">
        <span>Advanced parser configuration</span>
        <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 space-y-4 rounded-md border p-4 bg-muted/20">
        {org.features.enableKbParserAdvanced ? (
          <>
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="table-extraction">Table extraction</Label>
                <p className="text-xs text-muted-foreground">
                  Extract tabular structures into dedicated chunks
                </p>
              </div>
              <Switch
                id="table-extraction"
                checked={value.table_extraction}
                onCheckedChange={(checked) => patch({ table_extraction: checked })}
              />
            </div>

            <div className="space-y-2">
              <Label>Heading detection sensitivity</Label>
              <Select
                value={value.heading_sensitivity}
                onValueChange={(v) =>
                  patch({ heading_sensitivity: v as HeadingSensitivity })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HEADING_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Code block handling</Label>
              <Select
                value={value.code_block_handling}
                onValueChange={(v) =>
                  patch({ code_block_handling: v as CodeBlockHandling })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CODE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        ) : null}

        {org.features.enableKbOcr ? (
          <div className="space-y-2">
            <Label>OCR language</Label>
            <Select
              value={value.ocr_language}
              onValueChange={(v) => patch({ ocr_language: v as OcrLanguage })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OCR_LANGUAGES.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  )
}
