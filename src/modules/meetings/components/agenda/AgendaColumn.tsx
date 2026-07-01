/**
 * Agenda Column
 *
 * Displays a list of agenda items within a card, with an add button
 * and empty state. Used as part of the AgendaTakeawaysPanel split view.
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import {
  useAddAgendaItem,
  useUpdateAgendaItem,
  useDeleteAgendaItem,
} from "../../hooks/useMeetingAgenda";
import AgendaItemRow from "./AgendaItemRow";
import type { MeetingAgendaItem } from "../../types";

interface AgendaColumnProps {
  meetingId: string;
  items: MeetingAgendaItem[];
  onItemClick?: (id: string) => void;
}

export default function AgendaColumn({
  meetingId,
  items,
  onItemClick,
}: AgendaColumnProps) {
  const addItem = useAddAgendaItem();
  const updateItem = useUpdateAgendaItem();
  const deleteItem = useDeleteAgendaItem();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    addItem.mutate(
      {
        meetingId,
        title: newTitle.trim(),
      },
      {
        onSuccess: () => {
          setNewTitle("");
          setIsAddOpen(false);
        },
      }
    );
  };

  const handleToggle = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    updateItem.mutate({
      id,
      meetingId,
      updates: { is_completed: !item.is_completed },
    });
  };

  const handleDelete = (id: string) => {
    deleteItem.mutate({ id, meetingId });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            Agenda
            <Badge variant="outline">{items.length}</Badge>
          </CardTitle>
          <Button size="sm" variant="ghost" onClick={() => setIsAddOpen(true)}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No agenda items yet
          </p>
        ) : (
          items.map((item) => (
            <AgendaItemRow
              key={item.id}
              item={item}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          ))
        )}
      </CardContent>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Agenda Item</DialogTitle>
          </DialogHeader>
          <div>
            <Input
              placeholder="Agenda item title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAdd}
              disabled={!newTitle.trim() || addItem.isPending}
            >
              {addItem.isPending ? "Adding..." : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
