import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useGraphifyConfig, useUpdateGraphifyConfig } from '@/modules/graphify/hooks'

export default function GraphifyConfig() {
  const { data: config, isLoading } = useGraphifyConfig()
  const updateConfig = useUpdateGraphifyConfig()

  if (isLoading || !config) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  const save = (updates: Partial<typeof config>) => {
    updateConfig.mutate({ id: config.id, ...updates })
  }

  return (
    <div className="container max-w-2xl py-8 space-y-6">
      <h1 className="text-2xl font-bold">Graphify Configuration</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">General</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="enabled">Enable Graphify</Label>
            <Switch
              id="enabled"
              checked={config.enabled}
              onCheckedChange={(enabled) => save({ enabled })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="extraction">Entity extraction on ingest</Label>
            <Switch
              id="extraction"
              checked={config.entity_extraction_enabled}
              onCheckedChange={(entity_extraction_enabled) => save({ entity_extraction_enabled })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="auto_sync">Auto-sync FK relationships</Label>
            <Switch
              id="auto_sync"
              checked={config.auto_sync_fk_relationships}
              onCheckedChange={(auto_sync_fk_relationships) => save({ auto_sync_fk_relationships })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Traversal limits</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Max traversal depth</Label>
            <Input
              type="number"
              min={1}
              max={5}
              defaultValue={config.max_traversal_depth}
              onBlur={(e) => save({ max_traversal_depth: Number(e.target.value) || 2 })}
            />
          </div>
          <div className="space-y-2">
            <Label>Max nodes per query</Label>
            <Input
              type="number"
              min={10}
              max={200}
              defaultValue={config.max_nodes_per_query}
              onBlur={(e) => save({ max_nodes_per_query: Number(e.target.value) || 50 })}
            />
          </div>
          <div className="space-y-2">
            <Label>Token budget</Label>
            <Input
              type="number"
              min={1000}
              max={32000}
              defaultValue={config.token_budget}
              onBlur={(e) => save({ token_budget: Number(e.target.value) || 8000 })}
            />
          </div>
          <Button disabled={updateConfig.isPending}>
            {updateConfig.isPending ? 'Saving...' : 'Changes save on blur'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
