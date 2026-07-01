import { Loader2, RefreshCw, Hash, CheckCircle2, AlertCircle, Clock } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useOrganization } from '@/contexts/OrganizationContext'
import {
  useKbSlackChannels,
  useKbSlackSyncLedger,
  useToggleKbSlackChannel,
  useSyncKbSlackChannels,
  useDiscoverKbSlackChannels,
} from '@/hooks/useKbSlackChannels'
import { formatDateTime } from '@/lib/utils'

function syncStatusBadge(status: string) {
  const map: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof CheckCircle2 }> = {
    completed: { variant: 'default', icon: CheckCircle2 },
    failed: { variant: 'destructive', icon: AlertCircle },
    running: { variant: 'secondary', icon: Loader2 },
    pending: { variant: 'outline', icon: Clock },
    idle: { variant: 'outline', icon: Clock },
    syncing: { variant: 'secondary', icon: Loader2 },
  }
  const cfg = map[status] ?? map.idle
  const Icon = cfg.icon
  return (
    <Badge variant={cfg.variant} className="gap-1 w-fit">
      <Icon className={`h-3 w-3 ${status === 'running' || status === 'syncing' ? 'animate-spin' : ''}`} />
      {status}
    </Badge>
  )
}

export function SlackDataSourcePanel() {
  const org = useOrganization()
  const { data: channels = [], isLoading } = useKbSlackChannels()
  const { data: ledger = [], isLoading: ledgerLoading } = useKbSlackSyncLedger()
  const toggleChannel = useToggleKbSlackChannel()
  const syncChannels = useSyncKbSlackChannels()
  const discover = useDiscoverKbSlackChannels()

  if (!org.features.enableKbSlack) return null

  const enabledIds = channels.filter((c) => c.is_enabled).map((c) => c.channel_id)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Hash className="h-5 w-5 text-primary" />
            Slack Data Source
          </h3>
          <p className="text-sm text-muted-foreground">
            Select public channels to index into the knowledge base
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => discover.mutate()}
            disabled={discover.isPending}
          >
            {discover.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-1" />
            )}
            Refresh channels
          </Button>
          <Button
            size="sm"
            onClick={() => syncChannels.mutate(enabledIds.length ? enabledIds : undefined)}
            disabled={syncChannels.isPending || enabledIds.length === 0}
          >
            {syncChannels.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-1" />
            )}
            Sync selected
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Public channels</CardTitle>
          <CardDescription>
            {channels.filter((c) => c.is_enabled).length} of {channels.length} enabled
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : channels.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No Slack channels discovered. Connect Slack in Integrations, then refresh.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {channels.map((channel) => (
                <div
                  key={channel.id}
                  className="flex items-center justify-between rounded-lg border p-3 gap-2"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">#{channel.channel_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {channel.member_count} members
                      {channel.last_synced_at
                        ? ` · ${formatDateTime(channel.last_synced_at)}`
                        : ''}
                    </p>
                    <div className="mt-1">{syncStatusBadge(channel.sync_status)}</div>
                  </div>
                  <Switch
                    checked={channel.is_enabled}
                    onCheckedChange={(checked) =>
                      toggleChannel.mutate({
                        channelId: channel.channel_id,
                        enabled: checked,
                      })
                    }
                    disabled={toggleChannel.isPending}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sync status ledger</CardTitle>
          <CardDescription>Recent Slack sync operations</CardDescription>
        </CardHeader>
        <CardContent>
          {ledgerLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : ledger.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No sync runs yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Channel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Messages</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledger.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-sm">#{row.channel_id}</TableCell>
                    <TableCell>{syncStatusBadge(row.status)}</TableCell>
                    <TableCell>{row.messages_synced}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(row.started_at)}
                    </TableCell>
                    <TableCell className="text-xs text-destructive max-w-[160px] truncate">
                      {row.error_message ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
