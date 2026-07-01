/**
 * Zoom Meetings Page
 * Displays all Zoom-synced meetings
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ArrowLeft, Calendar, RefreshCw, Video, ExternalLink, Loader2, Eye, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useMeetings, useDeleteMeeting } from "@/hooks/useMeetings";
import { useSyncZoom } from "@/hooks/useSyncZoom";

export default function ZoomMeetings() {
  const { data: meetings, isLoading } = useMeetings({ meetingType: "zoom" });
  const syncZoom = useSyncZoom();
  const deleteMeeting = useDeleteMeeting();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [meetingToDelete, setMeetingToDelete] = useState<string | null>(null);

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "scheduled":
        return <Badge variant="outline" className="bg-info/10 text-info border-info/30">Scheduled</Badge>;
      case "completed":
        return <Badge variant="outline" className="bg-success/10 text-success border-success/30">Completed</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status || "Unknown"}</Badge>;
    }
  };

  const handleDeleteClick = (meetingId: string) => {
    setMeetingToDelete(meetingId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (meetingToDelete) {
      deleteMeeting.mutate(meetingToDelete, {
        onSuccess: () => {
          setDeleteDialogOpen(false);
          setMeetingToDelete(null);
        },
      });
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <Link 
          to="/admin/integrations/zoom" 
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Zoom Integration
        </Link>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-info/10 dark:bg-blue-900/30">
              <Video className="h-6 w-6 text-info dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Zoom Meetings</h1>
              <p className="text-muted-foreground">
                View and manage all your synced Zoom meetings
              </p>
            </div>
          </div>
          
          <Button
            onClick={() => syncZoom.mutate({ sync_recordings: true, sync_transcripts: true })}
            disabled={syncZoom.isPending}
            variant="secondary"
          >
            {syncZoom.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync Meetings
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Meetings Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            Synced Meetings
          </CardTitle>
          <CardDescription>
            {meetings?.length || 0} meeting{meetings?.length !== 1 ? 's' : ''} synced from Zoom
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : meetings && meetings.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {meetings.map((meeting) => (
                    <TableRow key={meeting.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Video className="h-4 w-4 text-info" />
                          <span>{meeting.title}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {meeting.scheduled_at
                          ? format(new Date(meeting.scheduled_at), "MMM d, yyyy 'at' h:mm a")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {meeting.duration_minutes
                          ? `${meeting.duration_minutes} min`
                          : "—"}
                      </TableCell>
                      <TableCell>{getStatusBadge(meeting.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {meeting.zoom_join_url && (
                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                            >
                              <a
                                href={meeting.zoom_join_url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="mr-2 h-3 w-3" />
                                Join
                              </a>
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                          >
                            <Link to={`/meetings/${meeting.id}`}>
                              <Eye className="mr-2 h-3 w-3" />
                              View
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(meeting.id)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="p-4 rounded-full bg-muted inline-block mb-4">
                <Video className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No Zoom meetings synced</h3>
              <p className="text-muted-foreground mb-4">
                Sync your Zoom meetings to see them here.
              </p>
              <Button
                onClick={() => syncZoom.mutate({ sync_recordings: true, sync_transcripts: true })}
                disabled={syncZoom.isPending}
              >
                {syncZoom.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Sync Meetings Now
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Meeting</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this meeting? This action cannot be undone and will permanently remove the meeting from your system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteMeeting.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMeeting.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

