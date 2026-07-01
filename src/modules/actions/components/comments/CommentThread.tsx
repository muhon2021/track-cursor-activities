import { useState, useCallback, useRef, useEffect } from "react";
import { format } from "date-fns";
import { MessageCircle } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Reply, Pencil, Trash2, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAddComment, useUpdateComment, useDeleteComment, useTaskComments } from "../../hooks/useTaskComments";
import { RichCommentInput } from "./RichCommentInput";
import { sanitizeRichText } from "@/lib/sanitize";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { TaskComment } from "../../types/tasks";
import { openJiraAttachment } from "../../lib/jiraAttachmentProxy";

interface CommentThreadProps {
  taskId: string;
  comments?: TaskComment[];
}

export function CommentThread({ taskId, comments: commentsProp }: CommentThreadProps) {
  const addComment = useAddComment();
  const { data: commentsFetched, isLoading: commentsLoading } = useTaskComments(taskId);

  const comments = commentsProp ?? commentsFetched ?? [];
  const totalCount = comments.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0);

  const handleSubmit = useCallback(
    async (content: string) => {
      await addComment.mutateAsync({ taskId, content });
    },
    [taskId, addComment],
  );

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-muted-foreground" />
        Comments {comments.length > 0 && `(${totalCount})`}
      </h4>

      {/* Add comment box first (above the list) */}
      <RichCommentInput
        taskId={taskId}
        onSubmit={handleSubmit}
        isPending={addComment.isPending}
        placeholder="Type @ to mention • Drag & drop files"
        submitLabel="Comment"
      />

      {/* Comment list below the box */}
      {commentsLoading ? (
        <p className="text-sm text-muted-foreground py-2">Loading comments...</p>
      ) : (
        <div className="space-y-4">
          {comments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No comments yet.</p>
          ) : (
            comments.map((comment) => (
              <CommentItem key={comment.id} comment={comment} taskId={taskId} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function CommentItem({ comment, taskId }: { comment: TaskComment; taskId: string }) {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.content);
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState("");

  const updateComment = useUpdateComment();
  const deleteComment = useDeleteComment();
  const addReply = useAddComment();

  const isOwner = comment.user_id != null && user?.id === comment.user_id;
  const displayName =
    comment.jira_comment_id && (comment.jira_author_name || comment.jira_author_email)
      ? comment.jira_author_name || comment.jira_author_email || "Jira user"
      : comment.user?.full_name || comment.user?.email || "Unknown";
  const initialsSource =
    comment.jira_comment_id != null
      ? comment.jira_author_name || comment.jira_author_email || "?"
      : comment.user?.full_name || comment.user?.email || "?";
  const initials =
    initialsSource === "?"
      ? "?"
      : initialsSource
          .split(/\s+/)
          .map((n) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 3);

  const handleSaveEdit = async () => {
    if (!editText.trim()) return;
    await updateComment.mutateAsync({ id: comment.id, taskId, content: editText.trim() });
    setIsEditing(false);
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    await addReply.mutateAsync({ taskId, content: replyText.trim(), parentCommentId: comment.id });
    setReplyText("");
    setShowReply(false);
  };

  const hasHtml = /<[a-z][\s\S]*>/i.test(comment.content);

  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const taskLinks = el.querySelectorAll<HTMLAnchorElement>("a[data-task-attachment-id]");
    const jiraLinks = el.querySelectorAll<HTMLAnchorElement>("a[data-jira-attachment-id]");

    const handleTaskAtt = async (e: Event) => {
      const a = e.currentTarget as HTMLAnchorElement;
      const id = a.getAttribute("data-task-attachment-id");
      if (!id || a.getAttribute("href") !== "#") return;
      e.preventDefault();
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          toast.error("Please sign in to open attachments.");
          return;
        }
        const { data, error } = await supabase.functions.invoke("task-attachment-url", {
          body: { attachment_id: id },
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (error) throw error;
        const url = data?.url;
        if (!url || typeof url !== "string") {
          toast.error("Could not open file");
          return;
        }
        window.open(url, "_blank");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to open file");
      }
    };

    const handleJiraAtt = async (e: Event) => {
      const a = e.currentTarget as HTMLAnchorElement;
      const id = a.getAttribute("data-jira-attachment-id");
      if (!id || a.getAttribute("href") !== "#") return;
      e.preventDefault();
      try {
        const name = a.getAttribute("data-jira-attachment-filename") || undefined;
        await openJiraAttachment(id, name);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to open Jira attachment");
      }
    };

    taskLinks.forEach((link) => link.addEventListener("click", handleTaskAtt));
    jiraLinks.forEach((link) => link.addEventListener("click", handleJiraAtt));
    return () => {
      taskLinks.forEach((link) => link.removeEventListener("click", handleTaskAtt));
      jiraLinks.forEach((link) => link.removeEventListener("click", handleJiraAtt));
    };
  }, [comment.content]);

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "group flex gap-3 rounded-lg border border-border/50 bg-card p-3 transition-colors",
          "hover:bg-muted/30 focus-within:bg-muted/30",
        )}
      >
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-sm font-medium">{displayName}</span>
              <span className="text-xs text-muted-foreground">
                {format(new Date(comment.created_at), "MMM d, yyyy h:mm a")}
              </span>
              {comment.is_edited && (
                <span className="text-xs text-muted-foreground">(edited)</span>
              )}
            </div>
            {/* Actions: visible on hover or when any child has focus */}
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={() => setShowReply(!showReply)}
                aria-label="Reply"
              >
                <Reply className="h-4 w-4" />
              </Button>
              {isOwner && (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => setIsEditing(true)}
                    aria-label="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteComment.mutate({ id: comment.id, taskId })}
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>

          {isEditing ? (
            <div className="space-y-2 mt-1">
              <Textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={2}
                className="text-sm"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveEdit} disabled={updateComment.isPending}>
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div
              ref={bodyRef}
              className={cn(
                "text-sm text-foreground mt-0.5 prose prose-sm max-w-none dark:prose-invert",
                "comment-body [&_a[data-task-attachment-id]]:cursor-pointer [&_a[data-task-attachment-id]]:text-primary [&_a[data-task-attachment-id]]:underline hover:[&_a[data-task-attachment-id]]:opacity-80",
                !hasHtml && "whitespace-pre-wrap",
              )}
            >
              {hasHtml ? (
                <span dangerouslySetInnerHTML={{ __html: sanitizeRichText(comment.content) }} />
              ) : (
                comment.content
              )}
            </div>
          )}

          {showReply && (
            <form onSubmit={handleReply} className="flex gap-2 mt-2">
              <Textarea
                placeholder="Write a reply..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={1}
                className="flex-1 text-sm"
                autoFocus
              />
              <Button type="submit" size="sm" disabled={!replyText.trim() || addReply.isPending}>
                Reply
              </Button>
            </form>
          )}
        </div>
      </div>

      {comment.replies && comment.replies.length > 0 && (
        <div className="ml-11 border-l-2 border-muted pl-4 space-y-3">
          {comment.replies.map((reply) => (
            <CommentItem key={reply.id} comment={reply} taskId={taskId} />
          ))}
        </div>
      )}
    </div>
  );
}
