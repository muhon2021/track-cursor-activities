/**
 * TranscriptSearchBar
 *
 * Searches across all meeting transcripts using Postgres full-text search.
 * Designed to be used on the Transcripts list page or as a standalone widget.
 */

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, FileText } from "lucide-react";
import { useSearchTranscripts } from "@/hooks/useSearchTranscripts";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

interface TranscriptSearchBarProps {
  placeholder?: string;
  className?: string;
}

export function TranscriptSearchBar({
  placeholder = "Search across all transcripts…",
  className,
}: TranscriptSearchBarProps) {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { results, isLoading } = useSearchTranscripts(query);

  const showResults = query.trim().length >= 2;

  return (
    <div className={`relative ${className ?? ""}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {showResults && (
        <Card className="absolute top-full left-0 right-0 z-50 mt-1 shadow-lg max-h-80 overflow-y-auto">
          <CardContent className="p-1">
            {results.length === 0 && !isLoading ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No transcripts match "{query}"
              </p>
            ) : (
              results.map((meeting) => (
                <button
                  key={meeting.id}
                  onClick={() =>
                    navigate(`/meetings/schedule/${meeting.slug ?? meeting.id}`)
                  }
                  className="w-full text-left flex items-start gap-3 p-3 rounded hover:bg-muted/50 transition-colors"
                >
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{meeting.title}</p>
                    {meeting.scheduled_at && (
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(meeting.scheduled_at), {
                          addSuffix: true,
                        })}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">
                    Transcript
                  </Badge>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
