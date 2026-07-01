/**
 * DepartmentDialog - Create/Edit department form
 */

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, getInitials } from "@/lib/utils";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { departmentFormSchema, type DepartmentFormData } from "@/lib/validation";
import {
  useCreateDepartment,
  useUpdateDepartment,
  useDepartments,
  useActiveUsersSearch,
  type Department,
} from "@/hooks/useDepartments";

export interface DepartmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department?: Department | null;
}

const DEPARTMENT_COLORS = [
  { value: "#ef4444", label: "Red" },
  { value: "#f97316", label: "Orange" },
  { value: "#eab308", label: "Yellow" },
  { value: "#22c55e", label: "Green" },
  { value: "#06b6d4", label: "Cyan" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#8b5cf6", label: "Violet" },
  { value: "#ec4899", label: "Pink" },
];

export function DepartmentDialog({ open, onOpenChange, department }: DepartmentDialogProps) {
  const isEditMode = !!department;
  const createDepartment = useCreateDepartment();
  const updateDepartment = useUpdateDepartment();
  const [headSearch, setHeadSearch] = useState("");
  const [headPickerOpen, setHeadPickerOpen] = useState(false);
  const { data: headCandidates = [], isLoading: headLoading } = useActiveUsersSearch(headSearch);
  const { data: allDepartments = [] } = useDepartments({ activeOnly: true });

  const form = useForm<DepartmentFormData>({
    resolver: zodResolver(departmentFormSchema),
    defaultValues: {
      name: "",
      description: "",
      head_user_id: null,
      color: null,
      parent_department_id: null,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: department?.name || "",
        description: department?.description || "",
        head_user_id: department?.head_user_id || null,
        color: department?.color || null,
        parent_department_id: department?.parent_department_id || null,
      });
    }
  }, [open, department, form]);

  const selectedHeadId = form.watch("head_user_id");
  const selectedHead = headCandidates.find((u) => u.id === selectedHeadId);
  const selectedColor = form.watch("color");
  const selectableParents = allDepartments.filter((d) => d.id !== department?.id);

  const onSubmit = async (data: DepartmentFormData) => {
    try {
      if (isEditMode && department) {
        await updateDepartment.mutateAsync({ id: department.id, data });
      } else {
        await createDepartment.mutateAsync(data);
      }
      onOpenChange(false);
    } catch {
      // Errors handled by mutation hooks
    }
  };

  const isPending = createDepartment.isPending || updateDepartment.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Department" : "Create Department"}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Update department name and description."
              : "Add a new department to your organization."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dept-name">Department Name *</Label>
            <Input
              id="dept-name"
              placeholder="e.g. Engineering"
              {...form.register("name")}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="dept-description">Description</Label>
            <Textarea
              id="dept-description"
              placeholder="Optional description"
              rows={3}
              {...form.register("description")}
            />
            {form.formState.errors.description && (
              <p className="text-sm text-destructive">{form.formState.errors.description.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Department Head</Label>
            <Popover open={headPickerOpen} onOpenChange={setHeadPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between font-normal"
                >
                  {selectedHead ? (
                    <span className="flex items-center gap-2 truncate">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={selectedHead.avatar_url || undefined} />
                        <AvatarFallback className="text-[10px]">
                          {getInitials(selectedHead.full_name || selectedHead.email || "?")}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate">{selectedHead.full_name || selectedHead.email}</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">No head assigned</span>
                  )}
                  <ChevronsUpDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Search people..."
                    value={headSearch}
                    onValueChange={setHeadSearch}
                  />
                  <CommandList>
                    {headLoading && <CommandEmpty>Searching...</CommandEmpty>}
                    {!headLoading && headCandidates.length === 0 && (
                      <CommandEmpty>No matching users.</CommandEmpty>
                    )}
                    <CommandGroup>
                      <CommandItem
                        onSelect={() => {
                          form.setValue("head_user_id", null);
                          setHeadPickerOpen(false);
                        }}
                      >
                        <Check
                          className={cn("mr-2 h-4 w-4", !selectedHeadId ? "opacity-100" : "opacity-0")}
                        />
                        No head assigned
                      </CommandItem>
                      {headCandidates.map((u) => (
                        <CommandItem
                          key={u.id}
                          value={u.id}
                          onSelect={() => {
                            form.setValue("head_user_id", u.id);
                            setHeadPickerOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedHeadId === u.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {u.full_name || u.email}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                className={cn(
                  "h-7 w-7 rounded-full border-2 flex items-center justify-center text-muted-foreground",
                  !selectedColor ? "border-foreground" : "border-transparent"
                )}
                onClick={() => form.setValue("color", null)}
                title="No color"
              >
                <span className="text-xs">×</span>
              </button>
              {DEPARTMENT_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  className={cn(
                    "h-7 w-7 rounded-full border-2",
                    selectedColor === c.value ? "border-foreground" : "border-transparent"
                  )}
                  style={{ backgroundColor: c.value }}
                  onClick={() => form.setValue("color", c.value)}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dept-parent">Parent Department</Label>
            <Select
              value={form.watch("parent_department_id") || "none"}
              onValueChange={(value) =>
                form.setValue("parent_department_id", value === "none" ? null : value)
              }
            >
              <SelectTrigger id="dept-parent">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {selectableParents.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditMode ? "Save Changes" : "Create Department"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
