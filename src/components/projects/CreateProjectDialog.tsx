import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Loader2, Search, CalendarIcon, Users } from "lucide-react";
import {
  useCreateProject,
  useProjectStatuses,
  useManagers,
  useTeams,
  useProjectCategories,
} from "@/modules/projects/hooks/useProjects";
import { useClients } from "@/hooks/useClients";
import type { ProjectFormData } from "@/modules/projects/types";

const PROJECT_TYPES = [
  { value: "fixed", label: "Fixed" },
  { value: "hourly", label: "Hourly" },
  { value: "retainer", label: "Retainer" },
  { value: "other", label: "Other" },
];

const PROJECT_COMPLEXITY = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

interface CreateProjectDialogProps {
  trigger?: React.ReactNode;
}

export function CreateProjectDialog({ trigger }: CreateProjectDialogProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { data: statuses = [] } = useProjectStatuses();
  const { data: clients = [] } = useClients();
  const { data: managers = [] } = useManagers();
  const { data: teams = [] } = useTeams();
  const { data: categories = [] } = useProjectCategories();
  const createProject = useCreateProject();

  const [searchActiveCollabQuery, setSearchActiveCollabQuery] = useState("");
  const [searchActiveCollabEnabled, setSearchActiveCollabEnabled] = useState(false);
  const [form, setForm] = useState<ProjectFormData & {
    client_email?: string;
    client_phone?: string;
    manager_id?: string;
    cs_manager_id?: string;
    team_id?: string;
    category_id?: string;
    project_type?: string;
    project_complexity?: string;
    team_member_ids?: string[];
  }>({
    name: "",
    description: "",
    status_id: undefined,
    client_id: undefined,
    owner_id: undefined,
    start_date: undefined,
    end_date: undefined,
    budget: undefined,
    client_email: "",
    client_phone: "",
    manager_id: "",
    cs_manager_id: "",
    team_id: "",
    category_id: "",
    project_type: "",
    project_complexity: "",
    team_member_ids: [],
  });

  const selectedClient = clients.find((c) => c.id === form.client_id);

  useEffect(() => {
    if (open && statuses.length > 0 && !form.status_id) {
      const defaultStatus = statuses.find((s) => s.is_default) || statuses[0];
      setForm((f) => ({ ...f, status_id: defaultStatus.id }));
    }
  }, [open, statuses, form.status_id]);

  useEffect(() => {
    if (selectedClient) {
      setForm((f) => ({
        ...f,
        client_email: selectedClient.email ?? "",
        client_phone: selectedClient.phone ?? "",
      }));
    }
  }, [form.client_id, selectedClient?.email, selectedClient?.phone]);

  const set = (field: keyof typeof form, value: unknown) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const payload: ProjectFormData = {
      name: form.name.trim(),
      description: form.description || undefined,
      status_id: form.status_id,
      client_id: form.client_id,
      owner_id: form.owner_id || undefined,
      start_date: form.start_date,
      end_date: form.end_date,
      budget: form.budget,
    };
    createProject.mutate(payload, {
      onSuccess: (project: { slug?: string }) => {
        setOpen(false);
        setForm({
          name: "",
          description: "",
          status_id: undefined,
          client_id: undefined,
          owner_id: undefined,
          start_date: undefined,
          end_date: undefined,
          budget: undefined,
          client_email: "",
          client_phone: "",
          manager_id: "",
          cs_manager_id: "",
          team_id: "",
          category_id: "",
          project_type: "",
          project_complexity: "",
          team_member_ids: [],
        });
        setSearchActiveCollabQuery("");
        setSearchActiveCollabEnabled(false);
        if (project?.slug) navigate(`/projects/${project.slug}`);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Capture the basic details to set up a new project record. You can search for an existing
            ActiveCollab project or create a new one manually.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Search ActiveCollab Project: checkbox toggles visibility of search input + button */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="search-ac"
                checked={searchActiveCollabEnabled}
                onCheckedChange={(v) => setSearchActiveCollabEnabled(!!v)}
              />
              <Label htmlFor="search-ac" className="text-sm font-medium cursor-pointer">
                Search ActiveCollab Project
              </Label>
            </div>
            {searchActiveCollabEnabled && (
              <div className="flex gap-2 pl-6">
                <Input
                  className="flex-1"
                  placeholder="Search for ActiveCollab project..."
                  value={searchActiveCollabQuery}
                  onChange={(e) => setSearchActiveCollabQuery(e.target.value)}
                  disabled={createProject.isPending}
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="shrink-0"
                  onClick={() => {
                    /* TODO: call ActiveCollab search API */
                  }}
                >
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </Button>
              </div>
            )}
          </div>

          {/* Row 1: Project Name *, Client Name * */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="create-name">
                Project Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="create-name"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Client Portal Revamp"
                disabled={createProject.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-client">
                Client Name <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.client_id ?? "none"}
                onValueChange={(v) => set("client_id", v === "none" ? undefined : v)}
                disabled={createProject.isPending}
              >
                <SelectTrigger id="create-client">
                  <SelectValue placeholder="Client name" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select client</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 2: Client Email (full width) */}
          <div className="space-y-2">
            <Label htmlFor="create-client-email">Client Email</Label>
            <Input
              id="create-client-email"
              type="email"
              value={form.client_email ?? ""}
              onChange={(e) => set("client_email", e.target.value)}
              placeholder="client@example.com"
              disabled={createProject.isPending}
            />
          </div>

          {/* Row 3: Project Description (full width) */}
          <div className="space-y-2">
            <Label htmlFor="create-desc">Project Description</Label>
            <Textarea
              id="create-desc"
              value={form.description || ""}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Brief description of the project..."
              rows={3}
              className="resize-y"
              disabled={createProject.isPending}
            />
          </div>

          {/* Row 4: Client Phone, Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="create-client-phone">Client Phone</Label>
              <Input
                id="create-client-phone"
                value={form.client_phone ?? ""}
                onChange={(e) => set("client_phone", e.target.value)}
                placeholder="+1 (555) 123-4567"
                disabled={createProject.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.status_id ?? ""}
                onValueChange={(v) => set("status_id", v || undefined)}
                disabled={createProject.isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 5: Manager, CS Manager */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Manager</Label>
              <Select
                value={form.manager_id ?? ""}
                onValueChange={(v) => set("manager_id", v)}
                disabled={createProject.isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Manager" />
                </SelectTrigger>
                <SelectContent>
                  {managers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.full_name || m.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>CS Manager</Label>
              <Select
                value={form.cs_manager_id ?? ""}
                onValueChange={(v) => set("cs_manager_id", v)}
                disabled={createProject.isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select CS Manager" />
                </SelectTrigger>
                <SelectContent>
                  {managers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.full_name || m.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 6: Project Manager (full width, required) */}
          <div className="space-y-2">
            <Label>
              Project Manager <span className="text-destructive">*</span>
            </Label>
            <Select
              value={form.owner_id ?? ""}
              onValueChange={(v) => set("owner_id", v || undefined)}
              disabled={createProject.isPending}
            >
              <SelectTrigger className={!form.owner_id ? "border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20" : ""}>
                <SelectValue placeholder="Select Project Manager" />
              </SelectTrigger>
              <SelectContent>
                {managers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.full_name || m.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Row 7: Team Members (full width) */}
          <div className="space-y-2">
            <Label>Team Members</Label>
            <Select disabled={createProject.isPending}>
              <SelectTrigger>
                <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Select Team Members" />
              </SelectTrigger>
              <SelectContent>
                {managers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.full_name || m.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Row 8: Team, Project Category */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Team</Label>
              <Select
                value={form.team_id ?? ""}
                onValueChange={(v) => set("team_id", v)}
                disabled={createProject.isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Team" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                  {teams.length === 0 && (
                    <SelectItem value="__none" disabled>
                      No teams
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Project Category</Label>
              <Select
                value={form.category_id ?? ""}
                onValueChange={(v) => set("category_id", v)}
                disabled={createProject.isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                  {categories.length === 0 && (
                    <SelectItem value="__none" disabled>
                      No categories
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 9: Project Type, Project Complexity */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Project Type</Label>
              <Select
                value={form.project_type ?? ""}
                onValueChange={(v) => set("project_type", v)}
                disabled={createProject.isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Type" />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Project Complexity</Label>
              <Select
                value={form.project_complexity ?? ""}
                onValueChange={(v) => set("project_complexity", v)}
                disabled={createProject.isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Complexity" />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_COMPLEXITY.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 10: Project Budget (USD), Start Date */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="create-budget">Project Budget (USD)</Label>
              <Input
                id="create-budget"
                type="number"
                min={0}
                step={0.01}
                value={form.budget ?? ""}
                onChange={(e) => set("budget", e.target.value ? Number(e.target.value) : undefined)}
                placeholder="0.00"
                disabled={createProject.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-start">Start Date</Label>
              <div className="relative">
                <Input
                  id="create-start"
                  type="date"
                  value={form.start_date ?? ""}
                  onChange={(e) => set("start_date", e.target.value || undefined)}
                  disabled={createProject.isPending}
                  className="pr-9"
                />
                <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
              <p className="text-xs text-muted-foreground">
                Auto-set to AC project creation date if not specified
              </p>
            </div>
          </div>

          {/* Row 11: End Date (full width) */}
          <div className="space-y-2">
            <Label htmlFor="create-end">End Date</Label>
            <div className="relative">
              <Input
                id="create-end"
                type="date"
                value={form.end_date ?? ""}
                onChange={(e) => set("end_date", e.target.value || undefined)}
                disabled={createProject.isPending}
                className="pr-9"
              />
              <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!form.name.trim() || !form.client_id || !form.owner_id || createProject.isPending}
            >
              {createProject.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
