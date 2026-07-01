import { Link } from 'react-router-dom'
import { FileText } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { truncateText } from '@/lib/utils'
import { KbRerankBadge } from './KbRerankBadge'
import { KbConfidenceBadge } from './KbConfidenceBadge'
import { KbChunkLayoutBadge, resolveChunkLayoutType } from './KbChunkLayoutBadge'
import type { KbSearchResultBase } from '@/types/knowledgeV2'

interface KbSearchResultSnippetProps {
  result: KbSearchResultBase
  reranked?: boolean
  titleHref?: string
  maxContentLength?: number
}

export function KbSearchResultSnippet({
  result,
  reranked,
  titleHref,
  maxContentLength = 300,
}: KbSearchResultSnippetProps) {
  const layoutType = resolveChunkLayoutType(result.metadata)
  const entityId = result.metadata?.entity_id
  const href = titleHref ?? (entityId ? `/knowledge/${entityId}` : undefined)
  const title = result.metadata?.title

  return (
    <Card className="hover:shadow-md transition-all">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              {title && href ? (
                <Link
                  to={href}
                  className="font-medium hover:text-primary hover:underline truncate"
                >
                  {title}
                </Link>
              ) : title ? (
                <span className="font-medium truncate">{title}</span>
              ) : (
                <span className="font-medium text-muted-foreground">
                  {result.metadata?.entity_type || 'Knowledge'} chunk
                </span>
              )}
              {result.metadata?.chunk_index !== undefined ? (
                <Badge variant="outline" className="text-xs">
                  Chunk {(result.metadata.chunk_index as number) + 1}
                </Badge>
              ) : null}
              <KbChunkLayoutBadge layoutType={layoutType} />
              <KbRerankBadge reranked={reranked ?? result.reranked} />
            </div>
            <p className="text-sm text-muted-foreground line-clamp-3">
              {truncateText(result.content, maxContentLength)}
            </p>
          </div>
          <KbConfidenceBadge
            similarity={result.similarity}
            rerank_score={result.rerank_score}
          />
        </div>
      </CardContent>
    </Card>
  )
}
