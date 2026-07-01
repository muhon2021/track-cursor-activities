import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Loader2, Settings2 } from 'lucide-react'
import {
  useUpsertKbSourceConfig,
  useChunkPreview,
} from '@/hooks/useKbSourceConfig'
import type { ChunkStrategy, KbSourceConfigRow, RerankerProvider } from '@/types/knowledgeRag'
import {
  AdvancedParserConfigPanel,
  parseAdvancedParserConfig,
} from '@/components/knowledge/AdvancedParserConfigPanel'
import type { AdvancedParserConfig } from '@/types/knowledgeV2'
import { useOrganization } from '@/contexts/OrganizationContext'

const CHUNK_STRATEGIES: { value: ChunkStrategy; label: string }[] = [
  { value: 'fixed', label: 'Fixed size' },
  { value: 'sentence-window', label: 'Sentence window' },
  { value: 'heading-aware', label: 'Heading aware' },
  { value: 'parent-child', label: 'Parent / child' },
]

const RERANKER_PROVIDERS: { value: RerankerProvider; label: string }[] = [
  { value: 'cohere', label: 'Cohere' },
  { value: 'voyage', label: 'Voyage' },
  { value: 'bge', label: 'BGE' },
  { value: 'custom', label: 'Custom' },
]

interface PipelineConfigurationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sourceId: string
  sourceName: string
  config: KbSourceConfigRow | null
}

export function PipelineConfigurationModal({
  open,
  onOpenChange,
  sourceId,
  sourceName,
  config,
}: PipelineConfigurationModalProps) {
  const org = useOrganization()
  const upsert = useUpsertKbSourceConfig()
  const preview = useChunkPreview()

  const [chunkSize, setChunkSize] = useState(1000)
  const [chunkOverlap, setChunkOverlap] = useState(100)
  const [chunkStrategy, setChunkStrategy] = useState<ChunkStrategy>('fixed')
  const [rerankerEnabled, setRerankerEnabled] = useState(false)
  const [rerankerProvider, setRerankerProvider] = useState<RerankerProvider>('cohere')
  const [rerankerThreshold, setRerankerThreshold] = useState(0.75)
  const [rerankerMaxResults, setRerankerMaxResults] = useState(10)
  const [overrideGlobal, setOverrideGlobal] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [advancedParser, setAdvancedParser] = useState<AdvancedParserConfig>(
    parseAdvancedParserConfig(undefined)
  )
  const [sampleText, setSampleText] = useState('')

  useEffect(() => {
    if (!open) return
    setChunkSize(config?.chunk_size ?? 1000)
    setChunkOverlap(config?.chunk_overlap ?? 100)
    setChunkStrategy(config?.chunk_strategy ?? 'fixed')
    setRerankerEnabled(config?.reranker_enabled ?? false)
    setRerankerProvider(config?.reranker_provider ?? 'cohere')
    setRerankerThreshold(config?.reranker_threshold ?? 0.75)
    setRerankerMaxResults(config?.reranker_max_results ?? 10)
    setOverrideGlobal(config?.reranker_override_global ?? false)
    setAdvancedParser(parseAdvancedParserConfig(config?.strategy_config))
  }, [open, config])

  const handleSave = () => {
    const strategy_config = {
      ...(config?.strategy_config ?? {}),
      ...advancedParser,
    }

    upsert.mutate(
      {
        source_id: sourceId,
        chunk_size: chunkSize,
        chunk_overlap: chunkOverlap,
        chunk_strategy: chunkStrategy,
        strategy_config,
        reranker_enabled: rerankerEnabled,
        reranker_provider: rerankerProvider,
        reranker_threshold: rerankerThreshold,
        reranker_max_results: rerankerMaxResults,
        reranker_override_global: overrideGlobal,
      },
      { onSuccess: () => onOpenChange(false) }
    )
  }

  const handlePreview = () => {
    if (!sampleText.trim()) return
    preview.mutate({
      sample_text: sampleText,
      chunk_size: chunkSize,
      chunk_overlap: chunkOverlap,
      chunk_strategy: chunkStrategy,
      strategy_config: advancedParser,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            Pipeline Configuration
          </DialogTitle>
          <DialogDescription>
            Chunking and retrieval settings for <strong>{sourceName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Chunk size</Label>
              <Input
                type="number"
                min={200}
                max={4000}
                value={chunkSize}
                onChange={(e) => setChunkSize(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Chunk overlap</Label>
              <Input
                type="number"
                min={0}
                max={500}
                value={chunkOverlap}
                onChange={(e) => setChunkOverlap(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Chunk strategy</Label>
            <Select
              value={chunkStrategy}
              onValueChange={(v) => setChunkStrategy(v as ChunkStrategy)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHUNK_STRATEGIES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {org.features.enableKbCohere ? (
            <div className="space-y-3 rounded-md border p-4">
              <div className="flex items-center justify-between">
                <Label>Reranker enabled</Label>
                <Switch checked={rerankerEnabled} onCheckedChange={setRerankerEnabled} />
              </div>
              {rerankerEnabled ? (
                <>
                  <div className="space-y-2">
                    <Label>Provider</Label>
                    <Select
                      value={rerankerProvider}
                      onValueChange={(v) => setRerankerProvider(v as RerankerProvider)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RERANKER_PROVIDERS.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Threshold: {rerankerThreshold.toFixed(2)}</Label>
                    <Slider
                      min={0.3}
                      max={0.95}
                      step={0.05}
                      value={[rerankerThreshold]}
                      onValueChange={([v]) => setRerankerThreshold(v ?? 0.75)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max results</Label>
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      value={rerankerMaxResults}
                      onChange={(e) => setRerankerMaxResults(Number(e.target.value))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Override global reranker</Label>
                    <Switch checked={overrideGlobal} onCheckedChange={setOverrideGlobal} />
                  </div>
                </>
              ) : null}
            </div>
          ) : null}

          <AdvancedParserConfigPanel
            value={advancedParser}
            onChange={setAdvancedParser}
            open={advancedOpen}
            onOpenChange={setAdvancedOpen}
          />

          <div className="space-y-2">
            <Label>Chunk preview (sample text)</Label>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={sampleText}
              onChange={(e) => setSampleText(e.target.value)}
              placeholder="Paste sample content to preview chunking..."
            />
            {preview.data ? (
              <p className="text-xs text-muted-foreground">
                ~{preview.data.estimated_chunks} chunks, est. cost $
                {preview.data.estimated_cost.toFixed(6)}
              </p>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePreview}
              disabled={preview.isPending || !sampleText.trim()}
            >
              {preview.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : null}
              Preview chunks
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={upsert.isPending}>
            {upsert.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Save configuration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
