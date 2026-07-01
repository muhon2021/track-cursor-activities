import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Plug,
  Plus,
  Search,
  Loader2,
  Globe,
  User,
  Wrench,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import {
  useMCPServers,
  useUserMCPServers,
  useGlobalMCPServers,
  MCPServer,
  MCPTool,
} from "@/hooks/useMCPServers";
import { getHttpConfigFromSchema } from "@/lib/mcp-rest-tools";
import { MCPServerCard } from "@/components/mcp/MCPServerCard";
import { MCPServerForm } from "@/components/mcp/MCPServerForm";
import { MCPServerConnectionDialog } from "@/components/mcp/MCPServerConnectionDialog";

export default function MCPServers() {
  const { data: allServers, isPending: isPendingAll } = useMCPServers();
  const { data: userServers, isPending: isPendingUser } = useUserMCPServers();
  const { data: globalServers, isPending: isPendingGlobal } = useGlobalMCPServers();

  const [searchQuery, setSearchQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<MCPServer | null>(null);
  const [toolsDialogOpen, setToolsDialogOpen] = useState(false);
  const [selectedServer, setSelectedServer] = useState<MCPServer | null>(null);
  const [connectionOpen, setConnectionOpen] = useState(false);
  const [connectionServer, setConnectionServer] = useState<MCPServer | null>(null);
  const [connectionIsNew, setConnectionIsNew] = useState(false);

  const handleEdit = (server: MCPServer) => {
    setEditingServer(server);
    setFormOpen(true);
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setEditingServer(null);
  };

  const handleViewConnection = (server: MCPServer, isNew = false) => {
    setConnectionServer(server);
    setConnectionIsNew(isNew);
    setConnectionOpen(true);
  };

  const handleViewTools = (server: MCPServer) => {
    setSelectedServer(server);
    setToolsDialogOpen(true);
  };

  const filterServers = (servers: MCPServer[] | undefined) => {
    if (!servers) return [];
    if (!searchQuery) return servers;
    const query = searchQuery.toLowerCase();
    return servers.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.description?.toLowerCase().includes(query) ||
        s.server_url.toLowerCase().includes(query)
    );
  };

  const filteredUserServers = filterServers(userServers);
  const filteredGlobalServers = filterServers(globalServers);
  const filteredAllServers = filterServers(allServers);

  // Stats
  const totalServers = allServers?.length || 0;
  const activeServers = allServers?.filter((s) => s.is_active).length || 0;
  const verifiedServers = allServers?.filter((s) => s.is_verified).length || 0;
  const totalTools = allServers?.reduce(
    (acc, s) => acc + (s.available_tools?.length || 0),
    0
  ) || 0;

  const isLoading = isPendingAll;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">MCP Servers</h1>
          <p className="text-muted-foreground">
            Manage Model Context Protocol servers for extended agent capabilities
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Server
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Plug className="h-4 w-4" />
              Total Servers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalServers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{activeServers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-blue-500" />
              Verified
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">{verifiedServers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Total Tools
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTools}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search servers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Servers Tabs */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all" className="gap-2">
            <Plug className="h-4 w-4" />
            All ({filteredAllServers.length})
          </TabsTrigger>
          <TabsTrigger value="user" className="gap-2">
            <User className="h-4 w-4" />
            My Servers ({filteredUserServers.length})
          </TabsTrigger>
          <TabsTrigger value="global" className="gap-2">
            <Globe className="h-4 w-4" />
            Global ({filteredGlobalServers.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredAllServers.length === 0 ? (
            <EmptyState
              title="No MCP servers found"
              description={
                searchQuery
                  ? "Try adjusting your search query"
                  : "Add an MCP server to extend your agents' capabilities"
              }
              onAdd={() => setFormOpen(true)}
              showAddButton={!searchQuery}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredAllServers.map((server) => (
                <MCPServerCard
                  key={server.id}
                  server={server}
                  onEdit={handleEdit}
                  onViewTools={handleViewTools}
                  onViewConnection={handleViewConnection}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="user">
          {isPendingUser ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredUserServers.length === 0 ? (
            <EmptyState
              title="No personal servers"
              description="Create your own MCP servers to extend agent capabilities"
              onAdd={() => setFormOpen(true)}
              showAddButton
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredUserServers.map((server) => (
                <MCPServerCard
                  key={server.id}
                  server={server}
                  onEdit={handleEdit}
                  onViewTools={handleViewTools}
                  onViewConnection={handleViewConnection}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="global">
          {isPendingGlobal ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredGlobalServers.length === 0 ? (
            <EmptyState
              title="No global servers"
              description="Global servers are managed by administrators"
              showAddButton={false}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredGlobalServers.map((server) => (
                <MCPServerCard
                  key={server.id}
                  server={server}
                  onViewTools={handleViewTools}
                  onViewConnection={handleViewConnection}
                  showActions={false}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create/Edit Form Dialog */}
      <MCPServerForm
        open={formOpen}
        onOpenChange={handleFormClose}
        server={editingServer}
        onSuccess={(server) => {
          handleFormClose();
          handleViewConnection(server, true);
        }}
      />

      <MCPServerConnectionDialog
        open={connectionOpen}
        onOpenChange={setConnectionOpen}
        server={connectionServer}
        isNew={connectionIsNew}
      />

      {/* Tools Dialog */}
      <Dialog open={toolsDialogOpen} onOpenChange={setToolsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-xl">{selectedServer?.icon || "🔌"}</span>
              {selectedServer?.name} - Tools
            </DialogTitle>
            <DialogDescription>
              Available tools from this MCP server
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[400px] pr-4">
            {!selectedServer?.available_tools ||
            selectedServer.available_tools.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Wrench className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No tools discovered</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Test the connection to discover available tools
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedServer.available_tools.map((tool: MCPTool, index: number) => (
                  <Card key={index}>
                    <CardHeader className="py-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-mono">
                          {tool.name}
                        </CardTitle>
                        <Badge variant="outline" className="text-xs">
                          {(() => {
                            const http = getHttpConfigFromSchema(
                              tool.inputSchema as Record<string, unknown>
                            );
                            if (http) {
                              return `${http.method} ${http.path}`;
                            }
                            return `${Object.keys(tool.inputSchema?.properties || {}).length} params`;
                          })()}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="py-2">
                      <p className="text-sm text-muted-foreground">
                        {tool.description || "No description"}
                      </p>
                      {tool.inputSchema?.properties &&
                        Object.keys(tool.inputSchema.properties).length > 0 && (
                          <div className="mt-3 space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">
                              Parameters:
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(tool.inputSchema.properties).map(
                                ([key, value]: [string, any]) => (
                                  <Badge
                                    key={key}
                                    variant="secondary"
                                    className="text-xs font-mono"
                                  >
                                    {key}
                                    {tool.inputSchema?.required?.includes(key) && (
                                      <span className="text-red-500 ml-0.5">*</span>
                                    )}
                                    <span className="text-muted-foreground ml-1">
                                      : {value.type || "any"}
                                    </span>
                                  </Badge>
                                )
                              )}
                            </div>
                          </div>
                        )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Empty state component
function EmptyState({
  title,
  description,
  onAdd,
  showAddButton = true,
}: {
  title: string;
  description: string;
  onAdd?: () => void;
  showAddButton?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-4 py-12">
        <Plug className="h-12 w-12 text-muted-foreground" />
        <div className="text-center">
          <p className="font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {showAddButton && onAdd && (
          <Button variant="outline" onClick={onAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Add MCP Server
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
