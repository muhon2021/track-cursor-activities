import { useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const db = supabase as any;

export type FeedbackVote = "positive" | "negative";

interface MessageFeedbackRowProps {
  messageId: string;
  agentId: string;
  conversationId: string;
  className?: string;
}

export function MessageFeedbackRow({
  messageId,
  agentId,
  conversationId,
  className,
}: MessageFeedbackRowProps) {
  const [vote, setVote] = useState<FeedbackVote | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submitFeedback = async (feedback: FeedbackVote) => {
    if (vote || submitting) return;
    setSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Not authenticated");

      const { error } = await db.from("agent_learning_events").insert({
        agent_id: agentId,
        user_id: userId,
        event_type: "user_feedback",
        event_description:
          feedback === "positive"
            ? "User marked assistant response as helpful"
            : "User marked assistant response as not helpful",
        feedback_type: feedback,
        related_message_id: messageId,
        related_conversation_id: conversationId,
      });

      if (error) throw error;
      setVote(feedback);
      toast.success("Thanks for your feedback");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not save feedback";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          "h-7 w-7",
          vote === "positive" && "text-green-600 bg-green-500/10"
        )}
        disabled={!!vote || submitting}
        onClick={() => submitFeedback("positive")}
        aria-label="Helpful response"
      >
        <ThumbsUp className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          "h-7 w-7",
          vote === "negative" && "text-destructive bg-destructive/10"
        )}
        disabled={!!vote || submitting}
        onClick={() => submitFeedback("negative")}
        aria-label="Unhelpful response"
      >
        <ThumbsDown className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
