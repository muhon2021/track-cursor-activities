import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AutomationStepType } from "../../types";

const PALETTE: { type: AutomationStepType; label: string }[] = [
  { type: "trigger", label: "Trigger" },
  { type: "condition", label: "Condition" },
  { type: "action", label: "Action" },
  { type: "delay", label: "Delay" },
  { type: "approval", label: "Approval" },
  { type: "loop", label: "Loop" },
  { type: "branch", label: "Branch" },
];

interface NodePaletteProps {
  onAdd: (type: AutomationStepType) => void;
}

export function NodePalette({ onAdd }: NodePaletteProps) {
  return (
    <Card className="w-48 shrink-0">
      <CardHeader className="py-3">
        <CardTitle className="text-sm">Nodes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pb-4">
        {PALETTE.map(({ type, label }) => (
          <Button
            key={type}
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={() => onAdd(type)}
            disabled={type === "trigger"}
            title={type === "trigger" ? "One trigger per workflow" : undefined}
          >
            {label}
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
