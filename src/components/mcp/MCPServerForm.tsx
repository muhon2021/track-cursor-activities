import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Trash2, Wand2 } from "lucide-react";
import {
  MCPServer,
  MCPTool,
  TransportType,
  AuthType,
  useCreateMCPServer,
  useUpdateMCPServer,
} from "@/hooks/useMCPServers";
import { RESTToolEditor } from "@/components/mcp/RESTToolEditor";
import {
  ACTIVECOLLAB_CREATE_TASK_TEMPLATE,
  curlToRestTool,
  parseInputSchemaToRestTool,
  type RestMCPTool,
} from "@/lib/mcp-rest-tools";
import { toast } from "sonner";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  icon: z.string().optional(),
  server_url: z.string().min(1, "Server URL is required"),
  transport_type: z.enum(["stdio", "http", "websocket", "sse", "rest"]),
  auth_type: z.enum(["none", "api_key", "bearer", "oauth", "basic"]),
  auth_api_key: z.string().optional(),
  auth_bearer_token: z.string().optional(),
  auth_username: z.string().optional(),
  auth_password: z.string().optional(),
  auth_basic_header: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface MCPServerFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  server?: MCPServer | null;
  onSuccess?: (server: MCPServer) => void;
}

const TRANSPORT_OPTIONS: { value: TransportType; label: string; description: string }[] = [
  { value: "rest", label: "REST API", description: "HTTP endpoints (ActiveCollab, webhooks, etc.)" },
  { value: "http", label: "MCP over HTTP", description: "Model Context Protocol servers (Zapier, etc.)" },
  { value: "stdio", label: "Stdio", description: "Standard input/output process" },
  { value: "websocket", label: "WebSocket", description: "Persistent WebSocket connection" },
  { value: "sse", label: "SSE", description: "Server-Sent Events" },
];

const AUTH_OPTIONS: { value: AuthType; label: string }[] = [
  { value: "none", label: "None" },
  { value: "api_key", label: "API Key" },
  { value: "bearer", label: "Bearer Token" },
  { value: "basic", label: "Basic Auth" },
];

const ICON_OPTIONS = ["🔌", "🌐", "📁", "🔧", "🤖", "📊", "🔍", "💾", "☁️", "🎯"];

export function MCPServerForm({
  open,
  onOpenChange,
  server,
  onSuccess,
}: MCPServerFormProps) {
  const [customTools, setCustomTools] = useState<MCPTool[]>([]);
  const [restTools, setRestTools] = useState<RestMCPTool[]>([]);
  const [curlInput, setCurlInput] = useState("");

  const createServer = useCreateMCPServer();
  const updateServer = useUpdateMCPServer();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      icon: "🔌",
      server_url: "",
      transport_type: "rest",
      auth_type: "none",
      auth_api_key: "",
      auth_bearer_token: "",
      auth_username: "",
      auth_password: "",
      auth_basic_header: "",
    },
  });

  const isEditing = !!server;
  const isPending = createServer.isPending || updateServer.isPending;

  // Reset form only when the dialog opens or the edited server changes.
  useEffect(() => {
    if (!open) return;

    if (server) {
      form.reset({
        name: server.name,
        description: server.description || "",
        icon: server.icon || "🔌",
        server_url: server.server_url,
        transport_type: server.transport_type,
        auth_type: server.auth_type,
        auth_api_key: (server.auth_config as any)?.api_key || "",
        auth_bearer_token: (server.auth_config as any)?.bearer_token || "",
        auth_username: (server.auth_config as any)?.username || "",
        auth_password: "",
        auth_basic_header: (server.auth_config as any)?.authorization_header || "",
      });
      if (server.transport_type === "rest") {
        setRestTools(
          (server.available_tools || []).map((t) =>
            parseInputSchemaToRestTool(t.name, t.description, t.inputSchema as Record<string, unknown>)
          )
        );
        setCustomTools([]);
      } else {
        setCustomTools(server.available_tools || []);
        setRestTools([]);
      }
    } else {
      form.reset({
        name: "",
        description: "",
        icon: "🔌",
        server_url: "",
        transport_type: "rest",
        auth_type: "none",
        auth_api_key: "",
        auth_bearer_token: "",
        auth_username: "",
        auth_password: "",
        auth_basic_header: "",
      });
      setCustomTools([]);
      setRestTools([]);
      setCurlInput("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reset when dialog opens or server identity changes
  }, [open, server?.id]);

  const onSubmit = async (data: FormData) => {
    // Build auth config
    const authConfig: Record<string, unknown> = {};
    if (data.auth_type === "api_key" && data.auth_api_key) {
      authConfig.api_key = data.auth_api_key;
    } else if (data.auth_type === "bearer" && data.auth_bearer_token) {
      authConfig.bearer_token = data.auth_bearer_token;
    } else if (data.auth_type === "basic") {
      if (data.auth_basic_header) {
        authConfig.authorization_header = data.auth_basic_header;
      } else {
        if (data.auth_username) authConfig.username = data.auth_username;
        if (data.auth_password) authConfig.password = data.auth_password;
      }
    }

    const isRest = data.transport_type === "rest";
    const payload = {
      name: data.name,
      description: data.description,
      icon: data.icon,
      server_url: data.server_url,
      transport_type: data.transport_type,
      auth_type: data.auth_type,
      auth_config: authConfig,
      ...(isRest ? { rest_tools: restTools } : { available_tools: customTools }),
    };

    try {
      let result: MCPServer;

      if (isEditing && server) {
        result = await updateServer.mutateAsync({
          id: server.id,
          data: payload,
        });
      } else {
        result = await createServer.mutateAsync(payload);
      }

      onSuccess?.(result);
      onOpenChange(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const addCustomTool = () => {
    setCustomTools([
      ...customTools,
      {
        name: "",
        description: "",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
    ]);
  };

  const removeCustomTool = (index: number) => {
    setCustomTools(customTools.filter((_, i) => i !== index));
  };

  const updateCustomTool = (index: number, field: keyof MCPTool, value: string) => {
    setCustomTools(
      customTools.map((tool, i) =>
        i === index ? { ...tool, [field]: value } : tool
      )
    );
  };

  const watchAuthType = form.watch("auth_type");
  const watchTransport = form.watch("transport_type");
  const isRestTransport = watchTransport === "rest";

  const importFromCurl = () => {
    try {
      const { server: parsedServer, tool } = curlToRestTool(curlInput);
      form.setValue("server_url", parsedServer.baseUrl);
      form.setValue("transport_type", "rest");
      if (parsedServer.authorizationHeader) {
        form.setValue("auth_type", "basic");
        form.setValue("auth_basic_header", parsedServer.authorizationHeader);
      }
      const duplicateName = restTools.some(
        (existing) => existing.name.trim() && existing.name === tool.name
      );
      setRestTools([...restTools, tool]);
      setCurlInput("");
      toast.success(
        duplicateName
          ? `Imported "${tool.name}" as a new tool (duplicate name — rename before saving).`
          : `Imported "${tool.name}" — added as Tool #${restTools.length + 1}. Review fields and save.`
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to parse curl command");
    }
  };

  const addRestTool = () => {
    setRestTools([
      ...restTools,
      {
        name: "",
        description: "",
        httpConfig: { method: "POST", path: "" },
        parameters: [],
      },
    ]);
  };

  const addActiveCollabTemplate = () => {
    setRestTools([ACTIVECOLLAB_CREATE_TASK_TEMPLATE]);
    if (!form.getValues("server_url")) {
      form.setValue("server_url", "https://activecollab-api.managedcoder.com");
    }
    form.setValue("transport_type", "rest");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit MCP Server" : "Add MCP Server"}
          </DialogTitle>
          <DialogDescription>
            Configure a Model Context Protocol server to extend agent capabilities
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic">Basic</TabsTrigger>
                <TabsTrigger value="auth">Authentication</TabsTrigger>
                <TabsTrigger value="tools">Tools</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4 mt-4">
                {/* Icon Selection */}
                <FormField
                  control={form.control}
                  name="icon"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Icon</FormLabel>
                      <div className="flex gap-2 flex-wrap">
                        {ICON_OPTIONS.map((icon) => (
                          <button
                            key={icon}
                            type="button"
                            onClick={() => field.onChange(icon)}
                            className={`text-2xl p-2 rounded-lg border-2 transition-colors ${
                              field.value === icon
                                ? "border-primary bg-primary/10"
                                : "border-transparent hover:border-muted"
                            }`}
                          >
                            {icon}
                          </button>
                        ))}
                      </div>
                    </FormItem>
                  )}
                />

                {/* Name */}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="My MCP Server" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Description */}
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="What does this server do?"
                          className="resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Server URL */}
                <FormField
                  control={form.control}
                  name="server_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{isRestTransport ? "Base URL" : "Server URL"}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={
                            isRestTransport
                              ? "https://activecollab-api.managedcoder.com"
                              : "https://mcp.zapier.com/api/v1/connect"
                          }
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {isRestTransport
                          ? "API host only — tool paths are configured per tool below"
                          : "The MCP server endpoint URL"}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Transport Type */}
                <FormField
                  control={form.control}
                  name="transport_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Transport Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {TRANSPORT_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              <div className="flex flex-col">
                                <span>{option.label}</span>
                                <span className="text-xs text-muted-foreground">
                                  {option.description}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="auth" className="space-y-4 mt-4">
                {/* Auth Type */}
                <FormField
                  control={form.control}
                  name="auth_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Authentication Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {AUTH_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* API Key */}
                {watchAuthType === "api_key" && (
                  <FormField
                    control={form.control}
                    name="auth_api_key"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>API Key</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="sk-..."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Bearer Token */}
                {watchAuthType === "bearer" && (
                  <FormField
                    control={form.control}
                    name="auth_bearer_token"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bearer Token</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="Bearer token"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Basic Auth */}
                {watchAuthType === "basic" && (
                  <>
                    <FormField
                      control={form.control}
                      name="auth_basic_header"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Authorization header (optional)</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="Basic b21rYXI..."
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Paste the full Authorization value from curl. If set, username/password below are ignored.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="auth_username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input placeholder="username" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="auth_password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="password"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}
              </TabsContent>

              <TabsContent value="tools" className="space-y-4 mt-4">
                {isRestTransport ? (
                  <>
                    <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
                      <Label className="text-sm">Import from curl</Label>
                      <Textarea
                        placeholder={`curl --location 'https://api.example.com/endpoint' \\\n--header 'Authorization: Basic ...' \\\n--data-raw '{ "key": "value" }'`}
                        value={curlInput}
                        onChange={(e) => setCurlInput(e.target.value)}
                        className="font-mono text-xs min-h-[100px]"
                      />
                      <Button type="button" variant="secondary" size="sm" onClick={importFromCurl} disabled={!curlInput.trim()}>
                        <Wand2 className="h-4 w-4 mr-1" />
                        Parse curl &amp; add tool
                      </Button>
                    </div>

                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <Label>REST API Tools</Label>
                        <p className="text-xs text-muted-foreground">
                          Each tool maps to one HTTP endpoint with request body fields
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={addActiveCollabTemplate}>
                          ActiveCollab template
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={addRestTool}>
                          <Plus className="h-4 w-4 mr-1" />
                          Add Tool
                        </Button>
                      </div>
                    </div>

                    {restTools.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>No REST tools defined</p>
                        <p className="text-xs mt-1">
                          Paste a curl command above or add a tool manually
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {restTools.map((tool, index) => (
                          <RESTToolEditor
                            key={index}
                            tool={tool}
                            index={index}
                            onChange={(updated) =>
                              setRestTools(restTools.map((t, i) => (i === index ? updated : t)))
                            }
                            onRemove={() => setRestTools(restTools.filter((_, i) => i !== index))}
                          />
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Custom Tools</Label>
                    <p className="text-xs text-muted-foreground">
                      Define tools manually or they'll be auto-discovered
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addCustomTool}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Tool
                  </Button>
                </div>

                {customTools.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No tools defined</p>
                    <p className="text-xs mt-1">
                      Tools will be auto-discovered when you test the connection
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {customTools.map((tool, index) => (
                      <div
                        key={index}
                        className="border rounded-lg p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <Label>Tool #{index + 1}</Label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => removeCustomTool(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <Input
                          placeholder="Tool name (e.g., web_search)"
                          value={tool.name}
                          onChange={(e) =>
                            updateCustomTool(index, "name", e.target.value)
                          }
                        />
                        <Textarea
                          placeholder="Tool description"
                          value={tool.description}
                          onChange={(e) =>
                            updateCustomTool(index, "description", e.target.value)
                          }
                          className="resize-none"
                          rows={2}
                        />
                      </div>
                    ))}
                  </div>
                )}
                  </>
                )}
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEditing ? "Save Changes" : "Create Server"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
