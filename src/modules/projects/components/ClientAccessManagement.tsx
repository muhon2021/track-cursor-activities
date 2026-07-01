import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useProjectClientAccess,
  useCreateClientAccess,
  useResetClientPassword,
  useRevokeClientAccess,
  useRestoreClientAccess,
} from "@/hooks/useClientAccess";
import { Copy, UserPlus, Shield, ShieldOff, Loader2, ExternalLink, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface ClientAccessManagementProps {
  projectId: string;
  projectName: string;
  projectSlug?: string;
}

export function ClientAccessManagement({
  projectId,
  projectName,
  projectSlug,
}: ClientAccessManagementProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [generatedCredentials, setGeneratedCredentials] = useState<{
    accessToken: string;
    password: string;
  } | null>(null);
  const [recentlyResetPasswords, setRecentlyResetPasswords] = useState<Record<string, string>>({});

  const { data: clientAccess = [], isLoading } = useProjectClientAccess(projectId);
  const createAccessMutation = useCreateClientAccess();
  const resetPasswordMutation = useResetClientPassword();
  const revokeAccessMutation = useRevokeClientAccess();
  const restoreAccessMutation = useRestoreClientAccess();

  const handleCreateAccess = async () => {
    if (!newClientEmail) {
      toast.error("Please enter client email");
      return;
    }
    try {
      const result = await createAccessMutation.mutateAsync({
        projectId,
        clientEmail: newClientEmail,
        clientName: newClientName || undefined,
        projectSlug: projectSlug || undefined,
      });
      setGeneratedCredentials({
        accessToken: result.access_token,
        password: result.password,
      });
      if (result.id) {
        setRecentlyResetPasswords((prev) => ({
          ...prev,
          [result.id]: result.password,
        }));
      }
      setNewClientEmail("");
      setNewClientName("");
    } catch {
      // Error handled by mutation
    }
  };

  const handleResetPassword = async (accessId: string, clientEmail: string) => {
    try {
      const result = await resetPasswordMutation.mutateAsync({
        accessId,
        projectId,
        clientEmail,
      });
      setRecentlyResetPasswords((prev) => ({
        ...prev,
        [accessId]: result.newPassword,
      }));
      toast.success('Password reset. Use "Copy Password" to copy the new password.');
    } catch {
      // Error handled by mutation
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const getDashboardUrl = (token: string) => {
    if (projectSlug) {
      return `${window.location.origin}/projects/${projectSlug}/client-portal/${token}`;
    }
    return `${window.location.origin}/projects/${projectSlug ?? ""}/client-portal/${token}`;
  };

  const hasPassword = (accessId: string) => !!recentlyResetPasswords[accessId];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Client Access Management
        </CardTitle>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <UserPlus className="h-4 w-4" />
              Add Client Access
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Client Access</DialogTitle>
            </DialogHeader>
            {generatedCredentials ? (
              <div className="space-y-4">
                <div className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                  <p className="text-sm text-green-800 dark:text-green-200 font-medium mb-3">
                    Access created! Share these credentials with the client:
                  </p>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Dashboard URL</Label>
                      <div className="flex gap-2 mt-1">
                        <Input
                          readOnly
                          value={getDashboardUrl(generatedCredentials.accessToken)}
                          className="text-xs"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            copyToClipboard(
                              getDashboardUrl(generatedCredentials.accessToken),
                              "URL"
                            )
                          }
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Password</Label>
                      <div className="flex gap-2 mt-1">
                        <Input
                          readOnly
                          value={generatedCredentials.password}
                          className="font-mono"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            copyToClipboard(generatedCredentials.password, "Password")
                          }
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
                <Button
                  className="w-full"
                  onClick={() => {
                    setGeneratedCredentials(null);
                    setIsAddDialogOpen(false);
                  }}
                >
                  Done
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="clientEmail">Client Email *</Label>
                  <Input
                    id="clientEmail"
                    type="email"
                    value={newClientEmail}
                    onChange={(e) => setNewClientEmail(e.target.value)}
                    placeholder="client@company.com"
                  />
                </div>
                <div>
                  <Label htmlFor="clientName">Client Name</Label>
                  <Input
                    id="clientName"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    placeholder="John Doe"
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleCreateAccess}
                  disabled={createAccessMutation.isPending}
                >
                  {createAccessMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Generate Access
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : clientAccess.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No client access configured. Click &quot;Add Client Access&quot; to get started.
          </p>
        ) : (
          <TooltipProvider>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Logins</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientAccess.map((access) => (
                  <TableRow key={access.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{access.client_name || "Client"}</div>
                        <div className="text-sm text-muted-foreground">{access.client_email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={access.is_active ? "default" : "secondary"}>
                        {access.is_active ? "Active" : "Revoked"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {access.last_login_at
                        ? format(new Date(access.last_login_at), "MMM d, yyyy HH:mm")
                        : "Never"}
                    </TableCell>
                    <TableCell>{access.login_count}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                copyToClipboard(getDashboardUrl(access.access_token), "URL")
                              }
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Copy dashboard URL</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant={hasPassword(access.id) ? "outline" : "ghost"}
                              className={
                                hasPassword(access.id)
                                  ? "text-green-600 border-green-200 hover:bg-green-50"
                                  : ""
                              }
                              onClick={() => {
                                if (hasPassword(access.id)) {
                                  copyToClipboard(
                                    recentlyResetPasswords[access.id],
                                    "Password"
                                  );
                                } else {
                                  toast.info("Reset the password first to copy it");
                                }
                              }}
                              disabled={!hasPassword(access.id)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {hasPassword(access.id)
                              ? "Copy password"
                              : "Reset password first to copy"}
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                handleResetPassword(access.id, access.client_email)
                              }
                              disabled={resetPasswordMutation.isPending}
                            >
                              <KeyRound className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Reset password</TooltipContent>
                        </Tooltip>
                        {access.is_active ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                onClick={() =>
                                  revokeAccessMutation.mutate({
                                    accessId: access.id,
                                    projectId,
                                  })
                                }
                                disabled={revokeAccessMutation.isPending}
                              >
                                <ShieldOff className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Revoke access</TooltipContent>
                          </Tooltip>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-green-600 hover:text-green-600"
                                onClick={() =>
                                  restoreAccessMutation.mutate({
                                    accessId: access.id,
                                    projectId,
                                  })
                                }
                                disabled={restoreAccessMutation.isPending}
                              >
                                <Shield className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Restore access</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TooltipProvider>
        )}
      </CardContent>
    </Card>
  );
}
