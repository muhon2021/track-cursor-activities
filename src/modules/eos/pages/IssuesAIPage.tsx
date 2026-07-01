/**
 * AI Issues & Suggestions Page
 *
 * Shows AI-sourced issues and pending AI suggestion review workflow.
 * Displays suggestion stats, AI-sourced issues table, and a list of
 * pending suggestions with accept/reject actions.
 * Route: /eos/issues/ai
 */

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Bot, CheckCircle2, XCircle, Clock, BarChart3 } from "lucide-react";
import { useEOSIssues, useUpdateIssue, useDeleteIssue } from "../hooks/useEOSIssues";
import {
  useAIIssueSuggestions,
  useSuggestionStats,
  useReviewSuggestion,
} from "../hooks/useAIIssueSuggestions";
import { IssuesTable } from "../components/issues/IssuesTable";
import { IssuesNavTabs } from "../components/issues/IssuesNavTabs";
import { CreateIssueDialog } from "../components/issues/CreateIssueDialog";
import type { IssueFilters } from "../types";

const suggestionTypeBadge: Record<string, { label: string; className: string }> = {
  root_cause: { label: "Root Cause", className: "bg-purple-100 text-purple-800" },
  action_item: { label: "Action Item", className: "bg-blue-100 text-blue-800" },
  related_pattern: { label: "Related Pattern", className: "bg-amber-100 text-amber-800" },
};

export default function IssuesAIPage() {
  const [filters] = useState<IssueFilters>({});
  const [showCreate, setShowCreate] = useState(false);
  const { data: issues, isLoading: issuesLoading } = useEOSIssues(filters);
  const { data: suggestions, isLoading: suggestionsLoading } = useAIIssueSuggestions();
  const { data: suggestionStats } = useSuggestionStats();
  const updateIssue = useUpdateIssue();
  const deleteIssue = useDeleteIssue();
  const reviewSuggestion = useReviewSuggestion();

  const aiIssues = useMemo(
    () => issues?.filter((i) => i.source === "ai") || [],
    [issues],
  );

  const pendingSuggestions = useMemo(
    () => suggestions?.filter((s) => s.status === "pending") || [],
    [suggestions],
  );

  const isLoading = issuesLoading || suggestionsLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI Issues & Suggestions</h1>
          <p className="text-muted-foreground">
            AI-detected issues and intelligent suggestions for review
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Report Issue
        </Button>
      </div>
      <IssuesNavTabs />

      {/* Suggestion Stats */}
      {suggestionStats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-muted-foreground">Total</span>
              </div>
              <p className="text-2xl font-bold mt-1">{suggestionStats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-500" />
                <span className="text-sm text-muted-foreground">Pending</span>
              </div>
              <p className="text-2xl font-bold mt-1">{suggestionStats.pending}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm text-muted-foreground">Accepted</span>
              </div>
              <p className="text-2xl font-bold mt-1">{suggestionStats.accepted}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" />
                <span className="text-sm text-muted-foreground">Rejected</span>
              </div>
              <p className="text-2xl font-bold mt-1">{suggestionStats.rejected}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-indigo-500" />
                <span className="text-sm text-muted-foreground">Avg Confidence</span>
              </div>
              <p className="text-2xl font-bold mt-1">{suggestionStats.avgConfidence}%</p>
            </CardContent>
          </Card>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* AI-Sourced Issues */}
          <div>
            <h2 className="text-lg font-semibold mb-3">AI-Detected Issues</h2>
            <div className="rounded-lg border bg-card">
              <IssuesTable
                issues={aiIssues}
                onStatusChange={(id, status) => updateIssue.mutate({ id, data: { status } })}
                onDelete={(id) => deleteIssue.mutate(id)}
              />
            </div>
          </div>

          {/* Pending Suggestions */}
          {pendingSuggestions.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3">
                Pending Suggestions ({pendingSuggestions.length})
              </h2>
              <div className="space-y-3">
                {pendingSuggestions.map((suggestion) => {
                  const typeConfig = suggestionTypeBadge[suggestion.suggestion_type] || {
                    label: suggestion.suggestion_type,
                    className: "bg-gray-100 text-gray-800",
                  };

                  return (
                    <Card key={suggestion.id}>
                      <CardContent className="pt-4 pb-4 px-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="secondary"
                                className={typeConfig.className}
                              >
                                {typeConfig.label}
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                {Math.round(suggestion.confidence * 100)}% confidence
                              </span>
                            </div>
                            <p className="text-sm">{suggestion.content}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() =>
                                reviewSuggestion.mutate({
                                  id: suggestion.id,
                                  status: "accepted",
                                })
                              }
                              disabled={reviewSuggestion.isPending}
                            >
                              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() =>
                                reviewSuggestion.mutate({
                                  id: suggestion.id,
                                  status: "rejected",
                                })
                              }
                              disabled={reviewSuggestion.isPending}
                            >
                              <XCircle className="mr-1 h-3.5 w-3.5" />
                              Reject
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      <CreateIssueDialog open={showCreate} onOpenChange={setShowCreate} />
    </div>
  );
}
