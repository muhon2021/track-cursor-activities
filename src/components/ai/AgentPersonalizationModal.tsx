import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AgentPersonalization {
  is_enabled: boolean;
  additional_prompt: string;
  attached_knowledge_files: string[];
  use_all_knowledge: boolean;
  max_context_files: number;
  relevance_threshold: number;
}

interface AgentPersonalizationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  agentName: string;
  onSave: (personalization: AgentPersonalization) => Promise<void>;
  initialData?: AgentPersonalization;
}

export function AgentPersonalizationModal({
  open,
  onOpenChange,
  agentId,
  agentName,
  onSave,
  initialData,
}: AgentPersonalizationModalProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [personalization, setPersonalization] = useState<AgentPersonalization>({
    is_enabled: initialData?.is_enabled ?? true,
    additional_prompt: initialData?.additional_prompt ?? "",
    attached_knowledge_files: initialData?.attached_knowledge_files ?? [],
    use_all_knowledge: initialData?.use_all_knowledge ?? false,
    max_context_files: initialData?.max_context_files ?? 5,
    relevance_threshold: initialData?.relevance_threshold ?? 0.7,
  });

  useEffect(() => {
    if (initialData) {
      setPersonalization(initialData);
    }
  }, [initialData]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(personalization);
      toast({
        title: "Success",
        description: "Agent personalization saved successfully",
      });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save personalization",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Personalize {agentName}</DialogTitle>
          <DialogDescription>
            Customize how this AI agent behaves and what knowledge it can access
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Personalization</Label>
              <p className="text-sm text-muted-foreground">
                Use your custom settings instead of defaults
              </p>
            </div>
            <Switch
              checked={personalization.is_enabled}
              onCheckedChange={(checked) =>
                setPersonalization({ ...personalization, is_enabled: checked })
              }
            />
          </div>

          {/* Additional Prompt */}
          <div className="space-y-2">
            <Label htmlFor="additional-prompt">Additional Instructions</Label>
            <Textarea
              id="additional-prompt"
              placeholder="Add custom instructions for this agent..."
              value={personalization.additional_prompt}
              onChange={(e) =>
                setPersonalization({
                  ...personalization,
                  additional_prompt: e.target.value,
                })
              }
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              These instructions will be appended to the agent's system prompt
            </p>
          </div>

          {/* Use All Knowledge */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Use All Personal Knowledge</Label>
              <p className="text-sm text-muted-foreground">
                Include all your uploaded files in context
              </p>
            </div>
            <Switch
              checked={personalization.use_all_knowledge}
              onCheckedChange={(checked) =>
                setPersonalization({ ...personalization, use_all_knowledge: checked })
              }
            />
          </div>

          {/* Max Context Files */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Max Context Files</Label>
              <span className="text-sm text-muted-foreground">
                {personalization.max_context_files}
              </span>
            </div>
            <Slider
              value={[personalization.max_context_files]}
              onValueChange={([value]) =>
                setPersonalization({ ...personalization, max_context_files: value })
              }
              min={1}
              max={20}
              step={1}
              disabled={personalization.use_all_knowledge}
            />
            <p className="text-xs text-muted-foreground">
              Maximum number of knowledge files to include in each query
            </p>
          </div>

          {/* Relevance Threshold */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Relevance Threshold</Label>
              <span className="text-sm text-muted-foreground">
                {(personalization.relevance_threshold * 100).toFixed(0)}%
              </span>
            </div>
            <Slider
              value={[personalization.relevance_threshold * 100]}
              onValueChange={([value]) =>
                setPersonalization({
                  ...personalization,
                  relevance_threshold: value / 100,
                })
              }
              min={50}
              max={95}
              step={5}
            />
            <p className="text-xs text-muted-foreground">
              Minimum similarity score for knowledge files to be included
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
