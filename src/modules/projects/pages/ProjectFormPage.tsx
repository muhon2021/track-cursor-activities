/**
 * Project Form Page - Create and edit projects
 */

import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useProject, useProjectStatuses, useCreateProject, useUpdateProject } from "../hooks/useProjects";
import { useClients } from "@/hooks/useClients";
import type { ProjectFormData } from "../types";

export default function ProjectFormPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const isEdit = !!slug;

  const { data: existingProject, isLoading: loadingProject } = useProject(slug || "");
  const { data: statuses = [] } = useProjectStatuses();
  const { data: clients = [] } = useClients();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();

  const [form, setForm] = useState<ProjectFormData>({
    name: "",
    description: "",
    status_id: undefined,
    client_id: undefined,
    start_date: undefined,
    end_date: undefined,
    budget: undefined,
  });

  useEffect(() => {
    if (existingProject && isEdit) {
      setForm({
        name: existingProject.name,
        description: existingProject.description || "",
        status_id: existingProject.status_id || undefined,
        client_id: existingProject.client_id || undefined,
        owner_id: existingProject.owner_id || undefined,
        start_date: existingProject.start_date || undefined,
        end_date: existingProject.end_date || undefined,
        budget: existingProject.budget || undefined,
      });
    }
  }, [existingProject, isEdit]);

  // Set default status for new projects
  useEffect(() => {
    if (!isEdit && statuses.length > 0 && !form.status_id) {
      const defaultStatus = statuses.find((s) => s.is_default) || statuses[0];
      setForm((f) => ({ ...f, status_id: defaultStatus.id }));
    }
  }, [statuses, isEdit, form.status_id]);

  const set = (field: keyof ProjectFormData, value: unknown) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    if (isEdit && existingProject) {
      updateProject.mutate(
        { id: existingProject.id, data: form },
        { onSuccess: () => navigate(`/projects/${slug}`) }
      );
    } else {
      createProject.mutate(form, {
        onSuccess: (project: any) => navigate(`/projects/${project.slug}`),
      });
    }
  };

  const isPending = createProject.isPending || updateProject.isPending;

  if (isEdit && loadingProject) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(isEdit ? `/projects/${slug}` : "/projects")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">{isEdit ? "Edit Project" : "New Project"}</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Project Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Q1 Marketing Website"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={form.description || ""}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Brief description of the project..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Status</Label>
                <Select
                  value={form.status_id || "none"}
                  onValueChange={(v) => set("status_id", v === "none" ? undefined : v)}
                >
                  <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No status</SelectItem>
                    {statuses.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                          {s.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Client</Label>
                <Select
                  value={form.client_id || "none"}
                  onValueChange={(v) => set("client_id", v === "none" ? undefined : v)}
                >
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No client</SelectItem>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={form.start_date || ""}
                  onChange={(e) => set("start_date", e.target.value || undefined)}
                />
              </div>
              <div>
                <Label htmlFor="end_date">End Date</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={form.end_date || ""}
                  onChange={(e) => set("end_date", e.target.value || undefined)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="budget">Budget ($)</Label>
              <Input
                id="budget"
                type="number"
                min={0}
                value={form.budget ?? ""}
                onChange={(e) => set("budget", e.target.value ? Number(e.target.value) : undefined)}
                placeholder="0"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(isEdit ? `/projects/${slug}` : "/projects")}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!form.name.trim() || isPending}>
                {isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{isEdit ? "Saving..." : "Creating..."}</>
                ) : (
                  isEdit ? "Save Changes" : "Create Project"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
