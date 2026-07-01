import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  Trash2,
  ExternalLink,
  Archive,
  CheckCircle,
  Info,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import type { Notification } from "../types";

interface NotificationItemProps {
  notification: Notification;
  onMarkRead: (id: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  isMarkingRead?: boolean;
  isDeleting?: boolean;
}

function getIcon(type: string) {
  switch (type) {
    case "success":
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case "warning":
      return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    case "error":
      return <XCircle className="h-5 w-5 text-red-500" />;
    default:
      return <Info className="h-5 w-5 text-blue-500" />;
  }
}

export function NotificationItem({
  notification,
  onMarkRead,
  onArchive,
  onDelete,
  isMarkingRead,
  isDeleting,
}: NotificationItemProps) {
  const severity = notification.severity || notification.type;

  return (
    <div
      className={`flex gap-4 rounded-lg p-4 transition-colors ${
        !notification.is_read ? "border border-accent bg-accent/50" : "hover:bg-accent/20"
      }`}
    >
      <div className="mt-0.5">{getIcon(severity)}</div>
      <div className="flex-1 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{notification.title}</p>
              {!notification.is_read && (
                <Badge variant="default" className="text-xs">
                  New
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                {severity}
              </Badge>
              {notification.category && (
                <Badge variant="secondary" className="text-xs">
                  {notification.category}
                </Badge>
              )}
              {notification.priority && notification.priority !== "medium" && (
                <Badge variant="destructive" className="text-xs">
                  {notification.priority}
                </Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{notification.message}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {new Date(notification.created_at).toLocaleString()}
            </p>
          </div>
          <div className="flex gap-1">
            {!notification.is_read && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onMarkRead(notification.id)}
                disabled={isMarkingRead}
              >
                <Check className="h-4 w-4" />
              </Button>
            )}
            {!notification.archived_at && (
              <Button size="sm" variant="ghost" onClick={() => onArchive(notification.id)}>
                <Archive className="h-4 w-4" />
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDelete(notification.id)}
              disabled={isDeleting}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {notification.link && (
          <Button size="sm" variant="outline" asChild className="mt-2">
            <Link to={notification.link} className="flex items-center gap-2">
              View Details
              <ExternalLink className="h-3 w-3" />
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
