/**
 * Inline Takeaway Form
 *
 * Compact inline form for quickly adding takeaways within a card-based layout.
 * Supports Enter key submission and type selection.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { useAddTakeaway } from "../../hooks/useMeetingTakeaways";
import type { TakeawayType } from "../../types";

interface InlineTakeawayFormProps {
  meetingId: string;
  agendaItemId?: string;
  onAdded?: () => void;
}

export default function InlineTakeawayForm({
  meetingId,
  agendaItemId,
  onAdded,
}: InlineTakeawayFormProps) {
  const addTakeaway = useAddTakeaway();

  const [content, setContent] = useState("");
  const [takeawayType, setTakeawayType] = useState<TakeawayType>("note");

  const handleSubmit = () => {
    if (!content.trim()) return;

    addTakeaway.mutate(
      {
        meetingId,
        data: {
          content: content.trim(),
          takeaway_type: takeawayType,
          agenda_item_id: agendaItemId,
        },
      },
      {
        onSuccess: () => {
          setContent("");
          onAdded?.();
        },
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Select
        value={takeawayType}
        onValueChange={(v) => setTakeawayType(v as TakeawayType)}
      >
        <SelectTrigger className="w-[130px] shrink-0">
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
        placeholder="Add a takeaway..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <Button
        size="sm"
        onClick={handleSubmit}
        disabled={!content.trim() || addTakeaway.isPending}
      >
        <Plus className="h-4 w-4 mr-1" />
        Add
      </Button>
    </div>
  );
}
