import { useState } from "react";
import { Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export interface MemoryCitation {
  id?: string;
  content: string;
  memory_category?: string;
  memory_type?: string;
  importance_score?: number;
}

interface MemoryCitationPillProps {
  citations: MemoryCitation[];
  className?: string;
}

export function MemoryCitationPill({ citations, className }: MemoryCitationPillProps) {
  const [open, setOpen] = useState(false);

  if (!citations.length) return null;

  const label =
    citations.length === 1
      ? "1 memory used"
      : `${citations.length} memories used`;

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            "h-7 gap-1.5 text-xs font-medium text-primary border-primary/30 hover:bg-primary/5",
            className
          )}
        >
          <Brain className="h-3.5 w-3.5" />
          {label}
        </Button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>Memory context</DrawerTitle>
          <DrawerDescription>
            The assistant referenced these stored memories when generating this response.
          </DrawerDescription>
        </DrawerHeader>
        <ScrollArea className="max-h-[50vh] px-4">
          <div className="space-y-3 pb-4">
            {citations.map((citation, index) => (
              <div
                key={citation.id ?? index}
                className="rounded-lg border bg-muted/40 p-3 space-y-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {citation.memory_category ? (
                    <Badge variant="secondary" className="text-[10px]">
                      {citation.memory_category}
                    </Badge>
                  ) : null}
                  {citation.memory_type ? (
                    <Badge variant="outline" className="text-[10px]">
                      {citation.memory_type}
                    </Badge>
                  ) : null}
                  {citation.importance_score != null ? (
                    <span className="text-[10px] text-muted-foreground">
                      Importance {Math.round(citation.importance_score * 100)}%
                    </span>
                  ) : null}
                </div>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {citation.content}
                </p>
              </div>
            ))}
          </div>
        </ScrollArea>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="outline">Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

export function parseMemoryCitations(
  metadata: Record<string, unknown> | null | undefined,
  citations: unknown[] | null | undefined
): MemoryCitation[] {
  const fromMeta = metadata?.memory_citations;
  if (Array.isArray(fromMeta) && fromMeta.length > 0) {
    return fromMeta
      .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
      .map((c) => ({
        id: typeof c.id === "string" ? c.id : undefined,
        content: typeof c.content === "string" ? c.content : JSON.stringify(c),
        memory_category:
          typeof c.memory_category === "string" ? c.memory_category : undefined,
        memory_type: typeof c.memory_type === "string" ? c.memory_type : undefined,
        importance_score:
          typeof c.importance_score === "number" ? c.importance_score : undefined,
      }));
  }

  if (Array.isArray(citations) && citations.length > 0) {
    return citations
      .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
      .map((c) => ({
        id: typeof c.id === "string" ? c.id : undefined,
        content:
          typeof c.content === "string"
            ? c.content
            : typeof c.text === "string"
              ? c.text
              : JSON.stringify(c),
        memory_category:
          typeof c.memory_category === "string" ? c.memory_category : undefined,
        memory_type: typeof c.memory_type === "string" ? c.memory_type : undefined,
      }));
  }

  return [];
}
