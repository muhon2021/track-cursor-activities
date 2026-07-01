import { useState } from "react";
import { useSSOGroupMappings, useCreateSSOGroupMapping, useDeleteSSOGroupMapping } from "@/hooks/useSSOGroupMappings";
import { useSSOConfigurations } from "@/hooks/useAuthConfig";
import { useRoles } from "@/hooks/useRoles";
import { useDepartments } from "@/hooks/useDepartments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Plus, Trash2, Users } from "lucide-react";

export function SSOGroupMappingsPanel() {
  const { data: mappings, isLoading } = useSSOGroupMappings();
  const { data: ssoConfigs = [] } = useSSOConfigurations();
  const { data: roles } = useRoles();
  const { data: departments } = useDepartments();
  const createMapping = useCreateSSOGroupMapping();
  const deleteMapping = useDeleteSSOGroupMapping();

  const [form, setForm] = useState({
    sso_config_id: "",
    external_group_id: "",
    external_group_name: "",
    role_id: "",
    department_id: "",
  });

  const handleCreate = async () => {
    if (!form.sso_config_id || !form.external_group_id || !form.role_id) return;
    await createMapping.mutateAsync({
      sso_config_id: form.sso_config_id,
      external_group_id: form.external_group_id,
      external_group_name: form.external_group_name || form.external_group_id,
      role_id: form.role_id,
      department_id: form.department_id || undefined,
    });
    setForm({
      sso_config_id: "",
      external_group_id: "",
      external_group_name: "",
      role_id: "",
      department_id: "",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          IdP Group Mapping
        </CardTitle>
        <CardDescription>
          Map Azure AD, Okta, or Google Workspace groups to Control Tower roles (sync not yet active)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label>SSO Provider</Label>
            <Select
              value={form.sso_config_id}
              onValueChange={(v) => setForm({ ...form, sso_config_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                {ssoConfigs.map((c) => (
                  <SelectItem key={c.id} value={c.id!}>
                    {c.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>External Group ID</Label>
            <Input
              value={form.external_group_id}
              onChange={(e) => setForm({ ...form, external_group_id: e.target.value })}
              placeholder="e.g., azure-group-uuid"
            />
          </div>
          <div className="space-y-2">
            <Label>Group Name</Label>
            <Input
              value={form.external_group_name}
              onChange={(e) => setForm({ ...form, external_group_name: e.target.value })}
              placeholder="e.g., Engineering Managers"
            />
          </div>
          <div className="space-y-2">
            <Label>Control Tower Role</Label>
            <Select value={form.role_id} onValueChange={(v) => setForm({ ...form, role_id: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {(roles ?? []).map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Department (optional)</Label>
            <Select
              value={form.department_id}
              onValueChange={(v) => setForm({ ...form, department_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                {(departments ?? []).map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={handleCreate} disabled={createMapping.isPending}>
              {createMapping.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Add Mapping
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : !mappings?.length ? (
          <p className="text-center text-muted-foreground py-8">
            No group mappings configured yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Group</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Department</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mappings.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>{m.external_group_name}</TableCell>
                  <TableCell>{m.roles?.name}</TableCell>
                  <TableCell>{m.departments?.name || "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMapping.mutate(m.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
