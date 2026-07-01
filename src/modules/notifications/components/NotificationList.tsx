import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Loader2, Bell, ChevronLeft, ChevronRight } from "lucide-react";
import { NotificationItem } from "./NotificationItem";
import type { Notification } from "../types";

interface NotificationListProps {
  notifications: Notification[];
  isLoading: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onMarkRead: (id: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  isMarkingRead?: boolean;
  isDeleting?: boolean;
  emptyMessage?: string;
}

export function NotificationList({
  notifications,
  isLoading,
  page,
  totalPages,
  onPageChange,
  onMarkRead,
  onArchive,
  onDelete,
  isMarkingRead,
  isDeleting,
  emptyMessage = "No notifications yet",
}: NotificationListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!notifications.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
        <Bell className="h-12 w-12 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ScrollArea className="h-[600px] pr-4">
        <div className="space-y-3">
          {notifications.map((notification, index) => (
            <div key={notification.id}>
              <NotificationItem
                notification={notification}
                onMarkRead={onMarkRead}
                onArchive={onArchive}
                onDelete={onDelete}
                isMarkingRead={isMarkingRead}
                isDeleting={isDeleting}
              />
              {index < notifications.length - 1 && <Separator className="my-3" />}
            </div>
          ))}
        </div>
      </ScrollArea>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages - 1}
            onClick={() => onPageChange(page + 1)}
          >
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
