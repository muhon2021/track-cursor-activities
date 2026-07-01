/**
 * AI Suggestion Review Dialog
 *
 * Modal for reviewing a single AI suggestion with full details
 * and accept/reject actions.
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle,
  XCircle,
  Lightbulb,
  GitBranch,
  Loader2,
  Bot,
} from "lucide-react";
import { useReviewSuggestion } from "../../../hooks/useAIIssueSuggestions";
import type { EOSIssueSuggestion } from "../../../types";

const typeConfig: Record<
  EOSIssueSuggestion["suggestion_type"],
  { label: string; color: string; icon: React.ElementType }
> = {
  root_cause: { label: "Root Cause", color: "bg-purple-100 text-purple-800", icon: Lightbulb },
  action_item: { label: "Action Item", color: "bg-blue-100 text-blue-800", icon: CheckCircle },
  related_pattern: { label: "Related Pattern", color: "bg-amber-100 text-amber-800", icon: GitBranch },
};

interface AISuggestionReviewDialogProps {
  suggestion: EOSIssueSuggestion | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AISuggestionReviewDialog({
  suggestion,
  open,
  onOpenChange,
}: AISuggestionReviewDialogProps) {
  const reviewMutation = useReviewSuggestion();

  if (!suggestion) return null;

  const type = typeConfig[suggestion.suggestion_type];
  const TypeIcon = type.icon;
  const confidencePercent = Math.round(suggestion.confidence * 100);

  const createdDate = new Date(suggestion.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const handleReview = async (status: "accepted" | "rejected") => {
    await reviewMutation.mutateAsync({ id: suggestion.id, status });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-muted-foreground" />
            Review AI Suggestion
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className={type.color}>
              <TypeIcon className="h-3 w-3 mr-1" />
              {type.label}
            </Badge>
            {suggestion.ai_model && (
              <span className="text-xs text-muted-foreground">
                via {suggestion.ai_model}
              </span>
            )}
          </div>

          <div className="rounded-md border p-3 bg-muted/30">
            <p className="text-sm leading-relaxed">{suggestion.content}</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Confidence</span>
              <span className="font-medium">{confidencePercent}%</span>
            </div>
            <Progress value={confidencePercent} className="h-2" />
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Issue ID</span>
              <p className="font-mono text-xs mt-0.5">{suggestion.issue_id}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Created</span>
              <p className="text-xs mt-0.5">{createdDate}</p>
            </div>
          </div>
        </div>

        {suggestion.status === "pending" && (
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => handleReview("rejected")}
              disabled={reviewMutation.isPending}
            >
              {reviewMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4 mr-1" />
              )}
              Reject
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => handleReview("accepted")}
              disabled={reviewMutation.isPending}
            >
              {reviewMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-1" />
              )}
              Accept
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
