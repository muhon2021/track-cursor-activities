import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus } from "lucide-react";
import type { MCPToolParameter, RestHttpMethod, RestMCPTool } from "@/lib/mcp-rest-tools";

const HTTP_METHODS: RestHttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const PARAM_TYPES: MCPToolParameter["type"][] = ["string", "number", "integer", "boolean"];

interface RESTToolEditorProps {
  tool: RestMCPTool;
  index: number;
  onChange: (tool: RestMCPTool) => void;
  onRemove: () => void;
}

export function RESTToolEditor({ tool, index, onChange, onRemove }: RESTToolEditorProps) {
  const update = (partial: Partial<RestMCPTool>) => onChange({ ...tool, ...partial });

  const updateHttp = (partial: Partial<RestMCPTool["httpConfig"]>) =>
    update({ httpConfig: { ...tool.httpConfig, ...partial } });

  const updateParameter = (paramIndex: number, partial: Partial<MCPToolParameter>) => {
    const parameters = tool.parameters.map((p, i) =>
      i === paramIndex ? { ...p, ...partial } : p
    );
    update({ parameters });
  };

  const addParameter = () => {
    update({
      parameters: [
        ...tool.parameters,
        { name: "", type: "string", required: false, description: "" },
      ],
    });
  };

  const removeParameter = (paramIndex: number) => {
    update({ parameters: tool.parameters.filter((_, i) => i !== paramIndex) });
  };

  return (
    <div className="border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Tool #{index + 1}</Label>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Tool name</Label>
          <Input
            placeholder="ac_create_task"
            value={tool.name}
            onChange={(e) => update({ name: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">HTTP method</Label>
          <Select value={tool.httpConfig.method} onValueChange={(v) => updateHttp({ method: v as RestHttpMethod })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HTTP_METHODS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Endpoint path</Label>
        <Input
          placeholder="/api/v1/ac-create-task"
          value={tool.httpConfig.path}
          onChange={(e) => updateHttp({ path: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Relative to the server base URL, or a full URL if it starts with http
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Description</Label>
        <Textarea
          placeholder="What does this tool do?"
          value={tool.description}
          onChange={(e) => update({ description: e.target.value })}
          className="resize-none"
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Request body parameters</Label>
          <Button type="button" variant="outline" size="sm" onClick={addParameter}>
            <Plus className="h-3 w-3 mr-1" />
            Add field
          </Button>
        </div>

        {tool.parameters.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">
            No body fields — used for GET requests or empty POST bodies.
          </p>
        ) : (
          <div className="space-y-2">
            {tool.parameters.map((param, paramIndex) => (
              <div key={paramIndex} className="grid gap-2 sm:grid-cols-[1fr_100px_80px_1fr_32px] items-center border rounded-md p-2">
                <Input
                  placeholder="field_name"
                  value={param.name}
                  onChange={(e) => updateParameter(paramIndex, { name: e.target.value })}
                  className="h-8 text-xs"
                />
                <Select
                  value={param.type}
                  onValueChange={(v) => updateParameter(paramIndex, { type: v as MCPToolParameter["type"] })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PARAM_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-1.5">
                  <Switch
                    checked={!!param.required}
                    onCheckedChange={(checked) => updateParameter(paramIndex, { required: checked })}
                  />
                  <span className="text-xs text-muted-foreground">Req</span>
                </div>
                <Input
                  placeholder="Description"
                  value={param.description ?? ""}
                  onChange={(e) => updateParameter(paramIndex, { description: e.target.value })}
                  className="h-8 text-xs"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => removeParameter(paramIndex)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
