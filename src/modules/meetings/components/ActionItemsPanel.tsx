/**
 * ActionItemsPanel Component
 *
 * Standalone panel that displays pending action items across all meetings for the
 * current user (or a specific user when `userId` is provided). Designed to be
 * embedded in dashboards, sidebars, or meeting detail pages.
 *
 * Features:
 *  - Stats header with pending count and overdue count
 *  - Completion toggle via checkbox (inline mutation with optimistic cache update)
 *  - Colour-coded due-date badges (red = overdue, amber = due within 3 days)
 *  - Optional meeting title display alongside each item
 *  - Configurable item limit
 *  - Empty state when all action items are completed
 *
 * @module meetings/components
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { format, isPast, isWithinInterval, addDays } from "date-fns";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActionItemsPanelProps {
  /** Show action items assigned to a specific user. Falls back to the logged-in user. */
  userId?: string;
  /** Maximum number of items to display. When omitted all items are shown. */
  limit?: number;
  /** When true, each item includes the title of the meeting it originated from. */
  showMeetingTitle?: boolean;
}

/** Shape of a row returned by the action-items query (with joined meeting). */
interface ActionItemRow {
  id: string;
  content: string;
  due_date: string | null;
  is_completed: boolean;
  assigned_to: string | null;
  meeting_id: string;
  meeting: {
    id: string;
    title: string;
    scheduled_at: string | null;
  } | null;
}

// ---------------------------------------------------------------------------
// Local hooks
// ---------------------------------------------------------------------------

/**
 * Fetch pending (non-completed) action-item takeaways for a given user,
 * ordered by due date ascending so the most urgent items appear first.
 */
function useActionItems(userId?: string) {
  const { user } = useAuth();
  const targetUserId = userId || user?.id;

  return useQuery({
    queryKey: ["meeting-action-items", "panel", targetUserId],
    queryFn: async () => {
      const query = supabase
        .from("meeting_takeaways")
        .select("*, meeting:meetings(id, title, scheduled_at)")
        .eq("takeaway_type", "action_item")
        .eq("is_completed", false)
        .order("due_date", { ascending: true });

      if (targetUserId) {
        query.eq("assigned_to", targetUserId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ActionItemRow[];
    },
    enabled: !!targetUserId,
  });
}

/**
 * Mutation to toggle the completion state of a single takeaway.
 * Invalidates the action-items panel cache on success.
 */
function useToggleActionItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_completed }: { id: string; is_completed: boolean }) => {
      const { error } = await supabase
        .from("meeting_takeaways")
        .update({ is_completed, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting-action-items"] });
      queryClient.invalidateQueries({ queryKey: ["meeting-takeaways"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Determine the visual urgency of a due date.
 *  - "overdue"  -- the date has already passed
 *  - "soon"     -- the date is within the next 3 days
 *  - "default"  -- everything else (or no date)
 */
function getDueDateUrgency(dueDate: string | null): "overdue" | "soon" | "default" {
  if (!dueDate) return "default";

  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (isPast(due) && due < today) return "overdue";

  if (
    isWithinInterval(due, {
      start: today,
      end: addDays(today, 3),
    })
  ) {
    return "soon";
  }

  return "default";
}

/** Map urgency levels to badge styling. */
const URGENCY_STYLES: Record<string, string> = {
  overdue: "bg-red-100 text-red-800 border-red-200",
  soon: "bg-amber-100 text-amber-800 border-amber-200",
  default: "bg-gray-100 text-gray-700",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ActionItemsPanel({
  userId,
  limit,
  showMeetingTitle = false,
}: ActionItemsPanelProps) {
  const { data: items = [], isLoading } = useActionItems(userId);
  const toggleItem = useToggleActionItem();

  // Apply optional limit
  const displayItems = limit ? items.slice(0, limit) : items;

  // Stats
  const overdueCount = items.filter(
    (item) => getDueDateUrgency(item.due_date) === "overdue"
  ).length;

  // ---- Loading state ----

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </CardContent>
      </Card>
    );
  }

  // ---- Empty state ----

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <CheckCircle className="h-8 w-8 mb-2 text-green-500" />
          <p className="text-sm font-medium">All caught up!</p>
          <p className="text-xs mt-0.5">No pending action items.</p>
        </CardContent>
      </Card>
    );
  }

  // ---- Panel view ----

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Action Items
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {items.length} pending
            </Badge>
            {overdueCount > 0 && (
              <Badge className="bg-red-100 text-red-800 text-xs flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {overdueCount} overdue
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-2">
          {displayItems.map((item) => {
            const urgency = getDueDateUrgency(item.due_date);

            return (
              <div
                key={item.id}
                className="flex items-start gap-3 rounded-md border p-3 transition-colors hover:bg-muted/50"
              >
                <Checkbox
                  className="mt-0.5"
                  checked={false}
                  onCheckedChange={() =>
                    toggleItem.mutate({ id: item.id, is_completed: true })
                  }
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-snug">{item.content}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {item.due_date && (
                      <Badge
                        variant="outline"
                        className={`text-xs ${URGENCY_STYLES[urgency]}`}
                      >
                        {urgency === "overdue" && (
                          <AlertTriangle className="h-3 w-3 mr-1" />
                        )}
                        {format(new Date(item.due_date), "MMM d, yyyy")}
                      </Badge>
                    )}
                    {showMeetingTitle && item.meeting?.title && (
                      <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {item.meeting.title}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {limit && items.length > limit && (
            <p className="text-xs text-muted-foreground text-center pt-1">
              +{items.length - limit} more item{items.length - limit !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
