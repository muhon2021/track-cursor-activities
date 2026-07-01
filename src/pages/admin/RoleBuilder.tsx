import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { roleFormSchema, RoleBuilderFormData } from "@/lib/validation";
import { useRole, useCreateRole, useUpdateRole } from "@/hooks/useRoles";
import { usePermissionCatalog, useRolePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Save, ArrowLeft } from "lucide-react";

const NON_ASSIGNABLE_KEYS = ["org.delete_org", "org.transfer_ownership"];

export default function RoleBuilder() {
  const { roleId } = useParams<{ roleId: string }>();
  const isEditing = !!roleId;
  const navigate = useNavigate();

  const { data: role, isLoading: roleLoading } = useRole(roleId ?? "");
  const { data: permissions, isLoading: catalogLoading } = usePermissionCatalog();
  const { data: existingKeys, isLoading: keysLoading } = useRolePermissions(roleId);
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();

  const form = useForm<RoleBuilderFormData>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: { name: "", description: "", permissionKeys: [] },
  });

  useEffect(() => {
    if (isEditing && role) {
      form.reset({
        name: role.name,
        description: role.description ?? "",
        permissionKeys: existingKeys ?? [],
      });
    }
  }, [isEditing, role, existingKeys, form]);

  const watchedKeys = form.watch("permissionKeys");
  const selectedKeys = watchedKeys ?? [];

  const categories = useMemo(() => {
    const map = new Map<string, NonNullable<typeof permissions>>();
    (permissions ?? [])
      .filter((p) => !NON_ASSIGNABLE_KEYS.includes(p.key))
      .forEach((p) => {
        const list = map.get(p.category) ?? [];
        list.push(p);
        map.set(p.category, list);
      });
    return Array.from(map.entries());
  }, [permissions]);

  const togglePermission = (key: string) => {
    const next = selectedKeys.includes(key)
      ? selectedKeys.filter((k) => k !== key)
      : [...selectedKeys, key];
    form.setValue("permissionKeys", next, { shouldDirty: true });
  };

  const previewText = useMemo(() => {
    if (!selectedKeys.length) return "This role cannot perform any actions yet.";
    const byCategory = new Map<string, number>();
    (permissions ?? [])
      .filter((p) => selectedKeys.includes(p.key))
      .forEach((p) => byCategory.set(p.category, (byCategory.get(p.category) ?? 0) + 1));
    return Array.from(byCategory.entries())
      .map(([category, count]) => `Manage ${count} ${category} permission${count > 1 ? "s" : ""}`)
      .join(" · ");
  }, [selectedKeys, permissions]);

  const onSubmit = async (data: RoleBuilderFormData) => {
    try {
      if (isEditing && roleId) {
        await updateRole.mutateAsync({ id: roleId, data });
      } else {
        await createRole.mutateAsync(data);
      }
      navigate("/admin/roles");
    } catch {
      // handled by mutation toast
    }
  };

  const isSaving = createRole.isPending || updateRole.isPending;
  const isLoading = roleLoading || catalogLoading || (isEditing && keysLoading);

  if (isEditing && role?.is_system) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          System roles cannot be edited through the role builder.
        </CardContent>
      </Card>
    );
  }

  return (
    <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2">
            <Link to="/admin/roles">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Roles
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">
            {isEditing ? "Edit Role" : "Create Role"}
          </h1>
          <p className="text-muted-foreground">
            Define a role name and grant the permissions it needs.
          </p>
        </div>
        <Button type="submit" disabled={isSaving || isLoading}>
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {isEditing ? "Save Changes" : "Create Role"}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Role Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Role Name *</Label>
                <Input id="name" {...form.register("name")} />
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" rows={2} {...form.register("description")} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>What this role can do</CardTitle>
              <CardDescription>{previewText}</CardDescription>
            </CardHeader>
          </Card>

          {categories.map(([category, perms]) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle>{category}</CardTitle>
                <CardDescription>{perms.length} permissions</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {perms.map((perm) => (
                  <label
                    key={perm.key}
                    className="flex items-start gap-2 rounded-md border p-2 text-sm hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={selectedKeys.includes(perm.key)}
                      onCheckedChange={() => togglePermission(perm.key)}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="font-medium">{perm.name}</span>
                      {perm.description && (
                        <span className="block text-xs text-muted-foreground">
                          {perm.description}
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </CardContent>
            </Card>
          ))}
        </>
      )}
    </form>
  );
}
