/**
 * Responsibilities Editor Component
 *
 * Editable list of responsibility strings for a role. Supports adding,
 * removing, inline editing, and visual drag handles for reordering.
 */

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GripVertical, Plus, X } from "lucide-react";

interface ResponsibilitiesEditorProps {
  responsibilities: string[];
  onChange: (updated: string[]) => void;
  readonly?: boolean;
}

export function ResponsibilitiesEditor({
  responsibilities,
  onChange,
  readonly = false,
}: ResponsibilitiesEditorProps) {
  const [newItem, setNewItem] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAdd = () => {
    const trimmed = newItem.trim();
    if (!trimmed) return;
    onChange([...responsibilities, trimmed]);
    setNewItem("");
    inputRef.current?.focus();
  };

  const handleAddKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  const handleRemove = (index: number) => {
    onChange(responsibilities.filter((_, i) => i !== index));
  };

  const handleStartEdit = (index: number) => {
    if (readonly) return;
    setEditingIndex(index);
    setEditValue(responsibilities[index]);
  };

  const handleSaveEdit = () => {
    if (editingIndex === null) return;
    const trimmed = editValue.trim();
    if (!trimmed) {
      // Remove if edited to empty
      handleRemove(editingIndex);
    } else {
      const updated = [...responsibilities];
      updated[editingIndex] = trimmed;
      onChange(updated);
    }
    setEditingIndex(null);
    setEditValue("");
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === "Escape") {
      setEditingIndex(null);
      setEditValue("");
    }
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const updated = [...responsibilities];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    onChange(updated);
  };

  const handleMoveDown = (index: number) => {
    if (index >= responsibilities.length - 1) return;
    const updated = [...responsibilities];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    onChange(updated);
  };

  if (responsibilities.length === 0 && readonly) {
    return (
      <p className="text-sm text-muted-foreground italic py-2">
        No responsibilities defined.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {responsibilities.length === 0 && !readonly && (
        <p className="text-sm text-muted-foreground italic py-1">
          No responsibilities defined. Add one below.
        </p>
      )}

      <ul className="space-y-1">
        {responsibilities.map((item, index) => (
          <li
            key={index}
            className="flex items-center gap-2 group rounded-md border bg-background px-2 py-1.5"
          >
            {/* Drag handle (visual + click to reorder) */}
            {!readonly && (
              <button
                type="button"
                className="cursor-grab text-muted-foreground hover:text-foreground p-0.5 shrink-0"
                title="Drag to reorder"
                onDoubleClick={() => handleMoveUp(index)}
                onClick={() => handleMoveDown(index)}
              >
                <GripVertical className="h-4 w-4" />
              </button>
            )}

            {/* Inline edit or display */}
            {editingIndex === index ? (
              <Input
                className="h-7 text-sm flex-1"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleSaveEdit}
                onKeyDown={handleEditKeyDown}
                autoFocus
              />
            ) : (
              <span
                className={`flex-1 text-sm ${!readonly ? "cursor-pointer hover:text-primary" : ""}`}
                onClick={() => handleStartEdit(index)}
              >
                {item}
              </span>
            )}

            {/* Remove button */}
            {!readonly && editingIndex !== index && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                onClick={() => handleRemove(index)}
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            )}
          </li>
        ))}
      </ul>

      {/* Add new item */}
      {!readonly && (
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            className="h-8 text-sm"
            placeholder="Add a responsibility..."
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={handleAddKeyDown}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 shrink-0"
            onClick={handleAdd}
            disabled={!newItem.trim()}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add
          </Button>
        </div>
      )}
    </div>
  );
}
