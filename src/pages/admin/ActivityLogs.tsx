import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Activity,
  Search,
  Download,
  Loader2,
  FileText,
  Trash2,
  Edit,
  Plus,
  LogIn,
  LogOut,
  Shield,
} from "lucide-react";
import { toast } from "sonner";
import { getInitials, formatDate } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  details: unknown;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  user_email?: string;
}

const ACTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  create: Plus,
  update: Edit,
  delete: Trash2,
  view: FileText,
  login: LogIn,
  logout: LogOut,
  access: Shield,
  "user.suspended": Shield,
  "user.reactivated": Shield,
  "user.removed": Trash2,
  "user.role_changed": Edit,
  "invite.sent": Plus,
  "invite.resent": Plus,
  "invite.accepted": LogIn,
  "invite.cancelled": Trash2,
  "invitation.revoked": Trash2,
  "permission.changed": Shield,
  "role.created": Plus,
  "department.created": Plus,
  "department.updated": Edit,
  "department.deleted": Trash2,
};

const ACTION_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  create: "default",
  update: "secondary",
  delete: "destructive",
  view: "outline",
  login: "default",
  logout: "secondary",
  access: "outline",
  "user.suspended": "destructive",
  "user.reactivated": "default",
  "user.removed": "destructive",
  "user.role_changed": "secondary",
  "invite.sent": "default",
  "invite.resent": "secondary",
  "invite.accepted": "default",
  "invite.cancelled": "destructive",
  "invitation.revoked": "destructive",
  "permission.changed": "secondary",
  "role.created": "default",
  "department.created": "default",
  "department.updated": "secondary",
  "department.deleted": "destructive",
};

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export default function ActivityLogs() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    fetchActivityLogs();
  }, []);

  const fetchActivityLogs = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("activity_logs")
        .select("id, user_id, action, resource_type, resource_id, details, ip_address, user_agent, created_at")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        console.error("Error fetching activity logs:", error.message);
        setLogs([]);
        return;
      }

      if (!data || data.length === 0) {
        setLogs([]);
        return;
      }

      // Fetch user emails from profiles table
      const userIds = [...new Set(data.map((log) => log.user_id))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, email")
        .in("id", userIds);

      const userEmailMap = new Map(
        profilesData?.map((profile) => [profile.id, profile.email]) || []
      );

      const logsWithEmails = data.map((log) => ({
        ...log,
        user_email: userEmailMap.get(log.user_id) || "Unknown",
      }));

      setLogs(logsWithEmails);
    } catch (error) {
      console.error("Error fetching activity logs:", error);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const csv = [
      ["Timestamp", "User", "Action", "Resource", "IP Address", "Details"].join(","),
      ...filteredLogs.map((log) =>
        [
          new Date(log.created_at).toISOString(),
          log.user_email || log.user_id,
          log.action,
          log.resource_type || "N/A",
          log.ip_address || "N/A",
          JSON.stringify(log.details || {}),
        ].map(csvEscape).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `activity-logs-${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success("Activity logs exported successfully");
  };

  const actionOptions = [...new Set(logs.map((log) => log.action))].sort();

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.user_email?.toLowerCase().includes(search.toLowerCase()) ||
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.resource_type?.toLowerCase().includes(search.toLowerCase());

    const matchesAction = actionFilter === "all" || log.action === actionFilter;

    const logDate = log.created_at.slice(0, 10);
    const matchesFrom = !dateFrom || logDate >= dateFrom;
    const matchesTo = !dateTo || logDate <= dateTo;

    return matchesSearch && matchesAction && matchesFrom && matchesTo;
  });

  const getActionIcon = (action: string) => {
    const Icon = ACTION_ICONS[action] || Activity;
    return <Icon className="h-4 w-4" />;
  };

  const getActionBadgeVariant = (action: string) => {
    return ACTION_COLORS[action] || "outline";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Activity Logs</h1>
          <p className="text-muted-foreground">
            Monitor user activity and system events
          </p>
        </div>
        <Button onClick={handleExport} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export Logs
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{logs.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Unique Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(logs.map((log) => log.user_id)).size}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(logs.map((log) => log.action)).size}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Resources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(logs.map((log) => log.resource_type).filter(Boolean)).size}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filter Logs</CardTitle>
          <CardDescription>Search activity logs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by user, action, or resource..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {actionOptions.map((action) => (
                  <SelectItem key={action} value={action}>
                    {action}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full md:w-40"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full md:w-40"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            Showing {filteredLogs.length} of {logs.length} events
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No activity logs found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-xs">
                              {getInitials(log.user_email || "U")}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{log.user_email || "Unknown"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getActionBadgeVariant(log.action)} className="gap-1">
                          {getActionIcon(log.action)}
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {log.resource_type || "N/A"}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground line-clamp-1">
                          {log.details ? JSON.stringify(log.details) : "No details"}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {log.ip_address || "N/A"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(log.created_at)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
