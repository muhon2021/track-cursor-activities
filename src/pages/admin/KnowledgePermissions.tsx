import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Shield } from "lucide-react";
import { useKbSourcePermissions, useUpsertKbSourcePermission } from "@/hooks/useKbSourcePermissions";
import type { KbPermission } from "@/types/knowledgeRag";

const ROLES = [
  { key: "admin" as const, label: "Admin" },
  { key: "moderator" as const, label: "Manager" },
  { key: "user" as const, label: "Employee" },
];

const PERMS: KbPermission[] = ["view", "edit", "cite", "sync", "delete"];

export default function KnowledgePermissions() {
  const { data, isLoading } = useKbSourcePermissions();
  const upsert = useUpsertKbSourcePermission();

  const getPerms = (sourceId: string, appRole: typeof ROLES[number]["key"]): KbPermission[] => {
    const row = data?.permissions.find((p) => p.source_id === sourceId && p.app_role === appRole);
    return (row?.permissions as KbPermission[]) ?? [];
  };

  const getPermRowId = (sourceId: string, appRole: typeof ROLES[number]["key"]) =>
    data?.permissions.find((p) => p.source_id === sourceId && p.app_role === appRole)?.id;

  const toggle = (sourceId: string, appRole: typeof ROLES[number]["key"], perm: KbPermission, checked: boolean) => {
    const current = getPerms(sourceId, appRole);
    const next = checked ? [...new Set([...current, perm])] : current.filter((p) => p !== perm);
    upsert.mutate({ source_id: sourceId, app_role: appRole, permissions: next, id: getPermRowId(sourceId, appRole) });
  };

  if (isLoading) {
    return <div className="flex h-48 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="container mx-auto space-y-6 py-8">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Shield className="h-8 w-8 text-primary" />
          Knowledge Permissions
        </h1>
        <p className="text-muted-foreground mt-1">Role × Source permission matrix</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Permissions Matrix</CardTitle>
          <CardDescription>Fine-grained source access by role</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                {ROLES.map((r) => (
                  <TableHead key={r.key} colSpan={PERMS.length} className="text-center border-l">{r.label}</TableHead>
                ))}
              </TableRow>
              <TableRow>
                <TableHead />
                {ROLES.map((r) =>
                  PERMS.map((p) => (
                    <TableHead key={`${r.key}-${p}`} className="text-xs capitalize border-l">{p}</TableHead>
                  ))
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.sources ?? []).map((source) => (
                <TableRow key={source.id}>
                  <TableCell className="font-medium">{source.name}</TableCell>
                  {ROLES.map((role) =>
                    PERMS.map((perm) => {
                      const checked = getPerms(source.id, role.key).includes(perm);
                      return (
                        <TableCell key={`${source.id}-${role.key}-${perm}`} className="text-center border-l">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(c) => toggle(source.id, role.key, perm, !!c)}
                            disabled={upsert.isPending}
                          />
                        </TableCell>
                      );
                    })
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
