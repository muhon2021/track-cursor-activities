/**
 * KnowledgeContextSelector — choose knowledge context for AI (categories, clients, projects, personal).
 */
import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { BookOpen, BookMarked, Users, FolderKanban } from "lucide-react";
import { useKnowledgeCategories } from "@/modules/knowledge/hooks/useKnowledge";
import { useAuth } from "@/contexts/AuthContext";

export type KnowledgeContextScope = "personal" | "categories" | "clients" | "projects";

export interface KnowledgeContextSelection {
  includePersonal: boolean;
  categoryIds: string[];
  clientIds: string[];
  projectIds: string[];
}

interface KnowledgeContextSelectorProps {
  value: KnowledgeContextSelection;
  onChange: (value: KnowledgeContextSelection) => void;
  disabled?: boolean;
}

export function KnowledgeContextSelector({ value, onChange, disabled }: KnowledgeContextSelectorProps) {
  const { user } = useAuth();
  const { data: categories = [] } = useKnowledgeCategories();

  const togglePersonal = (checked: boolean) => {
    onChange({ ...value, includePersonal: checked });
  };

  const toggleCategory = (id: string, checked: boolean) => {
    const next = checked
      ? [...value.categoryIds, id]
      : value.categoryIds.filter((c) => c !== id);
    onChange({ ...value, categoryIds: next });
  };

  const selectionLabel = useMemo(() => {
    const parts: string[] = [];
    if (value.includePersonal) parts.push("Personal");
    if (value.categoryIds.length) parts.push(`${value.categoryIds.length} categories`);
    if (value.clientIds.length) parts.push(`${value.clientIds.length} clients`);
    if (value.projectIds.length) parts.push(`${value.projectIds.length} projects`);
    return parts.length ? parts.join(", ") : "None";
  }, [value]);

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Knowledge context</Label>
      <div className="flex flex-wrap gap-4 rounded-lg border p-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="ctx-personal"
            checked={value.includePersonal}
            onCheckedChange={(c) => togglePersonal(c === true)}
            disabled={disabled || !user}
          />
          <label htmlFor="ctx-personal" className="flex items-center gap-2 text-sm cursor-pointer">
            <BookMarked className="h-4 w-4" />
            Personal knowledge
          </label>
        </div>
        {categories.slice(0, 8).map((cat) => (
          <div key={cat.id} className="flex items-center space-x-2">
            <Checkbox
              id={`ctx-cat-${cat.id}`}
              checked={value.categoryIds.includes(cat.id)}
              onCheckedChange={(c) => toggleCategory(cat.id, c === true)}
              disabled={disabled}
            />
            <label htmlFor={`ctx-cat-${cat.id}`} className="flex items-center gap-2 text-sm cursor-pointer">
              <BookOpen className="h-4 w-4" />
              {cat.name}
            </label>
          </div>
        ))}
      </div>
      {selectionLabel && (
        <p className="text-xs text-muted-foreground">Included: {selectionLabel}</p>
      )}
    </div>
  );
}
