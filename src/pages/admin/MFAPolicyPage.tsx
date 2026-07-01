import { useEffect, useState } from "react";
import {
  useMfaPolicy,
  useUpdateMfaPolicy,
  useMfaEnrollment,
  useRemindMfaEnrollment,
  useResetMfaEnrollment,
} from "@/hooks/useMfa";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
import { Loader2, ShieldCheck, Bell, RotateCcw } from "lucide-react";

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

export default function MFAPolicyPage() {
  const { data: policy, isLoading: policyLoading } = useMfaPolicy();
  const updatePolicy = useUpdateMfaPolicy();
  const { data: enrollment, isLoading: enrollmentLoading } = useMfaEnrollment();
  const remind = useRemindMfaEnrollment();
  const reset = useResetMfaEnrollment();

  const [required, setRequired] = useState(false);
  const [graceDays, setGraceDays] = useState(7);

  useEffect(() => {
    if (policy) {
      setRequired(policy.required);
      setGraceDays(policy.grace_period_days);
    }
  }, [policy]);

  const isDirty = policy && (required !== policy.required || graceDays !== policy.grace_period_days);

  const handleSave = () => {
    updatePolicy.mutate({ required, grace_period_days: graceDays });
  };

  const unenrolledCount = (enrollment ?? []).filter((e) => !e.enrolled).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Multi-Factor Authentication</h1>
        <p className="text-muted-foreground">
          Enforce MFA enrollment for all users and track who still needs to set it up.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            <CardTitle>Enforcement policy</CardTitle>
          </div>
          <CardDescription>
            When enabled, users without MFA enrolled will be redirected to set it up once their
            grace period ends.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {policyLoading ? (
            <div className="flex h-24 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Require MFA for all users</Label>
                  <p className="text-sm text-muted-foreground">
                    Users will have {graceDays} day(s) to enroll before being locked out of
                    protected areas.
                  </p>
                </div>
                <Switch checked={required} onCheckedChange={setRequired} />
              </div>

              <Separator />

              <div className="space-y-2 max-w-xs">
                <Label htmlFor="grace-days">Grace period (days)</Label>
                <Input
                  id="grace-days"
                  type="number"
                  min={0}
                  max={90}
                  value={graceDays}
                  onChange={(e) => setGraceDays(Number(e.target.value))}
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={!isDirty || updatePolicy.isPending}>
                  {updatePolicy.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Save policy
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Enrollment status</CardTitle>
              <CardDescription>
                {unenrolledCount} user(s) have not enrolled in MFA yet.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => remind.mutate(undefined)}
              disabled={remind.isPending || unenrolledCount === 0}
            >
              <Bell className="mr-2 h-4 w-4" />
              Remind all unenrolled
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {enrollmentLoading ? (
            <div className="flex h-24 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Grace ends</TableHead>
                  <TableHead>Last reminded</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(enrollment ?? []).map((row) => (
                  <TableRow key={row.user_id}>
                    <TableCell>
                      <div className="font-medium">{row.full_name || row.email}</div>
                      <div className="text-xs text-muted-foreground">{row.email}</div>
                    </TableCell>
                    <TableCell>
                      {row.enrolled ? (
                        <Badge variant="default" className="bg-success">
                          Enrolled
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Not enrolled</Badge>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(row.grace_period_ends_at)}</TableCell>
                    <TableCell>{formatDate(row.last_reminded_at)}</TableCell>
                    <TableCell className="text-right space-x-2">
                      {!row.enrolled && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => remind.mutate(row.user_id)}
                          disabled={remind.isPending}
                        >
                          <Bell className="mr-1 h-3 w-3" />
                          Remind
                        </Button>
                      )}
                      {row.enrolled && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => reset.mutate(row.user_id)}
                          disabled={reset.isPending}
                        >
                          <RotateCcw className="mr-1 h-3 w-3" />
                          Reset
                        </Button>
                      )}
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
