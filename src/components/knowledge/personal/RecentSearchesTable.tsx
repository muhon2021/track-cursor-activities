import { Globe, Smartphone, Bot, MessageSquare, Code2, Search, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useKbUserSearchHistory } from '@/hooks/useKbUserSearchHistory'
import { formatDateTime } from '@/lib/utils'
import type { KbSearchPlatform } from '@/types/knowledgeV2'
import type { LucideIcon } from 'lucide-react'

const PLATFORM_ICONS: Record<KbSearchPlatform, LucideIcon> = {
  web: Globe,
  mobile: Smartphone,
  api: Code2,
  agent: Bot,
  slack: MessageSquare,
}

const PLATFORM_LABELS: Record<KbSearchPlatform, string> = {
  web: 'Web',
  mobile: 'Mobile',
  api: 'API',
  agent: 'AI Agent',
  slack: 'Slack',
}

export function RecentSearchesTable() {
  const { data: searches = [], isLoading } = useKbUserSearchHistory()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5 text-primary" />
          My Recent Searches
        </CardTitle>
        <CardDescription>Your knowledge search history across platforms</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : searches.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8 px-4">
            No searches recorded yet. Run a semantic search to build your history.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Query</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Results</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {searches.map((row) => {
                const platform = (row.platform ?? 'web') as KbSearchPlatform
                const Icon = PLATFORM_ICONS[platform] ?? Globe
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium max-w-[280px] truncate">
                      {row.query}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Icon className="h-4 w-4 shrink-0" />
                        {PLATFORM_LABELS[platform] ?? platform}
                      </div>
                    </TableCell>
                    <TableCell>{row.result_count}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(row.created_at)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
