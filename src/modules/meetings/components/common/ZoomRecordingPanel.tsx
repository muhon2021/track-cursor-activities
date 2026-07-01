/**
 * Zoom Recording Panel
 *
 * Displays Zoom recording information linked to a meeting, including
 * file name, size, download link, and processing status.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Video, Download, Loader2 } from "lucide-react";
import { useMeetingZoomLink } from "../../hooks/useMeetingZoomLink";

interface ZoomRecordingPanelProps {
  meetingId: string;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

const statusColors: Record<string, string> = {
  completed: "bg-green-100 text-green-800",
  processing: "bg-amber-100 text-amber-800",
  pending: "bg-gray-100 text-gray-800",
  failed: "bg-red-100 text-red-800",
};

export default function ZoomRecordingPanel({
  meetingId,
}: ZoomRecordingPanelProps) {
  const { data: recordings = [], isLoading } = useMeetingZoomLink(meetingId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (recordings.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <Video className="h-10 w-10 mb-3" />
          <p className="text-base font-medium">No Zoom recordings</p>
          <p className="text-sm mt-1">
            No Zoom recordings are linked to this meeting.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Video className="h-4 w-4" />
          Zoom Recordings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {recordings.map((recording) => (
          <div
            key={recording.id}
            className="flex items-center gap-3 rounded-lg border p-3"
          >
            <Video className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {recording.file_name}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground">
                  {formatFileSize(recording.file_size)}
                </span>
                <Badge
                  className={`text-xs ${
                    statusColors[recording.processing_status] ||
                    "bg-gray-100 text-gray-800"
                  }`}
                >
                  {recording.processing_status}
                </Badge>
              </div>
            </div>
            {recording.download_url && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  window.open(recording.download_url!, "_blank")
                }
              >
                <Download className="h-4 w-4 mr-1" />
                Download
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
