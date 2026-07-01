/**
 * MeetingTranscriptViewer
 *
 * Displays a meeting transcript as speaker-turn cards with inline search
 * highlighting. Polls every 2 s while the transcript is being processed.
 */

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, FileText, Search } from "lucide-react";
import { useMeetingTranscript } from "@/hooks/useMeetingTranscript";

interface MeetingTranscriptViewerProps {
  meetingId: string;
}

export function MeetingTranscriptViewer({ meetingId }: MeetingTranscriptViewerProps) {
  const { transcript, status, error } = useMeetingTranscript(meetingId);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndexes, setHighlightedIndexes] = useState<Set<number>>(
    new Set()
  );

  useEffect(() => {
    if (!searchQuery.trim() || !transcript?.turns?.length) {
      setHighlightedIndexes(new Set());
      return;
    }
    const q = searchQuery.toLowerCase();
    const matches = new Set<number>();
    transcript.turns.forEach((turn, i) => {
      if (turn.text.toLowerCase().includes(q)) matches.add(i);
    });
    setHighlightedIndexes(matches);
  }, [searchQuery, transcript]);

  if (status === "pending") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Meeting Transcript
          </CardTitle>
          <CardDescription>
            Transcript will appear here once the meeting ends and is processed.
          </CardDescription>
        </CardHeader>
        <CardContent className="py-8 text-center text-muted-foreground">
          Waiting for transcript…
        </CardContent>
      </Card>
    );
  }

  if (status === "processing") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Meeting Transcript
          </CardTitle>
        </CardHeader>
        <CardContent className="py-8 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Processing transcript…
        </CardContent>
      </Card>
    );
  }

  if (status === "failed") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Meeting Transcript
          </CardTitle>
        </CardHeader>
        <CardContent className="py-6">
          <p className="text-sm text-destructive">
            Failed to fetch transcript{error ? `: ${error}` : "."}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!transcript?.turns?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Meeting Transcript
          </CardTitle>
        </CardHeader>
        <CardContent className="py-6 text-center text-muted-foreground">
          No transcript content available.
        </CardContent>
      </Card>
    );
  }

  const matchCount = highlightedIndexes.size;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Meeting Transcript
            </CardTitle>
            <CardDescription>
              {transcript.turns.length} segments
              {matchCount > 0 && ` · ${matchCount} match${matchCount !== 1 ? "es" : ""}`}
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50">
            Complete
          </Badge>
        </div>

        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search transcript…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </CardHeader>

      <CardContent className="max-h-96 overflow-y-auto space-y-2 pr-3">
        {transcript.turns.map((turn, i) => {
          const highlighted = highlightedIndexes.has(i);
          return (
            <div
              key={i}
              className={`p-3 rounded-lg border text-sm transition-colors ${
                highlighted
                  ? "bg-yellow-50 border-yellow-300 dark:bg-yellow-950/20 dark:border-yellow-700"
                  : "bg-muted/30 border-transparent"
              }`}
            >
              <div className="flex gap-3 items-start">
                <span className="text-xs text-muted-foreground font-mono min-w-[5rem] pt-0.5 shrink-0">
                  {turn.timestamp}
                </span>
                <div className="flex-1 min-w-0">
                  {turn.speaker && (
                    <p className="font-semibold text-xs text-primary mb-0.5">
                      {turn.speaker}
                    </p>
                  )}
                  <p className="text-muted-foreground leading-relaxed">{turn.text}</p>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
