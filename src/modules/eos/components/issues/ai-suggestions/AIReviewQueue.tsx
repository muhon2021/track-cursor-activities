/**
 * AI Review Queue
 *
 * Lists all pending AI suggestions for review with accept/reject actions.
 * Can optionally filter to a single issue.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, Clock, Loader2 } from "lucide-react";
import {
  useAIIssueSuggestions,
  useReviewSuggestion,
} from "../../../hooks/useAIIssueSuggestions";
import { AISuggestionCard } from "./AISuggestionCard";

interface AIReviewQueueProps {
  issueId?: string;
}

export function AIReviewQueue({ issueId }: AIReviewQueueProps) {
  const { data: suggestions, isLoading } = useAIIssueSuggestions({
    status: "pending",
    issue_id: issueId,
  });
  const reviewMutation = useReviewSuggestion();

  const handleAccept = (id: string) => {
    reviewMutation.mutate({ id, status: "accepted" });
  };

  const handleReject = (id: string) => {
    reviewMutation.mutate({ id, status: "rejected" });
  };

  const count = suggestions?.length ?? 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4" />
            Review Queue
          </CardTitle>
          {count > 0 && (
            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
              <Clock className="h-3 w-3 mr-1" />
              {count} pending
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : count === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Bot className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No pending suggestions to review</p>
          </div>
        ) : (
          <div className="space-y-3">
            {suggestions!.map((suggestion) => (
              <AISuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                showActions
                onAccept={handleAccept}
                onReject={handleReject}
                isReviewing={reviewMutation.isPending}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
