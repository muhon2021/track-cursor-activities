/**
 * VTO Section Component
 *
 * Displays a VTO section with inline editing capability.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Pencil, Check, X } from "lucide-react";
import type { VTOSection as VTOSectionType } from "../../types";

interface VTOSectionProps {
  section: VTOSectionType;
  onSave: (section: string, content: Record<string, unknown>) => void;
  isSaving?: boolean;
}

export function VTOSection({ section, onSave, isSaving }: VTOSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(section.content);

  const handleSave = () => {
    onSave(section.section, editContent);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditContent(section.content);
    setIsEditing(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg">{section.title}</CardTitle>
        {isEditing ? (
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" onClick={handleSave} disabled={isSaving}>
              <Check className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={handleCancel}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button size="icon" variant="ghost" onClick={() => setIsEditing(true)}>
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <VTOSectionEditor
            sectionKey={section.section}
            content={editContent}
            onChange={setEditContent}
          />
        ) : (
          <VTOSectionDisplay sectionKey={section.section} content={section.content} />
        )}
      </CardContent>
    </Card>
  );
}

function VTOSectionDisplay({
  sectionKey,
  content,
}: {
  sectionKey: string;
  content: Record<string, unknown>;
}) {
  switch (sectionKey) {
    case "core_values": {
      const values = (content.values as string[]) || [];
      return values.length > 0 ? (
        <ul className="list-disc list-inside space-y-1 text-sm">
          {values.map((v, i) => (
            <li key={i}>{v}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No core values defined yet.</p>
      );
    }
    case "core_focus":
      return (
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-medium">Purpose: </span>
            {(content.purpose as string) || <span className="text-muted-foreground">Not set</span>}
          </div>
          <div>
            <span className="font-medium">Niche: </span>
            {(content.niche as string) || <span className="text-muted-foreground">Not set</span>}
          </div>
        </div>
      );
    case "ten_year_target":
      return (
        <p className="text-sm">
          {(content.target as string) || (
            <span className="text-muted-foreground">No target set.</span>
          )}
        </p>
      );
    case "marketing_strategy":
      return (
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-medium">Target Market: </span>
            {(content.target_market as string) || <span className="text-muted-foreground">Not set</span>}
          </div>
          <div>
            <span className="font-medium">Proven Process: </span>
            {(content.proven_process as string) || <span className="text-muted-foreground">Not set</span>}
          </div>
          <div>
            <span className="font-medium">Guarantee: </span>
            {(content.guarantee as string) || <span className="text-muted-foreground">Not set</span>}
          </div>
          {((content.uniques as string[]) || []).length > 0 && (
            <div>
              <span className="font-medium">Uniques:</span>
              <ul className="list-disc list-inside ml-2">
                {((content.uniques as string[]) || []).map((u, i) => (
                  <li key={i}>{u}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    case "three_year_picture":
    case "one_year_plan":
      return (
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-medium">Revenue: </span>
            {(content.revenue as string) || <span className="text-muted-foreground">Not set</span>}
          </div>
          <div>
            <span className="font-medium">Profit: </span>
            {(content.profit as string) || <span className="text-muted-foreground">Not set</span>}
          </div>
          {((content.measurables as string[]) || (content.goals as string[]) || []).length > 0 && (
            <div>
              <span className="font-medium">{sectionKey === "three_year_picture" ? "Measurables" : "Goals"}:</span>
              <ul className="list-disc list-inside ml-2">
                {((content.measurables as string[]) || (content.goals as string[]) || []).map(
                  (item, i) => (
                    <li key={i}>{item}</li>
                  )
                )}
              </ul>
            </div>
          )}
        </div>
      );
    case "quarterly_rocks":
    case "issues_list": {
      const items =
        (content.rocks as string[]) || (content.issues as string[]) || [];
      return items.length > 0 ? (
        <ul className="list-disc list-inside space-y-1 text-sm">
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No items yet.</p>
      );
    }
    default:
      return (
        <pre className="text-xs bg-muted p-2 rounded overflow-auto">
          {JSON.stringify(content, null, 2)}
        </pre>
      );
  }
}

function VTOSectionEditor({
  sectionKey,
  content,
  onChange,
}: {
  sectionKey: string;
  content: Record<string, unknown>;
  onChange: (content: Record<string, unknown>) => void;
}) {
  const updateField = (field: string, value: unknown) => {
    onChange({ ...content, [field]: value });
  };

  const updateListField = (field: string, value: string) => {
    const items = value
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    onChange({ ...content, [field]: items });
  };

  switch (sectionKey) {
    case "core_values":
      return (
        <Textarea
          placeholder="One value per line"
          defaultValue={((content.values as string[]) || []).join("\n")}
          onChange={(e) => updateListField("values", e.target.value)}
          rows={5}
        />
      );
    case "core_focus":
      return (
        <div className="space-y-2">
          <Input
            placeholder="Purpose / Cause / Passion"
            defaultValue={(content.purpose as string) || ""}
            onChange={(e) => updateField("purpose", e.target.value)}
          />
          <Input
            placeholder="Niche"
            defaultValue={(content.niche as string) || ""}
            onChange={(e) => updateField("niche", e.target.value)}
          />
        </div>
      );
    case "ten_year_target":
      return (
        <Textarea
          placeholder="What does your company look like in 10 years?"
          defaultValue={(content.target as string) || ""}
          onChange={(e) => updateField("target", e.target.value)}
          rows={3}
        />
      );
    case "marketing_strategy":
      return (
        <div className="space-y-2">
          <Input
            placeholder="Target Market"
            defaultValue={(content.target_market as string) || ""}
            onChange={(e) => updateField("target_market", e.target.value)}
          />
          <Textarea
            placeholder="Uniques (one per line)"
            defaultValue={((content.uniques as string[]) || []).join("\n")}
            onChange={(e) => updateListField("uniques", e.target.value)}
            rows={3}
          />
          <Input
            placeholder="Proven Process"
            defaultValue={(content.proven_process as string) || ""}
            onChange={(e) => updateField("proven_process", e.target.value)}
          />
          <Input
            placeholder="Guarantee"
            defaultValue={(content.guarantee as string) || ""}
            onChange={(e) => updateField("guarantee", e.target.value)}
          />
        </div>
      );
    case "three_year_picture":
      return (
        <div className="space-y-2">
          <Input
            placeholder="Revenue target"
            defaultValue={(content.revenue as string) || ""}
            onChange={(e) => updateField("revenue", e.target.value)}
          />
          <Input
            placeholder="Profit target"
            defaultValue={(content.profit as string) || ""}
            onChange={(e) => updateField("profit", e.target.value)}
          />
          <Textarea
            placeholder="Measurables (one per line)"
            defaultValue={((content.measurables as string[]) || []).join("\n")}
            onChange={(e) => updateListField("measurables", e.target.value)}
            rows={4}
          />
        </div>
      );
    case "one_year_plan":
      return (
        <div className="space-y-2">
          <Input
            placeholder="Revenue target"
            defaultValue={(content.revenue as string) || ""}
            onChange={(e) => updateField("revenue", e.target.value)}
          />
          <Input
            placeholder="Profit target"
            defaultValue={(content.profit as string) || ""}
            onChange={(e) => updateField("profit", e.target.value)}
          />
          <Textarea
            placeholder="Goals (one per line)"
            defaultValue={((content.goals as string[]) || []).join("\n")}
            onChange={(e) => updateListField("goals", e.target.value)}
            rows={4}
          />
        </div>
      );
    case "quarterly_rocks":
      return (
        <div className="space-y-2">
          <Input
            placeholder="Quarter (e.g. Q1 2026)"
            defaultValue={(content.quarter as string) || ""}
            onChange={(e) => updateField("quarter", e.target.value)}
          />
          <Textarea
            placeholder="Rocks (one per line)"
            defaultValue={((content.rocks as string[]) || []).join("\n")}
            onChange={(e) => updateListField("rocks", e.target.value)}
            rows={5}
          />
        </div>
      );
    case "issues_list":
      return (
        <Textarea
          placeholder="Issues (one per line)"
          defaultValue={((content.issues as string[]) || []).join("\n")}
          onChange={(e) => updateListField("issues", e.target.value)}
          rows={5}
        />
      );
    default:
      return (
        <Textarea
          defaultValue={JSON.stringify(content, null, 2)}
          onChange={(e) => {
            try {
              onChange(JSON.parse(e.target.value));
            } catch {
              // Ignore invalid JSON while typing
            }
          }}
          rows={6}
        />
      );
  }
}
