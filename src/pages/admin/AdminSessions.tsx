import {
  useAdminSessions,
  useTerminateSession,
  useTerminateAllUserSessions,
} from "@/hooks/useAdminSessions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, MonitorX, Info } from "lucide-react";

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, { dateStyle: "short", timeStyle: "medium" });
}

function isExpired(notAfter: string | null): boolean {
  if (!notAfter) return false;
  return new Date(notAfter).getTime() < Date.now();
}

export default function AdminSessions() {
  const { data: sessions, isLoading } = useAdminSessions();
  const terminateSession = useTerminateSession();
  const terminateAll = useTerminateAllUserSessions();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Session Management</h1>
        <p className="text-muted-foreground">
          View and force-terminate active sessions for any user.
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/50">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-500" />
        <div className="text-sm text-amber-800 dark:text-amber-200">
          Terminating a session immediately revokes its refresh token, preventing the user from
          staying signed in past their current access token's expiry (typically up to an hour).
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active sessions</CardTitle>
          <CardDescription>{(sessions ?? []).length} active session(s) org-wide.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-24 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last active</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(sessions ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No active sessions.
                    </TableCell>
                  </TableRow>
                )}
                {(sessions ?? []).map((row) => (
                  <TableRow key={row.session_id}>
                    <TableCell>
                      <div className="font-medium">{row.full_name || row.email}</div>
                      <div className="text-xs text-muted-foreground">{row.email}</div>
                    </TableCell>
                    <TableCell>{formatDate(row.created_at)}</TableCell>
                    <TableCell>{formatDate(row.updated_at)}</TableCell>
                    <TableCell>
                      {isExpired(row.not_after) ? (
                        <Badge variant="secondary">Expired</Badge>
                      ) : (
                        formatDate(row.not_after)
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => terminateSession.mutate(row.session_id)}
                        disabled={terminateSession.isPending}
                      >
                        <MonitorX className="mr-1 h-3 w-3" />
                        Terminate
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => terminateAll.mutate(row.user_id)}
                        disabled={terminateAll.isPending}
                      >
                        Sign out user everywhere
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
