/**
 * Fellow AI-derived action items (flattened from recordings via fellow-api).
 */

import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, ListChecks } from "lucide-react";
import { useFellowActionItems } from "@/hooks/useFellow";

export default function FellowActionItemsPage() {
  const { data: items = [], isLoading, isError, error } = useFellowActionItems(100);
  const errMessage = error instanceof Error ? error.message : "Could not load Fellow action items.";

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/meetings/schedule" aria-label="Back to schedule">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ListChecks className="h-7 w-7" />
            Fellow action items
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Items extracted from Fellow AI notes on your recordings (read-only; not synced to tasks).
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">From Fellow API</CardTitle>
          <CardDescription>Requires Fellow configured in Admin → Integrations.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : isError ? (
            <p className="text-sm text-muted-foreground">{errMessage}</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No action items found.</p>
          ) : (
            <ul className="space-y-3">
              {items.map((row, idx) => {
                const text = typeof row.text === "string" ? row.text : JSON.stringify(row);
                const rid = typeof row.recording_id === "string" ? row.recording_id : "";
                return (
                  <li key={`${rid}-${idx}`} className="border-b border-border/60 pb-3 last:border-0">
                    <p className="text-sm">{text}</p>
                    {rid ? (
                      <p className="text-xs text-muted-foreground mt-1">Recording: {rid}</p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
