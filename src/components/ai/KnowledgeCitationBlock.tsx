import { FileText } from 'lucide-react'
import { useOrganization } from '@/contexts/OrganizationContext'
import { KbSearchResultSnippet } from '@/components/knowledge/search/KbSearchResultSnippet'
import type { KbSearchResultBase } from '@/types/knowledgeV2'

export interface KnowledgeCitation {
  id?: string
  content: string
  similarity?: number
  rerank_score?: number
  reranked?: boolean
  metadata?: Record<string, unknown>
}

interface KnowledgeCitationBlockProps {
  citations: KnowledgeCitation[]
  reranked?: boolean
}

export function KnowledgeCitationBlock({ citations, reranked }: KnowledgeCitationBlockProps) {
  const org = useOrganization()

  if (!citations.length) return null

  const showV2 = org.features.enableKbCohere

  if (!showV2) {
    return (
      <div className="mt-2 space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Sources</p>
        {citations.map((c, i) => (
          <div key={c.id ?? i} className="text-xs rounded border p-2 bg-background/50">
            <p className="line-clamp-2">{c.content}</p>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
        <FileText className="h-3 w-3" />
        Knowledge citations
      </p>
      {citations.map((c, i) => {
        const result: KbSearchResultBase = {
          id: c.id ?? `citation-${i}`,
          content: c.content,
          similarity: c.similarity ?? 0,
          rerank_score: c.rerank_score,
          reranked: c.reranked ?? reranked,
          metadata: c.metadata,
        }
        return (
          <KbSearchResultSnippet
            key={result.id}
            result={result}
            reranked={reranked}
            maxContentLength={200}
          />
        )
      })}
    </div>
  )
}

export function parseKnowledgeCitations(
  metadata: Record<string, unknown> | null | undefined,
  citations: unknown[] | null | undefined
): KnowledgeCitation[] {
  const fromMeta = metadata?.knowledge_citations
  if (Array.isArray(fromMeta) && fromMeta.length > 0) {
    return fromMeta
      .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
      .map((c) => ({
        id: typeof c.id === 'string' ? c.id : undefined,
        content: typeof c.content === 'string' ? c.content : JSON.stringify(c),
        similarity: typeof c.similarity === 'number' ? c.similarity : undefined,
        rerank_score: typeof c.rerank_score === 'number' ? c.rerank_score : undefined,
        reranked: typeof c.reranked === 'boolean' ? c.reranked : undefined,
        metadata: (c.metadata as Record<string, unknown>) ?? {},
      }))
  }

  if (Array.isArray(citations) && citations.length > 0) {
    const knowledgeLike = citations.filter(
      (c): c is Record<string, unknown> =>
        !!c &&
        typeof c === 'object' &&
        (typeof (c as Record<string, unknown>).similarity === 'number' ||
          typeof (c as Record<string, unknown>).similarity_score === 'number' ||
          typeof (c as Record<string, unknown>).chunk_id === 'string')
    )
    if (knowledgeLike.length === 0) return []

    return knowledgeLike.map((c) => ({
        id: typeof c.id === 'string' ? c.id : typeof c.chunk_id === 'string' ? c.chunk_id : undefined,
        content:
          typeof c.content === 'string'
            ? c.content
            : typeof c.text === 'string'
              ? c.text
              : JSON.stringify(c),
        similarity: typeof c.similarity === 'number' ? c.similarity : typeof c.similarity_score === 'number' ? c.similarity_score : undefined,
        rerank_score: typeof c.rerank_score === 'number' ? c.rerank_score : undefined,
        reranked: typeof c.reranked === 'boolean' ? c.reranked : undefined,
        metadata: (c.metadata as Record<string, unknown>) ?? {},
      }))
  }

  return []
}
