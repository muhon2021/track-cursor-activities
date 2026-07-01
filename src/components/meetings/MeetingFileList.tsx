import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText, Download, Trash2, Loader2, Upload, RefreshCw } from "lucide-react";
import { formatBytes, formatDateTime } from "@/lib/utils";
import { useMeetingFiles } from "@/hooks/useMeetingFiles";
import { LoadingSpinner, EmptyState } from "@/components/common";
import { MeetingProvider } from "@/hooks/useSyncMeetingProvider";

interface MeetingFileListProps {
  meetingId: string;
  provider?: MeetingProvider;
  onUpload?: () => void;
  onDelete?: (fileId: string) => void;
  onSync?: () => void;
  isSyncing?: boolean;
  className?: string;
}

const providerLabels: Record<MeetingProvider, string> = {
  zoom: "Zoom",
  google_meet: "Google Meet",
  microsoft_teams: "Microsoft Teams",
  webex: "Webex",
  other: "Other",
};

const providerSyncLabels: Partial<Record<MeetingProvider, string>> = {
  zoom: "Sync from Zoom",
  google_meet: "Sync from Google Meet",
  microsoft_teams: "Sync from Teams",
  webex: "Sync from Webex",
};

export function MeetingFileList({
  meetingId,
  provider = "zoom",
  onUpload,
  onDelete,
  onSync,
  isSyncing,
  className,
}: MeetingFileListProps) {
  const { data: files, isLoading } = useMeetingFiles(meetingId);

  const getStatusBadge = (status: string | null) => {
    const config: Record<
      string,
      { variant: "default" | "secondary" | "destructive" | "outline"; label: string }
    > = {
      pending: { variant: "outline", label: "Pending" },
      processing: { variant: "default", label: "Processing" },
      completed: { variant: "secondary", label: "Completed" },
      failed: { variant: "destructive", label: "Failed" },
    };
    const { variant, label } = config[status || "pending"] || config.pending;
    return <Badge variant={variant}>{label}</Badge>;
  };

  const syncLabel = providerSyncLabels[provider] || "Sync files";

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Related Files</CardTitle>
            <CardDescription>Meeting recordings and documents</CardDescription>
          </div>
          <div className="flex gap-2">
            {onSync && (
              <Button
                variant="outline"
                size="sm"
                onClick={onSync}
                disabled={isSyncing}
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    {syncLabel}
                  </>
                )}
              </Button>
            )}
            {onUpload && (
              <Button variant="outline" size="sm" onClick={onUpload}>
                <Upload className="mr-2 h-4 w-4" />
                Upload File
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <LoadingSpinner className="py-8" text="Loading files..." />
        ) : !files || files.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No files uploaded yet"
            description="Upload files or sync from your meeting provider to get started"
            action={
              onUpload
                ? {
                    label: "Upload File",
                    onClick: onUpload,
                  }
                : undefined
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File Name</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map((file) => (
                <TableRow key={file.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="line-clamp-1">{file.file_name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {providerLabels[(file.provider as MeetingProvider) || provider] || "Other"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{file.file_type}</Badge>
                  </TableCell>
                  <TableCell>{file.file_size ? formatBytes(file.file_size) : "-"}</TableCell>
                  <TableCell>{getStatusBadge(file.processing_status)}</TableCell>
                  <TableCell>{formatDateTime(file.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {file.download_url && (
                        <Button variant="ghost" size="sm" asChild>
                          <a href={file.download_url} target="_blank" rel="noopener noreferrer">
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                      {onDelete && (
                        <Button variant="ghost" size="sm" onClick={() => onDelete(file.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
