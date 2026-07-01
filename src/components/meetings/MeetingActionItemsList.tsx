/**
 * MeetingActionItemsList
 *
 * Displays AI-extracted action items for a meeting with priority badges,
 * due-date display, confidence indicators, and a "Convert to Task" button.
 */

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, AlertCircle, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { useActionItems } from "@/hooks/useActionItems";
import { useCreateTask } from "@/hooks/useTasks";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/cache";

interface MeetingActionItemsListProps {
  meetingId: string;
}

const priorityVariant: Record<
  string,
  "destructive" | "default" | "secondary"
> = {
  high: "destructive",
  medium: "default",
  low: "secondary",
};

export function MeetingActionItemsList({ meetingId }: MeetingActionItemsListProps) {
  const { actionItems, isLoading } = useActionItems(meetingId);
  const createTask = useCreateTask();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const handleConvertToTask = async (item: {
    id: string;
    text: string;
    assignee_id: string | null;
    due_date: string | null;
    priority: string | null;
    task_id: string | null;
  }) => {
    if (!user) return;
    setConvertingId(item.id);

    try {
      const task = await createTask.mutateAsync({
        title: item.text,
        description: `Extracted from meeting action items`,
        status: "todo",
        priority: (item.priority as "high" | "medium" | "low") ?? "medium",
        due_date: item.due_date ?? undefined,
        assigned_to: item.assignee_id ?? undefined,
        meeting_id: meetingId,
      });

      // Link action item to the newly created task
      await supabase
        .from("meeting_action_items")
        .update({ task_id: task.id, status: "in_progress" })
        .eq("id", item.id);

      // Invalidate action items so the UI reflects task_id
      queryClient.invalidateQueries({
        queryKey: queryKeys.meetings.actionItems(meetingId),
      });

      toast.success("Task created from action item");
    } catch {
      toast.error("Failed to create task");
    } finally {
      setConvertingId(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5" />
            Action Items
          </CardTitle>
        </CardHeader>
        <CardContent className="py-6 text-center text-muted-foreground text-sm">
          Loading action items…
        </CardContent>
      </Card>
    );
  }

  if (!actionItems.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5" />
            Action Items
          </CardTitle>
          <CardDescription>
            No action items extracted from this meeting yet.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const pendingCount = actionItems.filter((i) => !i.task_id).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="h-5 w-5" />
              Action Items
            </CardTitle>
            <CardDescription>
              {actionItems.length} extracted by AI
              {pendingCount > 0 && ` · ${pendingCount} pending`}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {actionItems.map((item) => {
          const isConverted = !!item.task_id;
          const isConverting = convertingId === item.id;
          const confidence = item.extraction_confidence ?? 0.8;

          return (
            <div
              key={item.id}
              className="p-3 border rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="flex gap-3 items-start">
                {isConverted ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                )}

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-snug">{item.text}</p>

                  <div className="flex flex-wrap gap-1.5 mt-2 items-center">
                    {item.assignee_email && (
                      <Badge variant="outline" className="text-xs">
                        {item.assignee_email}
                      </Badge>
                    )}
                    {item.due_date && (
                      <Badge variant="outline" className="text-xs">
                        Due {new Date(item.due_date).toLocaleDateString()}
                      </Badge>
                    )}
                    {item.priority && (
                      <Badge
                        variant={priorityVariant[item.priority] ?? "secondary"}
                        className="text-xs capitalize"
                      >
                        {item.priority}
                      </Badge>
                    )}

                    <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
                      {Math.round(confidence * 100)}% confidence
                      {confidence < 0.7 && (
                        <AlertCircle className="h-3 w-3 text-yellow-500" />
                      )}
                    </span>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant={isConverted ? "ghost" : "outline"}
                  disabled={isConverted || isConverting}
                  onClick={() => handleConvertToTask(item)}
                  className="shrink-0 text-xs"
                >
                  {isConverted ? "✓ Task Created" : isConverting ? "Creating…" : "Create Task"}
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
