/**
 * Schedule page: quick access to Fellow recordings and action items (API proxy).
 */

import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Mic2, ListChecks } from "lucide-react";
import { useFellowRecordings } from "@/hooks/useFellow";
import { getFellowRecordingId, getFellowRecordingTitle } from "@/modules/projects/hooks/useProjectFellow";

export function FellowRecordingsStrip() {
  const { data: recordings = [], isLoading, isError, error } = useFellowRecordings(8);
  const errMessage = error instanceof Error ? error.message : "Fellow unavailable.";

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Mic2 className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Fellow</CardTitle>
          </div>
          <CardDescription>
            Recent recordings from your Fellow workspace (same API as Admin → Integrations → Fellow).
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" asChild className="shrink-0 gap-1">
          <Link to="/meetings/fellow-action-items">
            <ListChecks className="h-4 w-4" />
            Action items
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <p className="text-sm text-muted-foreground">{errMessage}</p>
        ) : recordings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recordings in this list.</p>
        ) : (
          <ul className="text-sm space-y-2">
            {recordings.map((rec) => {
              const id = getFellowRecordingId(rec);
              if (!id) return null;
              return (
                <li key={id} className="flex justify-between gap-2 border-b border-border/60 pb-2 last:border-0 last:pb-0">
                  <span className="truncate font-medium">{getFellowRecordingTitle(rec)}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{id}</span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
