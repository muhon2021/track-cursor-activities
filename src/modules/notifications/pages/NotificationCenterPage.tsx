import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, Check, Loader2, Settings } from "lucide-react";
import {
  useNotificationCenter,
  useUnreadCount,
  useMarkAsRead,
  useMarkAllAsRead,
  useArchiveNotification,
  useDeleteNotification,
} from "../hooks/useNotificationCenter";
import { useNotificationRealtime } from "../hooks/useNotificationRealtime";
import { NotificationFilters } from "../components/NotificationFilters";
import { NotificationList } from "../components/NotificationList";
import type { NotificationFilterType } from "../types";

interface NotificationCenterPageProps {
  settingsPath?: string;
}

export default function NotificationCenterPage({
  settingsPath = "/settings/notifications",
}: NotificationCenterPageProps) {
  const [filter, setFilter] = useState<NotificationFilterType>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  useNotificationRealtime(false);

  const { data, isLoading } = useNotificationCenter({ filter, search, page });
  const { data: unreadCount } = useUnreadCount();
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();
  const archiveNotification = useArchiveNotification();
  const deleteNotification = useDeleteNotification();

  const handleFilterChange = (f: NotificationFilterType) => {
    setFilter(f);
    setPage(0);
  };

  const handleSearchChange = (s: string) => {
    setSearch(s);
    setPage(0);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">Stay updated with your latest activities</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link to={settingsPath}>
              <Settings className="mr-2 h-4 w-4" />
              Preferences
            </Link>
          </Button>
          {(unreadCount || 0) > 0 && (
            <Button
              variant="outline"
              onClick={() => markAllAsRead.mutate()}
              disabled={markAllAsRead.isPending}
            >
              {markAllAsRead.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Mark all as read
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.total ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Unread</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{unreadCount ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Filter
            </CardTitle>
          </CardHeader>
          <CardContent>
            <NotificationFilters
              filter={filter}
              search={search}
              onFilterChange={handleFilterChange}
              onSearchChange={handleSearchChange}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>Your recent activity and updates</CardDescription>
        </CardHeader>
        <CardContent>
          <NotificationList
            notifications={data?.items ?? []}
            isLoading={isLoading}
            page={page}
            totalPages={data?.totalPages ?? 1}
            onPageChange={setPage}
            onMarkRead={(id) => markAsRead.mutate(id)}
            onArchive={(id) => archiveNotification.mutate(id)}
            onDelete={(id) => deleteNotification.mutate(id)}
            isMarkingRead={markAsRead.isPending}
            isDeleting={deleteNotification.isPending}
            emptyMessage={
              filter === "unread" ? "No unread notifications" : "No notifications found"
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
