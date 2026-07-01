/**
 * AI Suggestion Card
 *
 * Displays a single AI-generated suggestion with type badge, confidence bar,
 * status indicator, and optional accept/reject actions.
 */

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle,
  XCircle,
  Clock,
  Lightbulb,
  GitBranch,
  Loader2,
} from "lucide-react";
import type { EOSIssueSuggestion } from "../../../types";

const typeConfig: Record<
  EOSIssueSuggestion["suggestion_type"],
  { label: string; color: string; icon: React.ElementType }
> = {
  root_cause: { label: "Root Cause", color: "bg-purple-100 text-purple-800", icon: Lightbulb },
  action_item: { label: "Action Item", color: "bg-blue-100 text-blue-800", icon: CheckCircle },
  related_pattern: { label: "Related Pattern", color: "bg-amber-100 text-amber-800", icon: GitBranch },
};

const statusConfig: Record<
  EOSIssueSuggestion["status"],
  { label: string; color: string }
> = {
  pending: { label: "Pending", color: "bg-gray-100 text-gray-700" },
  accepted: { label: "Accepted", color: "bg-green-100 text-green-800" },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-800" },
};

interface AISuggestionCardProps {
  suggestion: EOSIssueSuggestion;
  onAccept?: (id: string) => void;
  onReject?: (id: string) => void;
  showActions?: boolean;
  isReviewing?: boolean;
}

export function AISuggestionCard({
  suggestion,
  onAccept,
  onReject,
  showActions = false,
  isReviewing = false,
}: AISuggestionCardProps) {
  const type = typeConfig[suggestion.suggestion_type];
  const status = statusConfig[suggestion.status];
  const TypeIcon = type.icon;
  const confidencePercent = Math.round(suggestion.confidence * 100);

  const createdDate = new Date(suggestion.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="secondary" className={type.color}>
            <TypeIcon className="h-3 w-3 mr-1" />
            {type.label}
          </Badge>
          <Badge variant="secondary" className={status.color}>
            {status.label}
          </Badge>
        </div>

        <p className="text-sm leading-relaxed">{suggestion.content}</p>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Confidence</span>
            <span className="font-medium">{confidencePercent}%</span>
          </div>
          <Progress value={confidencePercent} className="h-1.5" />
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{createdDate}</span>
          {suggestion.ai_model && (
            <span className="text-xs text-muted-foreground">
              Model: {suggestion.ai_model}
            </span>
          )}
        </div>

        {showActions && suggestion.status === "pending" && (
          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              className="text-green-600 hover:text-green-700 hover:bg-green-50"
              onClick={() => onAccept?.(suggestion.id)}
              disabled={isReviewing}
            >
              {isReviewing ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <CheckCircle className="h-3.5 w-3.5 mr-1" />
              )}
              Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => onReject?.(suggestion.id)}
              disabled={isReviewing}
            >
              {isReviewing ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <XCircle className="h-3.5 w-3.5 mr-1" />
              )}
              Reject
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
