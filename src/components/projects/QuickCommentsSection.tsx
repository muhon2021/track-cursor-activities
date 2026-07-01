import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ProjectComment } from "@/modules/projects/types";
import { format } from "date-fns";

interface QuickCommentsSectionProps {
  projectId: string;
  comments: ProjectComment[];
  onAddComment: (content: string) => void;
  isLoading?: boolean;
}

export function QuickCommentsSection({
  projectId,
  comments,
  onAddComment,
  isLoading,
}: QuickCommentsSectionProps) {
  const [newComment, setNewComment] = useState("");

  const handleSubmit = () => {
    if (!newComment.trim()) return;
    onAddComment(newComment.trim());
    setNewComment("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Quick comments</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2 max-h-[280px] overflow-y-auto">
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!isLoading && comments.length === 0 && (
            <p className="text-sm text-muted-foreground">No comments yet.</p>
          )}
          {!isLoading && comments.slice(-10).reverse().map((c) => (
            <div key={c.id} className="text-sm border-l-2 border-muted pl-3 py-1">
              <p className="font-medium text-xs text-muted-foreground">
                {c.user?.full_name ?? "Unknown"} · {format(new Date(c.created_at), "MMM d, HH:mm")}
              </p>
              <p className="text-foreground">{c.content}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 pt-2">
          <Input
            placeholder="Add a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />
          <Button size="sm" disabled={!newComment.trim()} onClick={handleSubmit}>
            Post
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
