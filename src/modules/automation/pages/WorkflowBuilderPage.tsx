import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { WorkflowCanvas } from "../components/builder/WorkflowCanvas";
import {
  useAutomationWorkflow,
  useSaveWorkflowDraft,
} from "../hooks/useAutomationWorkflows";
import { validateWorkflow } from "../lib/workflowValidator";
import type { WorkflowDefinition } from "../types";
import { toast } from "sonner";

const emptyDefinition: WorkflowDefinition = {
  version: 1,
  trigger: { type: "manual" },
  nodes: [{ id: "trigger-1", type: "trigger", config: { event: "manual" } }],
  edges: [],
};

export default function WorkflowBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: existing, isLoading } = useAutomationWorkflow(id);
  const saveDraft = useSaveWorkflowDraft();

  const [name, setName] = useState("Untitled Workflow");
  const [description, setDescription] = useState("");
  const [triggerType, setTriggerType] = useState("manual");
  const [definition, setDefinition] = useState<WorkflowDefinition>(emptyDefinition);

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setDescription(existing.description ?? "");
      setTriggerType(existing.trigger_type);
      setDefinition(existing.definition ?? emptyDefinition);
    }
  }, [existing]);

  const handleSave = () => {
    const validation = validateWorkflow(definition, triggerType);
    if (!validation.valid) {
      toast.error("Validation failed", { description: validation.errors.join("; ") });
      return;
    }
    saveDraft.mutate(
      { id, name, description, trigger_type: triggerType, definition },
      {
        onSuccess: (res: unknown) => {
          const data = (res as { data?: { id: string } })?.data;
          if (!id && data?.id) navigate(`/automation/builder/${data.id}`, { replace: true });
        },
      }
    );
  };

  if (id && isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/automation/workflows"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold">Workflow Builder</h1>
            <p className="text-sm text-muted-foreground">Drag nodes, connect steps, save draft</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saveDraft.isPending}>
          {saveDraft.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Draft
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2 md:col-span-1">
          <Label>Description</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </div>
      </div>

      <WorkflowCanvas
        definition={definition}
        triggerType={triggerType}
        onDefinitionChange={(def, tt) => {
          setDefinition(def);
          setTriggerType(tt);
        }}
      />
    </div>
  );
}
