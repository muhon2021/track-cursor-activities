import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Copy, Check, Info } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import type { MCPServer } from "@/hooks/useMCPServers";
import { generateMcpClientConfigs } from "@/lib/mcp-client-config";

interface MCPServerConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  server: MCPServer | null;
  isNew?: boolean;
}

export function MCPServerConnectionDialog({
  open,
  onOpenChange,
  server,
  isNew = false,
}: MCPServerConnectionDialogProps) {
  const [copiedTarget, setCopiedTarget] = useState<string | null>(null);
  const { session } = useAuth();

  const configs = useMemo(
    () =>
      server
        ? generateMcpClientConfigs(server, { accessToken: session?.access_token })
        : [],
    [server, session?.access_token]
  );

  const defaultTab = configs[0]?.target ?? "cursor";

  const copyJson = async (target: string, json: string) => {
    try {
      await navigator.clipboard.writeText(json);
      setCopiedTarget(target);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopiedTarget(null), 2000);
    } catch {
      toast.error("Failed to copy — select the text and copy manually");
    }
  };

  if (!server) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-xl">{server.icon || "🔌"}</span>
            {isNew ? "MCP server created" : "Client connection config"}
          </DialogTitle>
          <DialogDescription>
            Copy the JSON below into Cursor, Claude Desktop, VS Code, or use the Control Tower API
            for REST tools.
          </DialogDescription>
        </DialogHeader>

        {isNew && (
          <Alert>
            <Check className="h-4 w-4" />
            <AlertTitle>{server.name} is ready</AlertTitle>
            <AlertDescription>
              {server.transport_type === "rest"
                ? "Use the Cursor tab to connect via the Control Tower MCP gateway. Deploy control-tower-mcp edge function first."
                : "Use the Cursor tab to connect this MCP server in your IDE."}
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="flex flex-wrap h-auto gap-1">
            {configs.map((config) => (
              <TabsTrigger key={config.target} value={config.target}>
                {config.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {configs.map((config) => (
            <TabsContent key={config.target} value={config.target} className="space-y-3 mt-4">
              {config.notice && (
                <Alert variant={config.compatible ? "default" : "destructive"}>
                  <Info className="h-4 w-4" />
                  <AlertDescription>{config.notice}</AlertDescription>
                </Alert>
              )}

              <div className="text-xs text-muted-foreground">
                <span className="font-medium">Config file:</span> {config.filePath}
              </div>

              <div className="relative">
                <pre className="rounded-lg border bg-muted/50 p-4 text-xs overflow-x-auto max-h-[360px] font-mono">
                  {config.json}
                </pre>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="absolute top-2 right-2"
                  onClick={() => copyJson(config.target, config.json)}
                >
                  {copiedTarget === config.target ? (
                    <>
                      <Check className="h-3.5 w-3.5 mr-1" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 mr-1" />
                      Copy JSON
                    </>
                  )}
                </Button>
              </div>

              {config.target === "cursor" && config.compatible && (
                <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
                  <li>Open Cursor → Settings → MCP</li>
                  <li>Click Add new MCP server or edit mcp.json</li>
                  <li>Paste the JSON (merge with existing mcpServers if needed)</li>
                  <li>Restart Cursor or toggle the server off and on</li>
                  <li>
                    If you see <span className="font-medium">Error — connect_failure</span> after a while:
                    log into Control Tower, reopen this dialog, copy fresh JSON, update mcp.json, then
                    redeploy <span className="font-mono text-xs">control-tower-mcp</span> if you have not
                    recently
                  </li>
                </ol>
              )}
            </TabsContent>
          ))}
        </Tabs>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
