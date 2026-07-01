/**
 * TranscriptTab Component
 *
 * Tab panel for MeetingDetailV2Page that displays the full transcript for a meeting.
 * Fetches transcript data from the meeting_transcripts table and renders:
 *  - Source badge, word count, and duration metadata
 *  - AI-generated summary card (when available)
 *  - Speaker-segmented transcript with timestamps
 *  - Fallback raw content view for unsegmented transcripts
 *  - In-transcript search with match highlighting
 *
 * @module meetings/components/transcript
 */

import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Search, Sparkles, Clock, MessageSquare, Loader2 } from "lucide-react";
import { useGenerateMeetingSummary } from "../../hooks/useGenerateMeetingSummary";
import type { MeetingTranscript, TranscriptSpeaker } from "../../types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TranscriptTabProps {
  /** The meeting ID used to fetch the associated transcript record. */
  meetingId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Human-readable labels for transcript source values. */
const SOURCE_LABELS: Record<MeetingTranscript["source"], string> = {
  zoom: "Zoom",
  teams: "Teams",
  google_meet: "Google Meet",
  manual: "Manual",
  upload: "Upload",
};

/** Badge variant colours keyed by transcript source. */
const SOURCE_COLORS: Record<MeetingTranscript["source"], string> = {
  zoom: "bg-blue-100 text-blue-800",
  teams: "bg-purple-100 text-purple-800",
  google_meet: "bg-green-100 text-green-800",
  manual: "bg-gray-100 text-gray-800",
  upload: "bg-amber-100 text-amber-800",
};

/**
 * Format a duration in seconds to a mm:ss string.
 * Returns "00:00" when the value is null or zero.
 */
function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

/**
 * Highlight all occurrences of `term` inside `text` by wrapping matches in
 * a <mark> element. Returns an array of React nodes suitable for rendering.
 */
function highlightMatches(text: string, term: string): React.ReactNode[] {
  if (!term) return [text];

  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);

  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-yellow-200 rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TranscriptTab({ meetingId }: TranscriptTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [generatedSummary, setGeneratedSummary] = useState<{
    executive_summary: string;
    key_decisions: string[];
    action_items: string[];
    follow_up_topics: string[];
  } | null>(null);

  const generateSummary = useGenerateMeetingSummary();

  // ---- Data fetching ----

  const { data, isLoading } = useQuery({
    queryKey: ["meeting-transcript", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_transcripts")
        .select("*")
        .eq("meeting_id", meetingId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!meetingId,
  });

  const transcript = data as unknown as MeetingTranscript | null;

  // ---- Derived state ----

  const speakers: TranscriptSpeaker[] = useMemo(() => {
    if (!transcript?.speakers || !Array.isArray(transcript.speakers)) return [];
    return transcript.speakers;
  }, [transcript]);

  /**
   * Filter speaker segments (or raw content lines) that match the current
   * search term. When the search field is empty every segment is included.
   */
  const filteredSpeakers = useMemo(() => {
    if (!searchTerm) return speakers;
    const q = searchTerm.toLowerCase();
    return speakers
      .map((speaker) => ({
        ...speaker,
        segments: speaker.segments.filter((seg) =>
          seg.text.toLowerCase().includes(q)
        ),
      }))
      .filter((speaker) => speaker.segments.length > 0);
  }, [speakers, searchTerm]);

  const rawContentMatches = useMemo(() => {
    if (!transcript?.content) return false;
    if (!searchTerm) return true;
    return transcript.content.toLowerCase().includes(searchTerm.toLowerCase());
  }, [transcript, searchTerm]);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value),
    []
  );

  // ---- Loading state ----

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // ---- Empty state ----

  if (!transcript) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <FileText className="h-10 w-10 mb-3" />
          <p className="text-base font-medium">No transcript available</p>
          <p className="text-sm mt-1">
            Upload a transcript or connect Zoom to auto-import
          </p>
        </CardContent>
      </Card>
    );
  }

  // ---- Transcript view ----

  const hasSpeakers = filteredSpeakers.length > 0 || (speakers.length > 0 && !searchTerm);

  return (
    <div className="space-y-5">
      {/* Metadata header */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={`${SOURCE_COLORS[transcript.source]} text-xs`}>
          {SOURCE_LABELS[transcript.source]}
        </Badge>
        {transcript.word_count != null && (
          <Badge variant="outline" className="flex items-center gap-1 text-xs">
            <MessageSquare className="h-3 w-3" />
            {transcript.word_count.toLocaleString()} words
          </Badge>
        )}
        {transcript.duration_seconds != null && transcript.duration_seconds > 0 && (
          <Badge variant="outline" className="flex items-center gap-1 text-xs">
            <Clock className="h-3 w-3" />
            {formatDuration(transcript.duration_seconds)}
          </Badge>
        )}
      </div>

      {/* AI Summary */}
      {transcript.ai_summary ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-yellow-500" />
              AI Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {transcript.ai_summary}
            </p>
          </CardContent>
        </Card>
      ) : generatedSummary ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-yellow-500" />
              AI Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold mb-1">Executive Summary</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {generatedSummary.executive_summary}
              </p>
            </div>
            {generatedSummary.key_decisions.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-1">Key Decisions</h4>
                <ul className="list-disc list-inside space-y-1">
                  {generatedSummary.key_decisions.map((item, i) => (
                    <li key={i} className="text-sm text-muted-foreground">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {generatedSummary.action_items.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-1">Action Items</h4>
                <ul className="list-disc list-inside space-y-1">
                  {generatedSummary.action_items.map((item, i) => (
                    <li key={i} className="text-sm text-muted-foreground">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {generatedSummary.follow_up_topics.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-1">Follow-up Topics</h4>
                <ul className="list-disc list-inside space-y-1">
                  {generatedSummary.follow_up_topics.map((item, i) => (
                    <li key={i} className="text-sm text-muted-foreground">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Button
          variant="outline"
          disabled={generateSummary.isPending}
          onClick={() =>
            generateSummary.mutate(
              { meetingId, transcriptContent: transcript.content },
              { onSuccess: (data) => setGeneratedSummary(data) }
            )
          }
        >
          {generateSummary.isPending ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 mr-1.5" />
          )}
          {generateSummary.isPending ? "Generating..." : "Generate AI Summary"}
        </Button>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search within transcript..."
          className="pl-10"
          value={searchTerm}
          onChange={handleSearchChange}
        />
      </div>

      {/* Speaker segments */}
      {hasSpeakers ? (
        <div className="space-y-5">
          {(searchTerm ? filteredSpeakers : speakers).map((speaker, idx) => (
            <div key={`${speaker.name}-${idx}`}>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5 text-primary" />
                {speaker.name}
              </h4>
              <div className="space-y-1.5 pl-5">
                {speaker.segments.map((seg, sIdx) => (
                  <p
                    key={`${idx}-${sIdx}`}
                    className="text-sm text-muted-foreground leading-relaxed"
                  >
                    <span className="font-mono text-xs text-muted-foreground/70 mr-2">
                      [{formatDuration(seg.start)}]
                    </span>
                    {highlightMatches(seg.text, searchTerm)}
                  </p>
                ))}
              </div>
            </div>
          ))}

          {searchTerm && filteredSpeakers.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No matches found for &ldquo;{searchTerm}&rdquo;
            </p>
          )}
        </div>
      ) : (
        /* Raw content fallback */
        <div>
          {rawContentMatches ? (
            <div className="rounded-md border bg-muted/50 p-4 max-h-[600px] overflow-auto">
              <pre className="text-sm whitespace-pre-wrap leading-relaxed prose prose-sm max-w-none">
                {searchTerm
                  ? highlightMatches(transcript.content, searchTerm)
                  : transcript.content}
              </pre>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No matches found for &ldquo;{searchTerm}&rdquo;
            </p>
          )}
        </div>
      )}
    </div>
  );
}
