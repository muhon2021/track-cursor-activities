import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, CheckSquare, Loader2 } from "lucide-react";

interface ActionItem {
  task: string;
  assignee?: string;
  due_date?: string;
}

interface MeetingSummaryProps {
  summary?: string;
  actionItems?: (string | ActionItem)[];
  onGenerateSummary?: () => void;
  onExtractActions?: () => void;
  isGenerating?: boolean;
  isExtracting?: boolean;
  className?: string;
}

export function MeetingSummary({
  summary,
  actionItems,
  onGenerateSummary,
  onExtractActions,
  isGenerating,
  isExtracting,
  className,
}: MeetingSummaryProps) {
  return (
    <div className={className}>
      {/* AI Summary */}
      {summary ? (
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI-Generated Summary
            </CardTitle>
            <CardDescription>Intelligent meeting summary powered by AI</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-primary/5 p-4">
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{summary}</p>
            </div>
          </CardContent>
        </Card>
      ) : onGenerateSummary ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              AI Summary
            </CardTitle>
            <CardDescription>Generate an intelligent summary of this meeting</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={onGenerateSummary} disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating Summary...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Summary
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* Action Items */}
      {actionItems && actionItems.length > 0 ? (
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-primary" />
              Action Items
            </CardTitle>
            <CardDescription>
              {actionItems.length} action {actionItems.length === 1 ? 'item' : 'items'} extracted from this meeting
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {actionItems.map((item, index) => (
                <div key={index} className="flex items-start gap-3 rounded-lg border p-3">
                  <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium">
                      {typeof item === 'string' ? item : item.task}
                    </p>
                    {typeof item === 'object' && item.assignee && (
                      <p className="text-xs text-muted-foreground">Assigned to: {item.assignee}</p>
                    )}
                    {typeof item === 'object' && item.due_date && (
                      <p className="text-xs text-muted-foreground">Due: {item.due_date}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : onExtractActions ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5" />
              Action Items
            </CardTitle>
            <CardDescription>Extract action items from this meeting</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={onExtractActions} disabled={isExtracting}>
              {isExtracting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Extracting Actions...
                </>
              ) : (
                <>
                  <CheckSquare className="mr-2 h-4 w-4" />
                  Extract Actions
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
