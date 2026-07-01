/**
 * Transcript Summary Tab
 *
 * Displays the AI-generated transcript summary for a meeting.
 * Provides a button to generate the summary if none exists.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import {
  useMeetingTranscriptSummary,
  useGenerateTranscriptSummary,
} from "../../hooks/useMeetingTranscriptSummary";

interface TranscriptSummaryTabProps {
  meetingId: string;
}

export default function TranscriptSummaryTab({
  meetingId,
}: TranscriptSummaryTabProps) {
  const { data, isLoading } = useMeetingTranscriptSummary(meetingId);
  const generateSummary = useGenerateTranscriptSummary();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const summary = data?.ai_summary;

  if (!summary) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Sparkles className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          No AI summary available for this meeting.
        </p>
        <Button
          variant="outline"
          onClick={() => generateSummary.mutate({ meeting_id: meetingId })}
          disabled={generateSummary.isPending}
        >
          {generateSummary.isPending ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 mr-1.5" />
          )}
          {generateSummary.isPending ? "Generating..." : "Generate Summary"}
        </Button>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-yellow-500" />
          AI-Generated Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
          {summary}
        </p>
      </CardContent>
    </Card>
  );
}
