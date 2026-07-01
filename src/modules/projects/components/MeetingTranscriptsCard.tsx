/**
 * Fellow recordings: list from proxy API and link to this project (optional transcript sync).
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, Link2, Mic2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFellowRecordings } from "@/hooks/useFellow";
import {
  getFellowRecordingId,
  getFellowRecordingTitle,
  useLinkFellowRecordingToProject,
} from "@/modules/projects/hooks/useProjectFellow";

interface MeetingTranscriptsCardProps {
  projectId: string;
}

export function MeetingTranscriptsCard({ projectId }: MeetingTranscriptsCardProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [syncTranscript, setSyncTranscript] = useState(true);
  const { data: recordings = [], isLoading, isError, error } = useFellowRecordings(40);
  const linkRecording = useLinkFellowRecordingToProject(projectId);

  const errMessage = error instanceof Error ? error.message : "Could not load Fellow recordings.";

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Mic2 className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base">Fellow recordings</CardTitle>
        </div>
        <CardDescription>
          Link a Fellow recording to this project. Transcript text is stored on the meeting when sync is enabled.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="fellow-sync-transcript"
            checked={syncTranscript}
            onCheckedChange={(c) => setSyncTranscript(c === true)}
          />
          <Label htmlFor="fellow-sync-transcript" className="text-sm font-normal cursor-pointer">
            Fetch transcript when linking (slower)
          </Label>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <p className="text-sm text-muted-foreground">{errMessage}</p>
        ) : recordings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recordings returned from Fellow.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {recordings.map((rec) => {
              const id = getFellowRecordingId(rec);
              if (!id) return null;
              const title = getFellowRecordingTitle(rec);
              return (
                <li key={id} className="flex items-center gap-2 p-3 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{title}</p>
                    <p className="text-xs text-muted-foreground truncate">ID: {id}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 gap-1"
                    disabled={linkRecording.isPending}
                    onClick={() => {
                      linkRecording.mutate(
                        { recording: rec, syncTranscript },
                        {
                          onSuccess: ({ meetingId }) => {
                            toast({
                              title: "Linked",
                              description: "Fellow recording linked to this project.",
                            });
                            navigate(`/meetings/${meetingId}`);
                          },
                          onError: (e) => {
                            toast({
                              title: "Could not link",
                              description: e instanceof Error ? e.message : "Unknown error",
                              variant: "destructive",
                            });
                          },
                        }
                      );
                    }}
                  >
                    {linkRecording.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Link2 className="h-3.5 w-3.5" />
                    )}
                    Link
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
