import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useRoles, useUpdateRolePermissions } from "@/hooks/useRoles";
import { usePermissionCatalog, usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Save, ArrowLeft } from "lucide-react";
import { PermissionDenied } from "@/components/auth/PermissionDenied";

import { useAuth } from "@/contexts/AuthContext";

export default function PermissionMatrix() {
  const { profile } = useAuth();
  const { hasPermission, isLoading: permLoading, isSuccess: permLoaded } = usePermissions();
  const isAdminRole = profile?.role === "admin" || profile?.role === "moderator";
  const { data: roles, isLoading: rolesLoading } = useRoles();
  const { data: permissions, isLoading: catalogLoading } = usePermissionCatalog();
  const updatePermissions = useUpdateRolePermissions();
  const [matrix, setMatrix] = useState<Record<string, Record<string, boolean>>>({});
  const [initialized, setInitialized] = useState(false);
  const [dirty, setDirty] = useState(false);

  const systemRoles = useMemo(() => (roles ?? []).filter((r) => r.slug), [roles]);

  useEffect(() => {
    if (!systemRoles.length || !permissions?.length || initialized) return;

    const load = async () => {
      const next: Record<string, Record<string, boolean>> = {};
      for (const role of systemRoles) {
        const { data } = await (supabase as any)
          .from("role_permissions")
          .select("permissions(key)")
          .eq("role_id", role.id);
        const keys = new Set(
          (data ?? []).map((row: { permissions: { key: string } }) => row.permissions.key)
        );
        next[role.id] = {};
        permissions.forEach((p) => {
          next[role.id][p.key] = keys.has(p.key);
        });
      }
      setMatrix(next);
      setInitialized(true);
    };
    load();
  }, [systemRoles, permissions, initialized]);

  const categories = useMemo(() => {
    const map = new Map<string, NonNullable<typeof permissions>>();
    (permissions ?? []).forEach((p) => {
      const list = map.get(p.category) ?? [];
      list.push(p);
      map.set(p.category, list);
    });
    return Array.from(map.entries());
  }, [permissions]);

  const toggleCell = (roleId: string, permKey: string) => {
    setMatrix((prev) => ({
      ...prev,
      [roleId]: {
        ...prev[roleId],
        [permKey]: !prev[roleId]?.[permKey],
      },
    }));
    setDirty(true);
  };

  const handleSave = async () => {
    for (const role of systemRoles) {
      const keys = Object.entries(matrix[role.id] ?? {})
        .filter(([, v]) => v)
        .map(([k]) => k);
      await updatePermissions.mutateAsync({ roleId: role.id, permissionKeys: keys });
    }
    setDirty(false);
  };

  if (permLoading || !permLoaded) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdminRole && !hasPermission("settings.admin") && !hasPermission("users.admin")) {
    return (
      <PermissionDenied message="You do not have permission to manage the permission matrix." />
    );
  }

  const isLoading = rolesLoading || catalogLoading || !initialized;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2">
            <Link to="/admin/roles">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Roles
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Permission Matrix</h1>
          <p className="text-muted-foreground">
            Manage permissions visually across all system roles
          </p>
        </div>
        <Button onClick={handleSave} disabled={!dirty || updatePermissions.isPending}>
          {updatePermissions.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Changes
        </Button>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !permissions?.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No permissions configured. Run the enterprise RBAC migration first.
          </CardContent>
        </Card>
      ) : (
        categories.map(([category, perms]) => (
          <Card key={category}>
            <CardHeader>
              <CardTitle>{category}</CardTitle>
              <CardDescription>{perms.length} permissions</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 pr-4 text-left font-medium">Permission</th>
                    {systemRoles.map((role) => (
                      <th key={role.id} className="px-2 py-2 text-center font-medium">
                        {role.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {perms.map((perm) => (
                    <tr key={perm.key} className="border-b last:border-0">
                      <td className="py-2 pr-4">{perm.name}</td>
                      {systemRoles.map((role) => (
                        <td key={role.id} className="px-2 py-2 text-center">
                          <Checkbox
                            checked={matrix[role.id]?.[perm.key] ?? false}
                            onCheckedChange={() => toggleCell(role.id, perm.key)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
