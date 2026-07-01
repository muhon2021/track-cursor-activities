/**
 * Takeaways Tab Component
 *
 * Displays and manages meeting takeaways: decisions, action items, notes, follow-ups.
 */

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  CheckCircle2,
  Lightbulb,
  StickyNote,
  ArrowRight,
  Trash2,
  Loader2,
} from "lucide-react";
import {
  useMeetingTakeaways,
  useAddTakeaway,
  useToggleTakeaway,
  useDeleteTakeaway,
} from "../../hooks/useMeetingTakeaways";
import type { TakeawayType, MeetingTakeaway } from "../../types";

interface TakeawaysTabProps {
  meetingId: string;
}

const typeConfig: Record<TakeawayType, { icon: React.ReactNode; label: string; className: string }> = {
  decision: {
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    label: "Decision",
    className: "bg-green-100 text-green-800",
  },
  action_item: {
    icon: <ArrowRight className="h-3.5 w-3.5" />,
    label: "Action Item",
    className: "bg-blue-100 text-blue-800",
  },
  note: {
    icon: <StickyNote className="h-3.5 w-3.5" />,
    label: "Note",
    className: "bg-gray-100 text-gray-800",
  },
  follow_up: {
    icon: <Lightbulb className="h-3.5 w-3.5" />,
    label: "Follow Up",
    className: "bg-yellow-100 text-yellow-800",
  },
};

export function TakeawaysTab({ meetingId }: TakeawaysTabProps) {
  const { data: takeaways = [], isLoading } = useMeetingTakeaways(meetingId);
  const addTakeaway = useAddTakeaway();
  const toggleTakeaway = useToggleTakeaway();
  const deleteTakeaway = useDeleteTakeaway();

  const [showInline, setShowInline] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newType, setNewType] = useState<TakeawayType>("note");

  const decisions = takeaways.filter((t) => t.takeaway_type === "decision");
  const actionItems = takeaways.filter((t) => t.takeaway_type === "action_item");
  const notes = takeaways.filter((t) => t.takeaway_type === "note");
  const followUps = takeaways.filter((t) => t.takeaway_type === "follow_up");

  const handleAdd = () => {
    if (!newContent.trim()) return;
    addTakeaway.mutate(
      {
        meetingId,
        data: { content: newContent.trim(), takeaway_type: newType },
      },
      {
        onSuccess: () => {
          setNewContent("");
          setShowInline(false);
        },
      }
    );
  };

  const handleToggle = (takeaway: MeetingTakeaway) => {
    toggleTakeaway.mutate({
      id: takeaway.id,
      meetingId,
      is_completed: !takeaway.is_completed,
    });
  };

  const handleDelete = (id: string) => {
    deleteTakeaway.mutate({ id, meetingId });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary badges */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{takeaways.length} total</Badge>
          {decisions.length > 0 && (
            <Badge className={typeConfig.decision.className}>{decisions.length} decisions</Badge>
          )}
          {actionItems.length > 0 && (
            <Badge className={typeConfig.action_item.className}>
              {actionItems.length} action items
            </Badge>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowInline(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add Takeaway
        </Button>
      </div>

      {/* Inline add form */}
      {showInline && (
        <Card>
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2">
              <Select value={newType} onValueChange={(v) => setNewType(v as TakeawayType)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="decision">Decision</SelectItem>
                  <SelectItem value="action_item">Action Item</SelectItem>
                  <SelectItem value="note">Note</SelectItem>
                  <SelectItem value="follow_up">Follow Up</SelectItem>
                </SelectContent>
              </Select>
              <Input
                className="flex-1"
                placeholder="Enter takeaway content..."
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                autoFocus
              />
              <Button size="sm" onClick={handleAdd} disabled={!newContent.trim() || addTakeaway.isPending}>
                Add
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowInline(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Takeaways grouped by type */}
      {takeaways.length === 0 && !showInline ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <p>No takeaways yet.</p>
            <p className="text-sm">Capture decisions, action items, and notes from this meeting.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {takeaways.map((takeaway) => {
            const config = typeConfig[takeaway.takeaway_type];
            return (
              <Card key={takeaway.id} className={takeaway.is_completed ? "opacity-60" : ""}>
                <CardContent className="flex items-start gap-3 py-3 px-4">
                  {(takeaway.takeaway_type === "action_item" ||
                    takeaway.takeaway_type === "follow_up") && (
                    <Checkbox
                      className="mt-0.5"
                      checked={takeaway.is_completed}
                      onCheckedChange={() => handleToggle(takeaway)}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Badge className={`${config.className} flex items-center gap-1`}>
                        {config.icon}
                        {config.label}
                      </Badge>
                      {takeaway.assignee && (
                        <span className="text-xs text-muted-foreground">
                          {takeaway.assignee.full_name}
                        </span>
                      )}
                      {takeaway.due_date && (
                        <span className="text-xs text-muted-foreground">
                          Due: {new Date(takeaway.due_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <p
                      className={`text-sm ${
                        takeaway.is_completed ? "line-through text-muted-foreground" : ""
                      }`}
                    >
                      {takeaway.content}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => handleDelete(takeaway.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
