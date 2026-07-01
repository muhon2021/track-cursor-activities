import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  MoreHorizontal,
  Plug,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Pencil,
  Trash2,
  ExternalLink,
  Globe,
  Loader2,
  Wrench,
  Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import {
  MCPServer,
  useUpdateMCPServer,
  useDeleteMCPServer,
  useVerifyMCPServer,
} from "@/hooks/useMCPServers";

interface MCPServerCardProps {
  server: MCPServer;
  onEdit?: (server: MCPServer) => void;
  onViewTools?: (server: MCPServer) => void;
  onViewConnection?: (server: MCPServer) => void;
  showActions?: boolean;
}

export function MCPServerCard({
  server,
  onEdit,
  onViewTools,
  onViewConnection,
  showActions = true,
}: MCPServerCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const updateServer = useUpdateMCPServer();
  const deleteServer = useDeleteMCPServer();
  const verifyServer = useVerifyMCPServer();

  const handleToggleActive = async () => {
    await updateServer.mutateAsync({
      id: server.id,
      data: { is_active: !server.is_active },
    });
  };

  const handleVerify = async () => {
    await verifyServer.mutateAsync(server.id);
  };

  const handleDelete = async () => {
    await deleteServer.mutateAsync(server.id);
    setShowDeleteDialog(false);
  };

  const getStatusIcon = () => {
    if (!server.is_active) {
      return <XCircle className="h-4 w-4 text-muted-foreground" />;
    }
    if (server.is_verified) {
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    }
    if (server.error_message) {
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
    return <AlertCircle className="h-4 w-4 text-yellow-500" />;
  };

  const getStatusText = () => {
    if (!server.is_active) return "Inactive";
    if (server.is_verified) return "Connected";
    if (server.error_message) return "Error";
    return "Not verified";
  };

  const getTransportBadge = () => {
    const colors: Record<string, string> = {
      stdio: "bg-purple-500/10 text-purple-700 border-purple-500/30",
      http: "bg-blue-500/10 text-blue-700 border-blue-500/30",
      rest: "bg-amber-500/10 text-amber-700 border-amber-500/30",
      websocket: "bg-green-500/10 text-green-700 border-green-500/30",
      sse: "bg-orange-500/10 text-orange-700 border-orange-500/30",
    };
    return colors[server.transport_type] || "bg-muted";
  };

  const toolCount = server.available_tools?.length || 0;

  return (
    <>
      <Card className={cn(!server.is_active && "opacity-60")}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="text-2xl">{server.icon || "🔌"}</div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">{server.name}</CardTitle>
                  {server.is_global && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>Global server (available to all users)</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
                {server.description && (
                  <CardDescription className="text-xs mt-0.5">
                    {server.description}
                  </CardDescription>
                )}
              </div>
            </div>

            {showActions && !server.is_global && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit?.(server)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleVerify}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Test Connection
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onViewConnection?.(server)}>
                    <Copy className="h-4 w-4 mr-2" />
                    Client connection JSON
                  </DropdownMenuItem>
                  {onViewTools && (
                    <DropdownMenuItem onClick={() => onViewTools(server)}>
                      <Wrench className="h-4 w-4 mr-2" />
                      View Tools
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => setShowDeleteDialog(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Status and Transport */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="outline"
              className={cn(
                "gap-1",
                server.is_verified && server.is_active
                  ? "border-green-500/50 text-green-700"
                  : server.error_message
                  ? "border-red-500/50 text-red-700"
                  : ""
              )}
            >
              {getStatusIcon()}
              {getStatusText()}
            </Badge>
            <Badge variant="outline" className={getTransportBadge()}>
              {server.transport_type.toUpperCase()}
            </Badge>
            {server.auth_type !== "none" && (
              <Badge variant="secondary" className="text-xs">
                {server.auth_type}
              </Badge>
            )}
          </div>

          {/* URL */}
          <div className="text-xs text-muted-foreground font-mono truncate">
            {server.server_url}
          </div>

          {/* Tools count */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Wrench className="h-4 w-4 text-muted-foreground" />
              <span>{toolCount} tool{toolCount !== 1 ? "s" : ""} available</span>
            </div>

            {!server.is_global && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Active</span>
                <Switch
                  checked={server.is_active}
                  onCheckedChange={handleToggleActive}
                  disabled={updateServer.isPending}
                />
              </div>
            )}
          </div>

          {/* Error message */}
          {server.error_message && (
            <div className="text-xs text-red-600 bg-red-50 dark:bg-red-950/20 p-2 rounded">
              {server.error_message}
            </div>
          )}

          {/* Usage stats */}
          {server.usage_count > 0 && (
            <div className="text-xs text-muted-foreground">
              Used {server.usage_count} time{server.usage_count !== 1 ? "s" : ""}
              {server.last_used_at && (
                <> · Last used {formatDistanceToNow(new Date(server.last_used_at), { addSuffix: true })}</>
              )}
            </div>
          )}

          {/* Verify button for unverified servers */}
          {server.is_active && !server.is_verified && !server.is_global && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleVerify}
              disabled={verifyServer.isPending}
            >
              {verifyServer.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Test Connection
            </Button>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete MCP Server?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{server.name}" and disconnect it from all agents.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
