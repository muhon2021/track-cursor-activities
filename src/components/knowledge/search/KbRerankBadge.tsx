import { Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useOrganization } from '@/contexts/OrganizationContext'

interface KbRerankBadgeProps {
  reranked?: boolean
  className?: string
}

export function KbRerankBadge({ reranked, className }: KbRerankBadgeProps) {
  const org = useOrganization()

  if (!org.features.enableKbCohere || !reranked) return null

  return (
    <Badge
      variant="outline"
      className={`text-xs font-medium border-violet-300 text-violet-700 bg-violet-50 dark:border-violet-700 dark:text-violet-300 dark:bg-violet-950/40 gap-1 ${className ?? ''}`}
    >
      <Sparkles className="h-3 w-3" />
      Enhanced with Cohere Rerank
    </Badge>
  )
}
