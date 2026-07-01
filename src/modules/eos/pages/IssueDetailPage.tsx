/**
 * Issue Detail Page
 *
 * Displays full details for a single EOS issue.
 */

import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  ArrowLeft,
  AlertTriangle,
  ArrowUp,
  ArrowRight,
  ArrowDown,
  Calendar,
  User,
} from "lucide-react";
import { useEOSIssue, useUpdateIssue } from "../hooks/useEOSIssues";
import { useIssueComments, useAddIssueComment } from "../hooks/useIssueComments";
import { ISSUE_STATUS_LABELS } from "../types";
import { Textarea } from "@/components/ui/textarea";
import type { IssueStatus, IssuePriority } from "../types";

const statusConfig: Record<string, { label: string; className: string }> = {
  open: { label: ISSUE_STATUS_LABELS.open, className: "bg-blue-100 text-blue-800" },
  in_progress: { label: ISSUE_STATUS_LABELS.in_progress, className: "bg-yellow-100 text-yellow-800" },
  in_discussion: { label: ISSUE_STATUS_LABELS.in_discussion, className: "bg-yellow-100 text-yellow-800" },
  solved: { label: ISSUE_STATUS_LABELS.solved, className: "bg-green-100 text-green-800" },
  closed: { label: ISSUE_STATUS_LABELS.closed, className: "bg-green-100 text-green-800" },
  archived: { label: ISSUE_STATUS_LABELS.archived, className: "bg-gray-100 text-gray-600" },
};

const priorityConfig: Record<string, { icon: React.ReactNode; label: string }> = {
  low: { icon: <ArrowDown className="h-4 w-4 text-gray-400" />, label: "Low" },
  medium: { icon: <ArrowRight className="h-4 w-4 text-yellow-500" />, label: "Medium" },
  high: { icon: <ArrowUp className="h-4 w-4 text-orange-500" />, label: "High" },
  critical: { icon: <AlertTriangle className="h-4 w-4 text-red-500" />, label: "Critical" },
};

export default function IssueDetailPage() {
  const { issueId } = useParams<{ issueId: string }>();
  const navigate = useNavigate();
  const { data: issue, isLoading } = useEOSIssue(issueId);
  const updateIssue = useUpdateIssue();
  const { data: comments } = useIssueComments(issueId);
  const addComment = useAddIssueComment();
  const [commentText, setCommentText] = useState("");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!issue) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p className="text-lg font-medium">Issue not found</p>
        <Button variant="link" onClick={() => navigate("/eos/issues")}>
          Back to issues
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/eos/issues")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-2xl font-bold">{issue.title}</h1>
            <Badge
              variant="secondary"
              className={statusConfig[issue.status]?.className || ""}
            >
              {statusConfig[issue.status]?.label || issue.status}
            </Badge>
          </div>
          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              {priorityConfig[issue.priority]?.icon}
              <span>{priorityConfig[issue.priority]?.label} priority</span>
            </div>
            <span>·</span>
            <span className="capitalize">{issue.category}</span>
            <span>·</span>
            <span className="capitalize">{issue.source}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Description</CardTitle>
            </CardHeader>
            <CardContent>
              {issue.description ? (
                <p className="text-sm whitespace-pre-wrap">{issue.description}</p>
              ) : (
                <p className="text-sm text-muted-foreground">No description provided.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Discussion</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(comments || []).map((c) => (
                <div key={c.id} className="rounded border p-3 text-sm">
                  <p className="font-medium text-xs text-muted-foreground mb-1">
                    {c.user?.full_name ?? "User"} · {new Date(c.created_at).toLocaleString()}
                  </p>
                  <p>{c.content}</p>
                </div>
              ))}
              <Textarea
                placeholder="Add a comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                rows={2}
              />
              <Button
                size="sm"
                disabled={!commentText.trim() || addComment.isPending}
                onClick={() => {
                  addComment.mutate(
                    { issueId: issueId!, content: commentText },
                    { onSuccess: () => setCommentText("") }
                  );
                }}
              >
                Add Comment
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-4 space-y-4">
              {/* Status */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                <Select
                  value={issue.status}
                  onValueChange={(v) =>
                    updateIssue.mutate({ id: issue.id, data: { status: v as IssueStatus } })
                  }
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">{ISSUE_STATUS_LABELS.open}</SelectItem>
                    <SelectItem value="in_progress">{ISSUE_STATUS_LABELS.in_progress}</SelectItem>
                    <SelectItem value="solved">{ISSUE_STATUS_LABELS.solved}</SelectItem>
                    <SelectItem value="archived">{ISSUE_STATUS_LABELS.archived}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Priority */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Priority</label>
                <Select
                  value={issue.priority}
                  onValueChange={(v) =>
                    updateIssue.mutate({ id: issue.id, data: { priority: v as IssuePriority } })
                  }
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Metadata */}
              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>Created {new Date(issue.created_at).toLocaleDateString()}</span>
                </div>
                {issue.solved_at && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>Solved {new Date(issue.solved_at).toLocaleDateString()}</span>
                  </div>
                )}
                {issue.is_anonymous && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span>Submitted anonymously</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
