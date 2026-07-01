/**
 * Rich text editor for VTO sections (adapted from actions RichCommentInput).
 */

import { useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Bold, Italic, List, ListOrdered } from "lucide-react";
import { sanitizeRichText } from "@/lib/sanitize";
import { cn } from "@/lib/utils";

interface VTORichEditorProps {
  value: string;
  onChange: (html: string) => void;
  className?: string;
  placeholder?: string;
}

export function VTORichEditor({ value, onChange, className, placeholder }: VTORichEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  const exec = useCallback((command: string) => {
    document.execCommand(command, false);
    if (editorRef.current) {
      onChange(sanitizeRichText(editorRef.current.innerHTML));
    }
  }, [onChange]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(sanitizeRichText(editorRef.current.innerHTML));
    }
  };

  return (
    <div className={cn("border rounded-md", className)}>
      <div className="flex gap-1 border-b p-1 bg-muted/30">
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => exec("bold")}>
          <Bold className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => exec("italic")}>
          <Italic className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => exec("insertUnorderedList")}>
          <List className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => exec("insertOrderedList")}>
          <ListOrdered className="h-4 w-4" />
        </Button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        className="min-h-[120px] p-3 text-sm focus:outline-none prose prose-sm dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: value || "" }}
        onInput={handleInput}
        data-placeholder={placeholder}
        suppressContentEditableWarning
      />
    </div>
  );
}
