/**
 * Rich text comment input with toolbar (Bold, Italic, lists, image, attachment).
 * Uses contentEditable; content is stored as sanitized HTML.
 */
import { useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Bold, Italic, List, ListOrdered, Image, Paperclip, Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { sanitizeRichText } from "@/lib/sanitize";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const PLACEHOLDER = "Type @ to mention • Drag & drop files";
const BUCKET = "user-knowledge";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function escapeHtmlForLi(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface RichCommentInputProps {
  taskId?: string;
  onSubmit: (content: string) => Promise<void>;
  isPending?: boolean;
  placeholder?: string;
  submitLabel?: string;
  className?: string;
}

export function RichCommentInput({
  taskId,
  onSubmit,
  isPending = false,
  placeholder = PLACEHOLDER,
  submitLabel = "Comment",
  className,
}: RichCommentInputProps) {
  const { user } = useAuth();
  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const savedSelectionRef = useRef<Range | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [uploadingFile, setUploadingFile] = useState(false);

  const getHtml = useCallback(() => {
    const el = editorRef.current;
    if (!el) return "";
    return el.innerHTML;
  }, []);

  const getText = useCallback(() => {
    const el = editorRef.current;
    if (!el) return "";
    return (el.textContent || "").trim();
  }, []);

  const updateEmpty = useCallback(() => {
    setIsEmpty(!getText());
  }, [getText]);

  const handleInput = useCallback(() => {
    updateEmpty();
  }, [updateEmpty]);

  const saveSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0).cloneRange();
    if (editorRef.current?.contains(range.commonAncestorContainer)) {
      savedSelectionRef.current = range;
    }
  }, []);

  const restoreSelection = useCallback(() => {
    const range = savedSelectionRef.current;
    if (!range || !editorRef.current) return;
    try {
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(range);
      }
    } catch {
      savedSelectionRef.current = null;
    }
  }, []);

  const insertImageFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      restoreSelection();
      document.execCommand("insertHTML", false, `<img src="${dataUrl}" alt="${file.name.replace(/"/g, "&quot;")}" style="max-width:100%;height:auto;" />`);
      updateEmpty();
    };
    reader.readAsDataURL(file);
  }, [restoreSelection, updateEmpty]);

  const insertFileAsText = useCallback((file: File) => {
    restoreSelection();
    document.execCommand("insertText", false, ` 📎 ${file.name}`);
    updateEmpty();
  }, [restoreSelection, updateEmpty]);

  const uploadAndInsertAttachment = useCallback(
    async (file: File) => {
      if (!taskId || !user?.id) {
        insertFileAsText(file);
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} exceeds 10MB`);
        return;
      }
      setUploadingFile(true);
      try {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const storagePath = `${user.id}/task-attachments/${taskId}/${crypto.randomUUID()}_${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(storagePath, file, { upsert: false });
        if (uploadError) throw uploadError;
        const { data: row, error: insertError } = await supabase
          .from("task_attachments")
          .insert({
            task_id: taskId,
            file_name: file.name,
            file_size: file.size,
            file_type: file.type || null,
            storage_path: storagePath,
            uploaded_by: user.id,
          })
          .select("id")
          .single();
        if (insertError) throw insertError;
        if (row?.id) {
          restoreSelection();
          const escaped = file.name.replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
          document.execCommand(
            "insertHTML",
            false,
            `<a href="#" data-task-attachment-id="${row.id}" class="comment-attachment-link" target="_blank" rel="noopener">📎 ${escaped}</a> `
          );
        } else {
          insertFileAsText(file);
        }
        updateEmpty();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed");
        insertFileAsText(file);
      } finally {
        setUploadingFile(false);
      }
    },
    [taskId, user?.id, restoreSelection, insertFileAsText, updateEmpty],
  );

  const handleImageClick = useCallback(() => {
    saveSelection();
    imageInputRef.current?.click();
  }, [saveSelection]);

  const handleFileClick = useCallback(() => {
    saveSelection();
    fileInputRef.current?.click();
  }, [saveSelection]);

  const handleImageChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && file.type.startsWith("image/")) insertImageFile(file);
      e.target.value = "";
    },
    [insertImageFile],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.type.startsWith("image/")) {
        insertImageFile(file);
      } else {
        uploadAndInsertAttachment(file);
      }
      e.target.value = "";
    },
    [insertImageFile, uploadAndInsertAttachment],
  );

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (const item of items) {
        if (item.type.indexOf("image") !== -1) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) insertImageFile(file);
          return;
        }
      }
    }
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  }, [insertImageFile]);

  const clear = useCallback(() => {
    const el = editorRef.current;
    if (el) {
      el.innerHTML = "";
      setIsEmpty(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = getText();
    if (!text || isPending) return;
    const html = getHtml();
    const sanitized = html ? sanitizeRichText(html) : text;
    await onSubmit(sanitized);
    clear();
  };

  const handleToolbarMouseDown = (e: React.MouseEvent, cmd: string) => {
    e.preventDefault();
    saveSelection();
    editorRef.current?.focus();
    requestAnimationFrame(() => {
      restoreSelection();
      const sel = window.getSelection();
      const range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
      let listHtml: string;
      if (cmd === "insertUnorderedList") {
        const content = range ? escapeHtmlForLi(range.toString().trim()) : "&nbsp;";
        listHtml = `<ul><li>${content || "&nbsp;"}</li></ul>`;
      } else if (cmd === "insertOrderedList") {
        const content = range ? escapeHtmlForLi(range.toString().trim()) : "&nbsp;";
        listHtml = `<ol><li>${content || "&nbsp;"}</li></ol>`;
      } else {
        listHtml = "";
      }
      if (listHtml) {
        document.execCommand("insertHTML", false, listHtml);
      } else {
        document.execCommand(cmd, false);
      }
      updateEmpty();
    });
  };

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-0", className)}>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-hidden
        onChange={handleImageChange}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="*/*"
        className="hidden"
        aria-hidden
        onChange={handleFileChange}
      />
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 border border-b-0 border-input rounded-t-md bg-muted/40 px-1 py-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onMouseDown={(e) => handleToolbarMouseDown(e, "bold")}
          aria-label="Bold"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onMouseDown={(e) => handleToolbarMouseDown(e, "italic")}
          aria-label="Italic"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onMouseDown={(e) => handleToolbarMouseDown(e, "insertUnorderedList")}
          aria-label="Bullet list"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onMouseDown={(e) => handleToolbarMouseDown(e, "insertOrderedList")}
          aria-label="Numbered list"
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onMouseDown={(e) => {
            e.preventDefault();
            handleImageClick();
          }}
          aria-label="Insert image"
          title="Insert image"
        >
          <Image className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onMouseDown={(e) => {
            e.preventDefault();
            handleFileClick();
          }}
          disabled={uploadingFile}
          aria-label="Attach file"
          title={taskId ? "Attach file (opens after comment is saved)" : "Attach file"}
        >
          <Paperclip className="h-4 w-4" />
        </Button>
      </div>

      {/* Editable area + submit */}
      <div className="relative flex gap-2 border border-input rounded-b-md bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
        <div className="flex-1 relative min-h-[80px] max-h-[200px]">
          {isEmpty && (
            <div
              className="absolute inset-0 px-3 py-2 text-sm text-muted-foreground pointer-events-none"
              aria-hidden
            >
              {placeholder}
            </div>
          )}
          <div
            ref={editorRef}
            contentEditable
            className="relative min-h-[80px] max-h-[200px] overflow-y-auto px-3 py-2 text-sm outline-none prose prose-sm max-w-none dark:prose-invert"
            onInput={handleInput}
            onPaste={handlePaste}
            onFocus={() => {}}
            onBlur={() => {}}
            suppressContentEditableWarning
          />
        </div>
        <Button
          type="submit"
          disabled={isEmpty || isPending}
          className="self-end m-2 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Send className="h-4 w-4 mr-1.5" />
              {submitLabel}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
