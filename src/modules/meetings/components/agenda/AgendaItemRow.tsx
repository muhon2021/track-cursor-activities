/**
 * Agenda Item Row
 *
 * Single agenda item row with sort number, checkbox, title, presenter badge,
 * duration badge, and delete button. Used within AgendaColumn.
 */

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";
import type { MeetingAgendaItem } from "../../types";

interface AgendaItemRowProps {
  item: MeetingAgendaItem;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function AgendaItemRow({
  item,
  onToggle,
  onDelete,
}: AgendaItemRowProps) {
  return (
    <div
      className={`flex items-center gap-2 py-2 px-2 rounded-md hover:bg-muted/50 transition-colors ${
        item.is_completed ? "opacity-60" : ""
      }`}
    >
      <span className="text-xs font-mono text-muted-foreground w-5 shrink-0 text-right">
        {item.sort_order + 1}.
      </span>
      <Checkbox
        checked={item.is_completed}
        onCheckedChange={() => onToggle(item.id)}
        className="shrink-0"
      />
      <span
        className={`flex-1 text-sm truncate ${
          item.is_completed ? "line-through text-muted-foreground" : ""
        }`}
      >
        {item.title}
      </span>
      {item.presenter && (
        <Badge variant="secondary" className="text-xs shrink-0">
          {item.presenter.full_name}
        </Badge>
      )}
      {item.duration_minutes && (
        <Badge variant="outline" className="text-xs shrink-0">
          {item.duration_minutes}m
        </Badge>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={() => onDelete(item.id)}
      >
        <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
      </Button>
    </div>
  );
}
