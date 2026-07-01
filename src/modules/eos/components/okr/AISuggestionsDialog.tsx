/**
 * AI Suggestions Dialog
 *
 * Calls suggest-okrs API with context and type; shows list of suggestions.
 * "Use this" creates the OKR and key results then closes.
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCreateOKR } from "../../hooks/useOKRs";
import { getCurrentQuarterString } from "@/utils/okrHelpers";
import { toast } from "sonner";

type SuggestionType = "company" | "team" | "personal";

interface KeyResultSuggestion {
  title: string;
  measurement_unit?: string;
  unit?: string;
  target_value?: number;
  start_value?: number;
  update_frequency?: string;
}

interface OKRSuggestion {
  title: string;
  description?: string;
  key_results?: KeyResultSuggestion[];
  reasoning?: string;
}

interface AISuggestionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUseSuggestion?: () => void;
}

export function AISuggestionsDialog({
  open,
  onOpenChange,
  onUseSuggestion,
}: AISuggestionsDialogProps) {
  const [context, setContext] = useState("");
  const [type, setType] = useState<SuggestionType>("team");
  const [count] = useState(3);
  const [suggestions, setSuggestions] = useState<OKRSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [usingIndex, setUsingIndex] = useState<number | null>(null);

  const createOKR = useCreateOKR();
  const quarter = getCurrentQuarterString();

  const fetchSuggestions = async () => {
    setLoading(true);
    setSuggestions([]);
    try {
      const { data, error } = await supabase.functions.invoke("suggest-okrs", {
        body: { context: context || undefined, type, count, quarter },
      });
      if (error) throw error;
      const list = (data?.okrs ?? data?.suggestions ?? []) as OKRSuggestion[];
      setSuggestions(Array.isArray(list) ? list : []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load suggestions");
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUseThis = async (idx: number) => {
    const s = suggestions[idx];
    if (!s?.title) return;
    setUsingIndex(idx);
    try {
      const key_results = (s.key_results || []).map((kr) => ({
        title: kr.title || "Key result",
        description: kr.measurement_unit || kr.unit,
        metric_type: "number" as const,
        start_value: kr.start_value ?? 0,
        target_value: kr.target_value ?? 100,
        unit: kr.measurement_unit || kr.unit || "",
        update_frequency: (kr.update_frequency || "weekly") as "weekly" | "daily" | "biweekly" | "monthly",
      }));
      await createOKR.mutateAsync({
        title: s.title,
        description: s.description,
        quarter,
        okr_type: type,
        key_results,
      });
      onOpenChange(false);
      onUseSuggestion?.();
      setSuggestions([]);
      setContext("");
    } catch {
      // toast already from mutation
    } finally {
      setUsingIndex(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI Suggestions
          </DialogTitle>
          <DialogDescription>
            Get OKR suggestions based on context and type. Use one to create an OKR with key results.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Context (optional)</Label>
            <Textarea
              placeholder="e.g. Focus on customer retention and product quality..."
              value={context}
              onChange={(e) => setContext(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as SuggestionType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="company">Company</SelectItem>
                <SelectItem value="team">Team</SelectItem>
                <SelectItem value="personal">Personal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={fetchSuggestions} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Get suggestions
              </>
            )}
          </Button>

          {suggestions.length > 0 && (
            <div className="space-y-2">
              <Label>Suggestions</Label>
              <ScrollArea className="h-[240px] rounded-md border p-3">
                <div className="space-y-3">
                  {suggestions.map((s, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg border p-3 space-y-2"
                    >
                      <p className="font-medium text-sm">{s.title}</p>
                      {s.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {s.description}
                        </p>
                      )}
                      {s.key_results && s.key_results.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {s.key_results.length} key results
                        </p>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleUseThis(idx)}
                        disabled={usingIndex !== null}
                      >
                        {usingIndex === idx ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          "Use this"
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
