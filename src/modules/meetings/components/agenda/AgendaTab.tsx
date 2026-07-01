/**
 * Agenda Tab Component
 *
 * Displays and manages meeting agenda items with add, edit, complete, and reorder.
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, GripVertical, Clock, Trash2, Loader2 } from "lucide-react";
import {
  useMeetingAgenda,
  useAddAgendaItem,
  useUpdateAgendaItem,
  useDeleteAgendaItem,
} from "../../hooks/useMeetingAgenda";
import type { MeetingAgendaItem } from "../../types";

interface AgendaTabProps {
  meetingId: string;
}

export function AgendaTab({ meetingId }: AgendaTabProps) {
  const { data: items = [], isLoading } = useMeetingAgenda(meetingId);
  const addItem = useAddAgendaItem();
  const updateItem = useUpdateAgendaItem();
  const deleteItem = useDeleteAgendaItem();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDuration, setNewDuration] = useState("");

  const totalDuration = items.reduce((sum, item) => sum + (item.duration_minutes || 0), 0);
  const completedCount = items.filter((item) => item.is_completed).length;

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    addItem.mutate(
      {
        meetingId,
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        duration_minutes: newDuration ? parseInt(newDuration) : undefined,
      },
      {
        onSuccess: () => {
          setNewTitle("");
          setNewDescription("");
          setNewDuration("");
          setIsAddOpen(false);
        },
      }
    );
  };

  const handleToggleComplete = (item: MeetingAgendaItem) => {
    updateItem.mutate({
      id: item.id,
      meetingId,
      updates: { is_completed: !item.is_completed },
    });
  };

  const handleDelete = (id: string) => {
    deleteItem.mutate({ id, meetingId });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold">Agenda</h3>
          <Badge variant="outline">
            {completedCount}/{items.length} completed
          </Badge>
          {totalDuration > 0 && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {totalDuration} min
            </Badge>
          )}
        </div>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1" />
              Add Item
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Agenda Item</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                placeholder="Agenda item title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
              <Textarea
                placeholder="Description (optional)"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={2}
              />
              <Input
                type="number"
                placeholder="Duration (minutes)"
                value={newDuration}
                onChange={(e) => setNewDuration(e.target.value)}
                min={1}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAdd} disabled={!newTitle.trim() || addItem.isPending}>
                {addItem.isPending ? "Adding..." : "Add"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Items List */}
      {items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <p>No agenda items yet.</p>
            <p className="text-sm">Add items to structure this meeting.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => (
            <Card key={item.id} className={item.is_completed ? "opacity-60" : ""}>
              <CardContent className="flex items-start gap-3 py-3 px-4">
                <div className="flex items-center gap-2 mt-0.5">
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                  <Checkbox
                    checked={item.is_completed}
                    onCheckedChange={() => handleToggleComplete(item)}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground">
                      {index + 1}.
                    </span>
                    <p
                      className={`font-medium text-sm ${
                        item.is_completed ? "line-through" : ""
                      }`}
                    >
                      {item.title}
                    </p>
                  </div>
                  {item.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.description}
                    </p>
                  )}
                  {item.presenter && (
                    <p className="text-xs text-primary mt-0.5">
                      Presenter: {item.presenter.full_name}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {item.duration_minutes && (
                    <Badge variant="outline" className="text-xs">
                      {item.duration_minutes}m
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleDelete(item.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
