import { Link } from "react-router-dom";
import { useRelatedEntries } from "../hooks/useKnowledge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Clock, Eye, Sparkles } from "lucide-react";

interface RelatedArticlesProps {
  entryId: string;
  limit?: number;
  className?: string;
}

export function RelatedArticles({
  entryId,
  limit = 4,
  className = "",
}: RelatedArticlesProps) {
  const { data: relatedEntries = [], isLoading } = useRelatedEntries(
    entryId,
    limit
  );

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Related Articles
          </CardTitle>
          <CardDescription>Finding similar content...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (relatedEntries.length === 0) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Related Articles
        </CardTitle>
        <CardDescription>
          Similar content you might find useful
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {relatedEntries.map((related: any) => (
          <Link
            key={related.id}
            to={`/knowledge/${related.id}`}
            className="block rounded-lg border p-3 transition-all hover:bg-accent hover:shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div className="mt-1">
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="font-medium leading-snug line-clamp-2">
                  {related.title}
                </div>
                {related.summary && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {related.summary}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {related.knowledge_categories && (
                    <Badge variant="outline" className="text-xs">
                      {related.knowledge_categories.name}
                    </Badge>
                  )}
                  {related.reading_time_minutes && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {related.reading_time_minutes} min
                    </span>
                  )}
                  {related.view_count !== null && related.view_count > 0 && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Eye className="h-3 w-3" />
                      {related.view_count}
                    </span>
                  )}
                  {related.similarity_score && (
                    <Badge variant="secondary" className="text-xs">
                      {Math.round(related.similarity_score * 100)}% match
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
