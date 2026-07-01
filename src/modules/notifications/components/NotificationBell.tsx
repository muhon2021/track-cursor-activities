import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bell, ExternalLink } from "lucide-react";
import {
  useNotificationCenter,
  useUnreadCount,
  useMarkAsRead,
} from "../hooks/useNotificationCenter";
import { useNotificationRealtime } from "../hooks/useNotificationRealtime";

interface NotificationBellProps {
  notificationsPath?: string;
}

export function NotificationBell({ notificationsPath = "/notifications" }: NotificationBellProps) {
  useNotificationRealtime(true);
  const { data: unreadCount } = useUnreadCount();
  const { data: recentData, isLoading } = useNotificationCenter({ pageSize: 5 });
  const markAsRead = useMarkAsRead();

  const recentNotifications = recentData?.items ?? [];

  const handleClick = (id: string, isRead: boolean) => {
    if (!isRead) {
      markAsRead.mutate(id);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 text-muted-foreground hover:text-foreground"
        >
          <Bell className="h-[18px] w-[18px]" />
          {(unreadCount || 0) > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full p-0 text-xs"
            >
              {(unreadCount || 0) > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          Notifications
          {(unreadCount || 0) > 0 && (
            <Badge variant="secondary" className="text-xs">
              {unreadCount} new
            </Badge>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
          ) : recentNotifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">No notifications</div>
          ) : (
            <>
              {recentNotifications.map((notification) => (
                <DropdownMenuItem key={notification.id} asChild>
                  <Link
                    to={notification.link || notificationsPath}
                    className="flex flex-col gap-1 p-3"
                    onClick={() => handleClick(notification.id, notification.is_read)}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-medium ${!notification.is_read ? "text-primary" : ""}`}
                      >
                        {notification.title}
                      </span>
                      {!notification.is_read && (
                        <span className="h-2 w-2 rounded-full bg-primary" />
                      )}
                    </div>
                    <span className="line-clamp-2 text-xs text-muted-foreground">
                      {notification.message}
                    </span>
                  </Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link
                  to={notificationsPath}
                  className="flex items-center justify-center gap-2 p-2 text-sm font-medium"
                >
                  View all notifications
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </DropdownMenuItem>
            </>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
