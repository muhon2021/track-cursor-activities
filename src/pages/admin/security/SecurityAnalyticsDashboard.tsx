import { useState } from "react";
import type { ComponentType } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, ShieldAlert, Lock, MailX, KeyRound, AlertTriangle } from "lucide-react";
import { useSecurityAnalytics, useUnlockAccount } from "@/hooks/useSecurityHardening";

export default function SecurityAnalyticsDashboard() {
  const [days, setDays] = useState(30);
  const { data, isLoading, refetch, isFetching } = useSecurityAnalytics(days);
  const unlockAccount = useUnlockAccount();

  const metrics = data?.metrics;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Security Analytics</h1>
          <p className="text-muted-foreground">
            Lockouts, blocked sign-ups, password violations, and audit anomalies.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={days === 7 ? "default" : "outline"}
            size="sm"
            onClick={() => setDays(7)}
          >
            7d
          </Button>
          <Button
            variant={days === 30 ? "default" : "outline"}
            size="sm"
            onClick={() => setDays(30)}
          >
            30d
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Total Lockouts"
              value={metrics?.total_lockouts ?? 0}
              icon={Lock}
              description="Accounts currently locked"
            />
            <MetricCard
              title="Blocked Signups"
              value={metrics?.blocked_signups ?? 0}
              icon={MailX}
              description="Failed login attempts in period"
            />
            <MetricCard
              title="Password Violations"
              value={metrics?.password_violations ?? 0}
              icon={KeyRound}
              description="Policy rejections logged"
            />
            <MetricCard
              title="Audit Anomalies"
              value={metrics?.audit_anomalies ?? 0}
              icon={AlertTriangle}
              description="Tamper / integrity alerts"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5" />
                Security log anomalies
              </CardTitle>
              <CardDescription>
                Critical events from audit chain verification and security monitoring.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(data?.security_anomalies?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">No anomalies detected in this period.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Severity</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Detected</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.security_anomalies.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <Badge
                            variant={row.severity === "critical" ? "destructive" : "secondary"}
                          >
                            {row.severity}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{row.anomaly_type}</TableCell>
                        <TableCell className="max-w-md truncate">{row.message}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(row.detected_at).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Locked accounts</CardTitle>
              <CardDescription>Users blocked by failed login thresholds.</CardDescription>
            </CardHeader>
            <CardContent>
              {(data?.locked_accounts?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">No locked accounts.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Failed attempts</TableHead>
                      <TableHead>Locked until</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.locked_accounts.map((account) => (
                      <TableRow key={account.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{account.full_name || account.email}</p>
                            <p className="text-xs text-muted-foreground">{account.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>{account.failed_login_count}</TableCell>
                        <TableCell>
                          {account.locked_until
                            ? new Date(account.locked_until).toLocaleString()
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={unlockAccount.isPending}
                            onClick={() => unlockAccount.mutate({ user_id: account.id })}
                          >
                            Unlock
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon: Icon,
  description,
}: {
  title: string;
  value: number;
  icon: ComponentType<{ className?: string }>;
  description: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value.toLocaleString()}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
